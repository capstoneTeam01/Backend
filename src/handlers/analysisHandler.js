import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { analyzeImageWithAI } from "../services/aiAnalysisService.js";

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

      if (photo) {
        photo.detectedObject = analysisResult.detectedObject;
        photo.aiResponse = JSON.stringify(analysisResult);
        await photo.save();
      }

      return res.status(200).json({
        success: true,
        message: "Image analysis completed",
        analysis: analysisResult,
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

export { AnalyzeImage };