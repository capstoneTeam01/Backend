import { User, UserModel } from "../internal/db/user.js";
import { createToken } from "../utils/jwt.js";
import { registerSchema, loginSchema } from "../validators/authValidators.js";

const TOKEN_TTL_SECONDS = 60 * 60;
const BLACKLIST_TTL_SECONDS = 60 * 60;

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

const RegisterUser = (services) => {
  return async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, location, role } = parsed.data;

    try {
      const existing = await UserModel.findOne({
        email,
        isDeleted: false,
      }).lean();
      if (existing) {
        return res.status(409).json({ message: "email already registered" });
      }

      const user = new User(email, password, name, location, role);
      const savedUser = await user.save();

      const token = createToken(
        savedUser._id,
        savedUser.email,
        process.env.SECRET,
      );

      const sessionData = buildSessionData(savedUser, req);
      await services.redis.set(token, JSON.stringify(sessionData), {
        EX: TOKEN_TTL_SECONDS,
      });

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

      const token = createToken(
        loggedUser._id,
        loggedUser.email,
        process.env.SECRET,
      );

      const sessionData = buildSessionData(loggedUser, req);
      await services.redis.set(token, JSON.stringify(sessionData), {
        EX: TOKEN_TTL_SECONDS,
      });

      return res.json({ token, user: loggedUser });
    } catch (error) {
      console.log("LoginUser error:", error);
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

      // remove active session
      await services.redis.del(token);

      // add to blacklist
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

export { RegisterUser, LoginUser, LogoutUser };
