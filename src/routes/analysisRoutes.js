import express from "express";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";
import { AnalyzeImage } from "../handlers/analysisHandler.js";

const analysisRoutes = (services) => {
  const router = express.Router();

  router.post(
    "/",
    AuthMiddleware(services),
    AnalyzeImage()
  );

  return router;
};

export default analysisRoutes;