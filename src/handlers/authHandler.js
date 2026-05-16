import { User } from "../internal/db/user.js";
import { createToken } from "../utils/jwt.js";

/*
* function name: RegisterUser
* function Description: registers new user
* arguments: req, res
* return: json response
*/

const RegisterUser = () => {
  return async (req, res) => {
    const { email, password, name, location } = req.body;

    const user = new User(
      email,
      password,
      name,
      location
    );

    await user.save();

    res.status(201).json({
      message: "user created",
    });
  };
};

/*
* function name: LoginUser
* function Description: validates user credentials
* arguments: req, res
* return: jwt token
*/

const LoginUser = (services) => {
  return async (req, res) => {
    const { email, password } = req.body;

    const user = new User(email, password);

    const loggedUser = await user.login();

    if (!loggedUser) {
      return res.status(401).json({
        message: "invalid credentials",
      });
    }

    const token = createToken(
      loggedUser._id,
      loggedUser.email,
      process.env.SECRET
    );

    await services.redis.set(
      token,
      JSON.stringify(loggedUser),
      {
        EX: 60 * 60,
      }
    );

    res.json({
      token,
      user: loggedUser,
    });
  };
};

/*
* function name: LogoutUser
* function Description: logs out current user
* arguments: req, res
* return: json response
*/

const LogoutUser = (services) => {
  return async (req, res) => {
    const token = req.headers["authorization"];

    await services.redis.del(token);

    res.json({
      message: "logout successful",
    });
  };
};

export {
  RegisterUser,
  LoginUser,
  LogoutUser,
};