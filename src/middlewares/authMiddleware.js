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
      const decoded = verifyToken(token, process.env.SECRET);
      if (!decoded) {
        return res.status(401).json({ message: "invalid or expired token" });
      }

      const blacklisted = await services.redis.get(`blacklist:${token}`);
      if (blacklisted) {
        return res.status(401).json({ message: "token revoked" });
      }
      const sessionRaw = await services.redis.get(token);
      if (!sessionRaw) {
        return res
          .status(401)
          .json({ message: "session expired, please login again" });
      }

      let sessionData;
      try {
        sessionData = JSON.parse(sessionRaw);
      } catch {
        return res
          .status(401)
          .json({ message: "session expired, please login again" });
      }

      if (!sessionData?.user || !sessionData.user._id) {
        return res
          .status(401)
          .json({ message: "session expired, please login again" });
      }

      req.user = sessionData.user;
      req.user.token = token;
      req.session = {
        loginAt: sessionData.loginAt,
        ip: sessionData.ip,
        userAgent: sessionData.userAgent,
      };

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