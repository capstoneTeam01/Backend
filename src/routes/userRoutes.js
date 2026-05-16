import express from "express";

import {
  GetAllUsers,
  GetUser,
  UpdateUser,
  DeleteUser,
} from "../handlers/userHandler.js";

import { AuthMiddleware } from "../middlewares/authMiddleware.js";

const userRoutes = (services) => {
  const router = express.Router();

  router.get("/", GetAllUsers());

  router.get(
    "/me",
    AuthMiddleware(services),
    GetUser()
  );

  router.put(
    "/update",
    AuthMiddleware(services),
    UpdateUser()
  );

  router.delete(
    "/delete",
    AuthMiddleware(services),
    DeleteUser(services)
  );

  return router;
};

export default userRoutes;