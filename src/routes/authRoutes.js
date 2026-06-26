import express from "express";

import {
  RegisterUser,
  LoginUser,
  LoginWithGoogle,
  LoginWithApple,
  LogoutUser,
} from "../handlers/authHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";

const authRoutes = (services) => {
  const router = express.Router();
  router.post("/register", RegisterUser(services));
  router.post("/login", LoginUser(services));
  router.post("/google", LoginWithGoogle(services));
  router.post("/apple", LoginWithApple(services));

  router.post("/logout", AuthMiddleware(services), LogoutUser(services));

  return router;
};

export default authRoutes;
