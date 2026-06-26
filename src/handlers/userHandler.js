import { User, UserModel } from "../internal/db/user.js";
import bcrypt from "bcrypt";
const SALT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60;
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

const GetUser = (services) => {
  return async (req, res) => {
    try {
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

const UpdateUser = (services) => {
  return async (req, res) => {
    try {
      const { name, location, password, phone, notificationSettings } =
        req.body;

      const update = {};
      if (name) update.name = name;
      if (location) update.location = location;
      if (phone !== undefined) update.phone = phone;
      if (password) update.password = await bcrypt.hash(password, SALT_ROUNDS);

      if (notificationSettings && typeof notificationSettings === "object") {
        if (notificationSettings.push !== undefined) {
          update["notificationSettings.push"] = Boolean(
            notificationSettings.push,
          );
        }
        if (notificationSettings.appointmentReminders !== undefined) {
          update["notificationSettings.appointmentReminders"] = Boolean(
            notificationSettings.appointmentReminders,
          );
        }
      }

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

      const refreshedSession = {
        user: updated,
        loginAt: req.session?.loginAt || new Date().toISOString(),
        ip: req.session?.ip || req.ip || "unknown",
        userAgent:
          req.session?.userAgent || req.headers["user-agent"] || "unknown",
      };

      await services.redis.set(
        req.user.token,
        JSON.stringify(refreshedSession),
        { EX: TOKEN_TTL_SECONDS },
      );

      return res.json({ message: "user updated successfully", user: updated });
    } catch (error) {
      console.log("UpdateUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const DeleteUser = (services) => {
  return async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res
          .status(400)
          .json({ message: "password is required to delete account" });
      }

      const ok = await User.verifyPassword(req.user._id, password);
      if (!ok) {
        return res.status(401).json({ message: "incorrect password" });
      }

      await User.softDelete(req.user._id);
      await services.redis.del(req.user.token);

      await services.redis.set(`blacklist:${req.user.token}`, "1", {
        EX: TOKEN_TTL_SECONDS,
      });

      return res.json({ message: "user deleted successfully" });
    } catch (error) {
      console.log("DeleteUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

export { GetAllUsers, GetUser, DeleteUser, UpdateUser };
