import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { analyzeImageWithAI } from "../services/aiAnalysisService.js";
import { generateRecommendation } from "../services/recommendationService.js";
import { generateDiyInstructions } from "../services/diyInstructionService.js";
import { detectPipeOutlineWithYolo } from "../services/yoloSegmentationService.js";

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

      if (photo) {
        photo.detectedObject = analysisResult.detectedObject;
        photo.aiResponse = JSON.stringify(finalAnalysisResult);
        await photo.save();
      }

      return res.status(200).json({
        success: true,
        message: "Image analysis completed",
        analysis: finalAnalysisResult,
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
      const { analysisResult, urgency } = req.body;

      if (!analysisResult) {
        return res.status(400).json({
          success: false,
          message: "analysisResult is required",
        });
      }

      const diyInstructions = await generateDiyInstructions(
        analysisResult,
        urgency
      );

      return res.status(200).json({
        success: true,
        message: "DIY instructions generated",
        diyInstructions,
      });
    } catch (error) {
      console.error("DIY instructions error:", error);

      return res.status(500).json({
        success: false,
        message: "DIY instructions failed",
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
          message: "No plumbing object detected. Point the camera at a pipe or fixture.",
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