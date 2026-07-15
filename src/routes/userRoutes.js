import express from "express";
import {
  GetAllUsers,
  GetUser,
  UpdateUser,
  DeleteUser,
  UploadAvatar,
} from "../handlers/userHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const userRoutes = (services) => {
  const router = express.Router();

  // all user routes require authentication
  router.use(AuthMiddleware(services));

  router.get("/", GetAllUsers(services));
  router.get("/me", GetUser(services));
  router.put("/update", UpdateUser(services));
  router.post("/avatar", upload.single("image"), UploadAvatar(services));
  router.delete("/delete", DeleteUser(services));

  return router;
};

export default userRoutes;
