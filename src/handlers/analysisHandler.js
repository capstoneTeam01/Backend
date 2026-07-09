import mongoose from "mongoose";

import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { analyzeImageWithAI } from "../services/aiAnalysisService.js";
import { generateRecommendation } from "../services/recommendationService.js";
import { generateAndCacheDiyInstructions } from "../services/diyGenerationJobService.js";
import { detectPipeOutlineWithYolo } from "../services/yoloSegmentationService.js";

const isLowConfidence = (analysisResult) => {
  const confidence = analysisResult?.confidence || "Low";

  return confidence.toLowerCase() === "low";
};

const isNoIssueDetected = (analysisResult) => {
  const analysisStatus = String(
    analysisResult?.analysisStatus || ""
  ).toUpperCase();

  return analysisStatus === "NO_ISSUE_DETECTED";
};

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

      const userId = req.user._id || req.user.id;

      let finalImageUrl = imageUrl;
      let photo = null;

      if (photoId) {
        photo = await PhotoAnalysisModel.findOne({
          _id: photoId,
          userId: userId,
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

      const lowConfidence = isLowConfidence(finalAnalysisResult);
      const noIssueDetected = isNoIssueDetected(finalAnalysisResult);

      let responsePhotoId = null;
      let diyGenerationStatus = "not_started";
      let diyGenerationReason = null;

      if (lowConfidence) {
        diyGenerationStatus = "skipped";
        diyGenerationReason = "LOW_CONFIDENCE";
      }

      if (noIssueDetected) {
        diyGenerationStatus = "skipped";
        diyGenerationReason = "NO_ISSUE_DETECTED";
      }

      if (photo) {
        const serializedAnalysis = JSON.stringify(finalAnalysisResult);

        photo.detectedObject = analysisResult.detectedObject;
        photo.aiResponse = serializedAnalysis;
        photo.diyInstructions = null;
        photo.diyGeneratedAt = null;

        responsePhotoId = photo._id.toString();

        if (lowConfidence || noIssueDetected) {
          photo.diyGenerationStatus = "skipped";
          photo.diyGenerationReason = lowConfidence
            ? "LOW_CONFIDENCE"
            : "NO_ISSUE_DETECTED";

          await photo.save();
        } else {
          photo.diyGenerationStatus = "pending";
          photo.diyGenerationReason = null;

          await photo.save();

          diyGenerationStatus = "pending";
          diyGenerationReason = null;

          generateAndCacheDiyInstructions({
            photoId: responsePhotoId,
            userId: userId,
            analysisResult: finalAnalysisResult,
            urgency: finalAnalysisResult.urgency,
            expectedAiResponse: serializedAnalysis,
          }).catch((error) => {
            console.error(
              "Unable to start background DIY generation:",
              error.message
            );
          });
        }
      }

      const analysisForResponse = {
        ...finalAnalysisResult,
        photoId: responsePhotoId,
      };

      let responseMessage = "Image analysis completed";

      if (lowConfidence) {
        responseMessage =
          "Image analysis completed with low confidence. Please upload a clearer photo.";
      }

      if (noIssueDetected) {
        responseMessage =
          "Image analysis completed. No visible plumbing issue was detected.";
      }

      return res.status(200).json({
        success: true,
        message: responseMessage,
        photoId: responsePhotoId,
        diyGenerationStatus: diyGenerationStatus,
        diyGenerationReason: diyGenerationReason,
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
          diyGenerationReason: null,
          diyInstructions: photo.diyInstructions,
        });
      }

      if (photo.diyGenerationStatus === "pending") {
        return res.status(202).json({
          success: true,
          message: "DIY instructions are still being prepared",
          diyGenerationStatus: "pending",
          diyGenerationReason: null,
          diyInstructions: null,
        });
      }

      if (photo.diyGenerationStatus === "skipped") {
        let message =
          "DIY instructions were not generated for this scan.";

        if (photo.diyGenerationReason === "LOW_CONFIDENCE") {
          message =
            "DIY instructions were not generated because the image analysis confidence was low. Please upload a clearer photo.";
        }

        if (photo.diyGenerationReason === "NO_ISSUE_DETECTED") {
          message =
            "DIY instructions were not generated because no visible plumbing issue was detected.";
        }

        return res.status(409).json({
          success: false,
          message: message,
          diyGenerationStatus: "skipped",
          diyGenerationReason:
            photo.diyGenerationReason || null,
          diyInstructions: null,
        });
      }

      if (photo.diyGenerationStatus === "failed") {
        return res.status(500).json({
          success: false,
          message:
            "DIY instruction generation failed. Please try analyzing the image again.",
          diyGenerationStatus: "failed",
          diyGenerationReason:
            photo.diyGenerationReason || null,
          diyInstructions: null,
        });
      }

      return res.status(409).json({
        success: false,
        message: "DIY instructions are not available",
        diyGenerationStatus:
          photo.diyGenerationStatus || "not_started",
        diyGenerationReason:
          photo.diyGenerationReason || null,
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

      const result = await detectPipeOutlineWithYolo({
        imageBase64: imageBase64,
      });

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

export {
  AnalyzeImage,
  GetDiyInstructions,
  AnalyzeIssueRegion,
};
