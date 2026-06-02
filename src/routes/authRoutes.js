import express from "express";

import {
  RegisterUser,
  LoginUser,
  LogoutUser,
} from "../handlers/authHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";

const authRoutes = (services) => {
  const router = express.Router();

  // public
  router.post("/register", RegisterUser(services));
  router.post("/login", LoginUser(services));

  // protected — must be logged in to log out
  router.post("/logout", AuthMiddleware(services), LogoutUser(services));

  return router;
};

export default authRoutes;
