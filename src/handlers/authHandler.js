import { User, UserModel } from "../internal/db/user.js";
import { createToken } from "../utils/jwt.js";
import {
  registerSchema,
  loginSchema,
  googleSchema,
  appleSchema,
} from "../validators/authValidators.js";
import { OAuth2Client } from "google-auth-library";
import appleSigninAuth from "apple-signin-auth";

const TOKEN_TTL_SECONDS = 60 * 60;
const BLACKLIST_TTL_SECONDS = 60 * 60;

const googleClient = new OAuth2Client();
const getGoogleAudiences = () => {
  const multi = process.env.GOOGLE_CLIENT_IDS;
  if (multi)
    return multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return process.env.GOOGLE_CLIENT_ID;
};

const extractToken = (header) => {
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7) : header;
};

const buildSessionData = (user, req) => ({
  user,
  loginAt: new Date().toISOString(),
  ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
  userAgent: req.headers["user-agent"] || "unknown",
});

const issueSession = async (services, user, req) => {
  const token = createToken(user._id, user.email, process.env.SECRET);
  const sessionData = buildSessionData(user, req);
  await services.redis.set(token, JSON.stringify(sessionData), {
    EX: TOKEN_TTL_SECONDS,
  });
  return token;
};

const RegisterUser = (services) => {
  return async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, phone, password, location, role } = parsed.data;

    try {
      const existing = await UserModel.findOne({
        email,
        isDeleted: false,
      }).lean();
      if (existing) {
        return res.status(409).json({ message: "email already registered" });
      }

      const user = new User(email, password, name, location, phone, role);
      const savedUser = await user.save();

      let token;
      try {
        token = await issueSession(services, savedUser, req);
      } catch (sessionError) {
        console.log(
          "RegisterUser session step failed, retrying once:",
          sessionError?.message,
        );
        try {
          token = await issueSession(services, savedUser, req);
        } catch (retryError) {
          console.log(
            "RegisterUser session retry failed:",
            retryError?.message,
          );
          token = createToken(
            savedUser._id,
            savedUser.email,
            process.env.SECRET,
          );
        }
      }

      return res.status(201).json({
        message: "user created",
        token,
        user: savedUser,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: "email already registered" });
      }
      console.log("RegisterUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const LoginUser = (services) => {
  return async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    try {
      const user = new User(email, password);
      const loggedUser = await user.login();

      if (!loggedUser) {
        return res.status(401).json({ message: "invalid credentials" });
      }

      const token = await issueSession(services, loggedUser, req);

      return res.json({ token, user: loggedUser });
    } catch (error) {
      console.log("LoginUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const LoginWithGoogle = (services) => {
  return async (req, res) => {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { idToken } = parsed.data;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: getGoogleAudiences(),
      });
      const payload = ticket.getPayload();

      if (!payload?.sub) {
        return res.status(401).json({ message: "invalid google token" });
      }

      if (payload.email && payload.email_verified === false) {
        return res.status(401).json({ message: "google email not verified" });
      }

      const { user } = await User.findOrCreateSocialUser({
        provider: "google",
        providerId: payload.sub,
        email: payload.email,
        name: payload.name,
        profileImage: payload.picture || null,
      });

      const token = await issueSession(services, user, req);

      return res.json({ token, user });
    } catch (error) {
      console.log("LoginWithGoogle error:", error);
      if (
        String(error?.message || "")
          .toLowerCase()
          .includes("token")
      ) {
        return res.status(401).json({ message: "invalid google token" });
      }
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const LoginWithApple = (services) => {
  return async (req, res) => {
    const parsed = appleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { identityToken, fullName } = parsed.data;

    try {
      const payload = await appleSigninAuth.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
      });

      if (!payload?.sub) {
        return res.status(401).json({ message: "invalid apple token" });
      }

      const composedName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();

      const { user } = await User.findOrCreateSocialUser({
        provider: "apple",
        providerId: payload.sub,
        email: payload.email,
        name: composedName || undefined,
        profileImage: null,
      });

      const token = await issueSession(services, user, req);

      return res.json({ token, user });
    } catch (error) {
      console.log("LoginWithApple error:", error);
      if (
        String(error?.message || "")
          .toLowerCase()
          .includes("token")
      ) {
        return res.status(401).json({ message: "invalid apple token" });
      }
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const LogoutUser = (services) => {
  return async (req, res) => {
    try {
      const token = extractToken(req.headers["authorization"]);
      if (!token) {
        return res.status(400).json({ message: "no token provided" });
      }

      await services.redis.del(token);

      await services.redis.set(`blacklist:${token}`, "1", {
        EX: BLACKLIST_TTL_SECONDS,
      });

      return res.json({ message: "logout successful" });
    } catch (error) {
      console.log("LogoutUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

export { RegisterUser, LoginUser, LoginWithGoogle, LoginWithApple, LogoutUser };
