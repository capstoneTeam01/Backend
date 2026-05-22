import express from "express";

import { UploadPhoto } from "../handlers/photoHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const photoRoutes = (services) => {
  const router = express.Router();

  router.post(
    "/upload",
    AuthMiddleware(services),
    upload.single("image"),
    UploadPhoto()
  );

  return router;
};

export default photoRoutes;
