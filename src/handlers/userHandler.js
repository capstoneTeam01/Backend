import { User } from "../internal/db/user.js";

/*Function Name: GetAllUsers
Parameters: services
Function description:Retruns all the users from the database
Return value: []User
*/
const GetAllUsers = () => {
  return async (req, res) => {
    const users = await User.getAll();
    // console.log(users);
    res.status(200).json(users);
  };
};
const GetUser = () => {
  return async (req, res) => {
    // user id is received from the middleware
    const user = await User.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  };
};

const DeleteUser = (services) => {
  return async (req, res) => {
    await User.softDelete(req.user.id);
    await services.redis.del(req.user.token);
    res.json({
      message: "User deleted successfully",
    });
  };
};

const UpdateUser = () => {
  return async (req, res) => {
    let profileImage = null;
    if (req.file) {
      profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }
    const { email, password, name, location } = req.body;
    const user = new User(email, password, name, location, profileImage);
    await user.UpdateById(req.user.id);
    res.json({
      message: "User updated successfully",
    });
  };
};

export { GetAllUsers, GetUser, DeleteUser, UpdateUser };