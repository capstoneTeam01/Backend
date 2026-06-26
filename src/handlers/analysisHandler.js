import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { analyzeImageWithAI } from "../services/aiAnalysisService.js";
import { generateRecommendation } from "../services/recommendationService.js";

import { detectPipeOutlineWithYolo } from "../services/yoloSegmentationService.js";
import { generateAndCacheDiyInstructions } from "../services/diyGenerationJobService.js";
import mongoose from "mongoose";

const AnalyzeImage = () => {
  return async (req, res) => {
    try {
      const { photoId, imageUrl } = req.body;

      if (!photoId && !imageUrl) {
        return res.status(400).json({
          success: false,
          message: "photoId or imageUrl is required",
        });
      }

      let finalImageUrl = imageUrl;
      let photo = null;

      if (photoId) {
        photo = await PhotoAnalysisModel.findOne({
          _id: photoId,
          userId: req.user._id || req.user.id,
          isDeleted: false,
        });

        if (!photo) {
          return res.status(404).json({
            success: false,
            message: "Photo not found",
          });
        }

        finalImageUrl = photo.imageUrl;
      }

      if (!finalImageUrl) {
        return res.status(400).json({
          success: false,
          message: "Image URL is missing",
        });
      }

      const analysisResult = await analyzeImageWithAI(finalImageUrl);

      const finalAnalysisResult = await generateRecommendation(
        analysisResult,
        req.body.location
      );

      let responsePhotoId = null;
      let diyGenerationStatus = "not_started";

      if (photo) {
        const userId = req.user._id || req.user.id;
        const serializedAnalysis = JSON.stringify(finalAnalysisResult);

        photo.detectedObject = analysisResult.detectedObject;
        photo.aiResponse = serializedAnalysis;

        // Clear any previous DIY result before starting a new generation job.
        photo.diyInstructions = null;
        photo.diyGeneratedAt = null;
        photo.diyGenerationStatus = "pending";

        await photo.save();

        responsePhotoId = photo._id.toString();
        diyGenerationStatus = "pending";

        generateAndCacheDiyInstructions({
          photoId: responsePhotoId,
          userId: userId,
          analysisResult: finalAnalysisResult,
          urgency: finalAnalysisResult.urgency || "Low",
          expectedAiResponse: serializedAnalysis,
        }).catch((error) => {
          console.error(
            "Unable to start background DIY generation:",
            error.message
          );
        });
      }

      const analysisForResponse = {
        ...finalAnalysisResult,
        photoId: responsePhotoId,
      };

      return res.status(200).json({
        success: true,
        message: "Image analysis completed",
        photoId: responsePhotoId,
        diyGenerationStatus: diyGenerationStatus,
        analysis: analysisForResponse,
      });
    } catch (error) {
      console.error("Image analysis error:", error);

      return res.status(500).json({
        success: false,
        message: "Image analysis failed",
      });
    }
  };
};



const GetDiyInstructions = () => {
  return async (req, res) => {
    try {
      const { photoId, analysisResult } = req.body;

      let requestedPhotoId = photoId;

      if (
        !requestedPhotoId &&
        analysisResult &&
        analysisResult.photoId
      ) {
        requestedPhotoId = analysisResult.photoId;
      }

      if (!requestedPhotoId) {
        return res.status(400).json({
          success: false,
          message: "photoId is required",
        });
      }

      if (!mongoose.isValidObjectId(requestedPhotoId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid photoId",
        });
      }

      const userId = req.user._id || req.user.id;

      const photo = await PhotoAnalysisModel.findOne({
        _id: requestedPhotoId,
        userId: userId,
        isDeleted: false,
      });

      if (!photo) {
        return res.status(404).json({
          success: false,
          message: "Photo analysis not found",
        });
      }

      if (
        photo.diyGenerationStatus === "completed" &&
        photo.diyInstructions
      ) {
        return res.status(200).json({
          success: true,
          message: "DIY instructions retrieved",
          diyGenerationStatus: "completed",
          diyInstructions: photo.diyInstructions,
        });
      }

      if (photo.diyGenerationStatus === "pending") {
        return res.status(202).json({
          success: true,
          message: "DIY instructions are still being prepared",
          diyGenerationStatus: "pending",
          diyInstructions: null,
        });
      }

      return res.status(409).json({
        success: false,
        message: "DIY instructions are not available",
        diyGenerationStatus:
          photo.diyGenerationStatus || "not_started",
        diyInstructions: null,
      });
    } catch (error) {
      console.error("DIY instruction retrieval error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve DIY instructions",
      });
    }
  };
};

const AnalyzeIssueRegion = () => {
  return async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          success: false,
          message: "imageBase64 is required",
        });
      }

      const result = await detectPipeOutlineWithYolo({ imageBase64 });

      if (!result?.issueRegion) {
        return res.status(404).json({
          success: false,
          message:
            "No plumbing object detected. Point the camera at a pipe or fixture.",
          brightness: result?.brightness ?? null,
        });
      }

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Issue region detection error:", error);

      return res.status(500).json({
        success: false,
        message: "Issue region detection failed",
      });
    }
  };
};

export { AnalyzeImage, GetDiyInstructions, AnalyzeIssueRegion };