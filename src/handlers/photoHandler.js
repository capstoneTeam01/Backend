import mongoose from "mongoose";
import { PhotoAnalysis } from "../internal/db/photoAnalysis.js";
import { uploadToBlob } from "../services/blobStorage.js";
import { preprocessImageForAI } from "../utils/imagePreprocessing.js";
import { validateImage } from "../utils/imageValidation.js";

const parseStoredAnalysis = (aiResponse) => {
  if (!aiResponse) {
    return null;
  }

  if (typeof aiResponse === "object") {
    return aiResponse;
  }

  if (typeof aiResponse !== "string") {
    return null;
  }

  try {
    const parsedAnalysis = JSON.parse(aiResponse);

    if (!parsedAnalysis || typeof parsedAnalysis !== "object") {
      return null;
    }

    return parsedAnalysis;
  } catch (error) {
    return null;
  }
};

const UploadPhoto = () => {
  return async (req, res) => {
    try {
      const validation = await validateImage(req.file);

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

      const preprocessed = await preprocessImageForAI(req.file.buffer);

      const userId = req.user._id || req.user.id;
      const pathname = `uploads/${userId}/${Date.now()}.${preprocessed.extension}`;

      const blob = await uploadToBlob(
        preprocessed.buffer,
        pathname,
        preprocessed.mimetype
      );

      const photo = new PhotoAnalysis(
        userId,
        null,
        null,
        null,
        null,
        "",
        blob.url
      );

      const saved = await photo.save();

      return res.status(201).json({
        message: "Image uploaded successfully",
        url: blob.url,
        id: saved._id,
        width: preprocessed.width,
        height: preprocessed.height,
        originalWidth: validation.width,
        originalHeight: validation.height,
      });
    } catch (error) {
      console.error("Upload error:", error);

      return res.status(500).json({
        message: "Upload failed. Please try again.",
      });
    }
  };
};

const GetPhotoHistory = () => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;

      const photos = await PhotoAnalysis.getRecentAnalyzedByUserId(userId);

      const history = [];

      for (const photo of photos) {
        const analysis = parseStoredAnalysis(photo.aiResponse);

        if (!analysis) {
          console.log("Could not read analysis for photo:", photo._id);
          continue;
        }

        const historyItem = {
          photoId: photo._id,
          imageUrl: photo.imageUrl,
          detectedObject: photo.detectedObject,
          analysis: analysis,
          diyGenerationStatus:
            photo.diyGenerationStatus || "not_started",
          createdAt: photo.createdAt,
        };

        history.push(historyItem);
      }

      return res.status(200).json({
        success: true,
        history: history,
      });
    } catch (error) {
      console.error("Photo history error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load photo history",
      });
    }
  };
};

const GetPhotoDetails = () => {
  return async (req, res) => {
    try {
      const { photoId } = req.params;

      if (!photoId) {
        return res.status(400).json({
          success: false,
          message: "photoId is required",
        });
      }

      if (!mongoose.isValidObjectId(photoId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid photoId",
        });
      }

      const userId = req.user._id || req.user.id;

      const photo = await PhotoAnalysis.getByIdForUser(
        photoId,
        userId
      );

      if (!photo) {
        return res.status(404).json({
          success: false,
          message: "Photo analysis not found",
        });
      }

      const analysis = parseStoredAnalysis(photo.aiResponse);

      if (!analysis) {
        return res.status(409).json({
          success: false,
          message: "Photo analysis has not been completed",
        });
      }

      return res.status(200).json({
        success: true,
        scan: {
          photoId: photo._id,
          imageUrl: photo.imageUrl,
          detectedObject: photo.detectedObject,
          analysis: analysis,
          diyInstructions: photo.diyInstructions || null,
          diyGenerationStatus:
            photo.diyGenerationStatus || "not_started",
          diyGeneratedAt: photo.diyGeneratedAt || null,
          createdAt: photo.createdAt,
        },
      });
    } catch (error) {
      console.error("Photo details error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load photo details",
      });
    }
  };
};

export {
  UploadPhoto,
  GetPhotoHistory,
  GetPhotoDetails,
};