import express from "express";

import {
  RegisterUser,
  LoginUser,
  LogoutUser,
} from "../handlers/authHandler.js";

const authRoutes = (services) => {
  const router = express.Router();

  router.post("/register", RegisterUser());
  router.post("/login", LoginUser(services));
  router.post("/logout", LogoutUser(services));

  return router;
};

export default authRoutes;