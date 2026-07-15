import { User, UserModel } from "../internal/db/user.js";
import bcrypt from "bcrypt";
import { uploadToBlob } from "../services/blobStorage.js";
import { preprocessAvatar } from "../utils/imagePreprocessing.js";
import { validateAvatarImage } from "../utils/imageValidation.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60;

const refreshUserSession = async (services, req, updatedUser) => {
  const refreshedSession = {
    user: updatedUser,
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
};

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
      const {
        name,
        location,
        password,
        phone,
        notificationSettings,
        aiSettings,
        profileImage,
      } = req.body;

      const update = {};
      if (name) update.name = name;
      if (location) update.location = location;
      if (phone !== undefined) update.phone = phone;
      if (password) update.password = await bcrypt.hash(password, SALT_ROUNDS);

      if (
        typeof profileImage === "string" &&
        profileImage.trim().startsWith("http")
      ) {
        update.profileImage = profileImage.trim();
      }

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

      if (
        aiSettings &&
        typeof aiSettings === "object" &&
        aiSettings.useLocalLlm !== undefined
      ) {
        update["aiSettings.useLocalLlm"] =
          Boolean(aiSettings.useLocalLlm);
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ message: "no fields to update" });
      }

      await UserModel.findByIdAndUpdate(req.user._id, update);
      const updated = await User.getById(req.user._id);

      await refreshUserSession(services, req, updated);

      return res.json({ message: "user updated successfully", user: updated });
    } catch (error) {
      console.log("UpdateUser error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const UploadAvatar = (services) => {
  return async (req, res) => {
    try {
      const validation = await validateAvatarImage(req.file);

      if (!validation.valid) {
        return res.status(400).json({
          error: "VALIDATION_FAILED",
          message: validation.message,
        });
      }

      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({
          message: "Upload failed: storage is not configured",
        });
      }

      const preprocessed = await preprocessAvatar(req.file.buffer);
      const userId = req.user._id || req.user.id;
      const pathname = `avatars/${userId}/${Date.now()}.${preprocessed.extension}`;

      const blob = await uploadToBlob(
        preprocessed.buffer,
        pathname,
        preprocessed.mimetype,
      );

      await UserModel.findByIdAndUpdate(userId, {
        profileImage: blob.url,
      });

      const updated = await User.getById(userId);
      await refreshUserSession(services, req, updated);

      return res.status(200).json({
        message: "Profile image updated successfully",
        profileImage: blob.url,
        user: updated,
      });
    } catch (error) {
      console.log("UploadAvatar error:", error);
      return res.status(500).json({
        message: "Upload failed. Please try again.",
      });
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

export { GetAllUsers, GetUser, DeleteUser, UpdateUser, UploadAvatar };
