import { User, UserModel } from "../internal/db/user.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60;

/*
 * function name: GetAllUsers
 * function Description: returns all non-deleted users (passwords stripped)
 * arguments: services
 * return: express handler
 */
const GetAllUsers = (services) => {
  return async (req, res) => {
    try {
      const users = await User.getAll();
      return res.status(200).json(users);
    } catch (error) {
      console.log("GetAllUsers error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

/*
 * function name: GetUser
 * function Description: returns the currently authenticated user
 * arguments: services
 * return: express handler
 */
const GetUser = (services) => {
  return async (req, res) => {
    try {
      // _id is populated by AuthMiddleware from the redis session
      const user = await User.getById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "user not found" });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.log("GetUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

/*
 * function name: UpdateUser
 * function Description: partial update of the current user; refreshes redis session
 * arguments: services
 * return: express handler
 */
const UpdateUser = (services) => {
  return async (req, res) => {
    try {
      const { name, location, password } = req.body;

      // only set fields that were provided — partial update
      const update = {};
      if (name) update.name = name;
      if (location) update.location = location;
      if (password) update.password = await bcrypt.hash(password, SALT_ROUNDS);
      if (req.file) {
        update.profileImage = {
          data: req.file.buffer,
          contentType: req.file.mimetype,
        };
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ message: "no fields to update" });
      }

      await UserModel.findByIdAndUpdate(req.user._id, update);
      const updated = await User.getById(req.user._id);

      // refresh redis session with updated user (password field is stripped by sanitize)
      await services.redis.set(
        req.user.token,
        JSON.stringify(updated),
        { EX: TOKEN_TTL_SECONDS }
      );

      return res.json({ message: "user updated successfully", user: updated });
    } catch (error) {
      console.log("UpdateUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

/*
 * function name: DeleteUser
 * function Description: soft-deletes current user, clears redis session
 * arguments: services
 * return: express handler
 */
const DeleteUser = (services) => {
  return async (req, res) => {
    try {
      await User.softDelete(req.user._id);
      await services.redis.del(req.user.token);
      return res.json({ message: "user deleted successfully" });
    } catch (error) {
      console.log("DeleteUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

export { GetAllUsers, GetUser, DeleteUser, UpdateUser };
