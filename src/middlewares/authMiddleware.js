import { verifyToken } from "../utils/jwt.js";

const extractToken = (header) => {
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7) : header;
};

const AuthMiddleware = (services) => {
  return async (req, res, next) => {
    try {
      const token = extractToken(req.headers["authorization"]);

      if (!token) {
        return res.status(401).json({ message: "unauthorized request" });
      }

      // verify JWT
      const decoded = verifyToken(token, process.env.SECRET);
      if (!decoded) {
        return res.status(401).json({ message: "invalid or expired token" });
      }

      const blacklisted = await services.redis.get(`blacklist:${token}`);
      if (blacklisted) {
        return res.status(401).json({ message: "token revoked" });
      }

      // check active session in redis
      const sessionRaw = await services.redis.get(token);
      if (!sessionRaw) {
        return res
          .status(401)
          .json({ message: "session expired, please login again" });
      }

      const sessionData = JSON.parse(sessionRaw);

      req.user = sessionData.user;
      req.user.token = token;
      req.session = {
        loginAt: sessionData.loginAt,
        ip: sessionData.ip,
        userAgent: sessionData.userAgent,
      };

      // enforce that the JWT subject matches the cached session
      if (String(req.user._id) !== String(decoded.id)) {
        return res.status(401).json({ message: "token mismatch" });
      }

      next();
    } catch (error) {
      console.log("AuthMiddleware error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

/*
 * function name: RequireRole
 * function Description: role-based guard, use AFTER AuthMiddleware
 * arguments: ...allowedRoles
 * return: middleware function
 */
const RequireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "unauthorized request" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "forbidden" });
    }
    next();
  };
};

export { AuthMiddleware, RequireRole };
