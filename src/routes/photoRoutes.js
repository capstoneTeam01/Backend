import express from "express";

import {
  GetPhotoDetails,
  GetPhotoHistory,
  UploadPhoto,
  UpdateRepairStatus,
  UpdateChosenProvider,
   SubmitRepairFeedback,
} from "../handlers/photoHandler.js";

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

  router.get(
    "/history",
    AuthMiddleware(services),
    GetPhotoHistory()
  );

  router.get(
    "/:photoId",
    AuthMiddleware(services),
    GetPhotoDetails()
  );
  router.patch( "/:photoId/status", AuthMiddleware(services), UpdateRepairStatus());
  router.patch("/:photoId/chosen-provider", AuthMiddleware(services), UpdateChosenProvider());
  router.post(
  "/:photoId/feedback",
  AuthMiddleware(services),
  SubmitRepairFeedback()
);

  return router;
};

export default photoRoutes;