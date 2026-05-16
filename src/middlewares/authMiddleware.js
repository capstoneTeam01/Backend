/*
* function name: AuthMiddleware
* function Description: validates user token using redis
* arguments: services
* return: middleware function
*/

const AuthMiddleware = (services) => {
  return async (req, res, next) => {
    const token = req.headers["authorization"];

    if (!token) {
      return res.status(401).json({
        message: "unauthorized request",
      });
    }

    let loggedUser = await services.redis.get(token);

    if (!loggedUser) {
      return res.status(401).json({
        message: "invalid token",
      });
    }

    req.user = JSON.parse(loggedUser);
    req.user.token = token;

    next();
  };
};

export { AuthMiddleware };