import jwt from "jsonwebtoken";

/*
* function name: createToken
* function Description: creates jwt token
* arguments: id, email, secret
* return: jwt token
*/

const createToken = (id, email, secret) => {
  return jwt.sign(
    { id, email },
    secret,
    { expiresIn: "1h" }
  );
};

/*
* function name: verifyToken
* function Description: verifies jwt token
* arguments: token, secret
* return: decoded token
*/

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.log(error);
    return null;
  }
};

export {
  createToken,
  verifyToken,
};