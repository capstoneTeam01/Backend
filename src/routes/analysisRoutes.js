import express from "express";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";
import {
  AnalyzeImage,
  AnalyzeIssueRegion,
  GetDiyInstructions,
} from "../handlers/analysisHandler.js";

const analysisRoutes = (services) => {
  const router = express.Router();

  router.post(
    "/",
    AuthMiddleware(services),
    AnalyzeImage()
  );
  router.post("/region", AnalyzeIssueRegion());
  router.post(
    "/diy-instructions",
    AuthMiddleware(services),
    GetDiyInstructions()
  );

  return router;
};

export default analysisRoutes;