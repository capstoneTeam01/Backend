import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { generateDiyInstructions } from "./diyInstructionService.js";

const activeDiyJobs = new Set();

const generateAndCacheDiyInstructions = async ({
  photoId,
  userId,
  analysisResult,
  urgency,
  expectedAiResponse,
}) => {
  if (!photoId || !userId || !analysisResult || !expectedAiResponse) {
    console.error(
      "Background DIY generation could not start because required data is missing."
    );

    return false;
  }

  const jobKey = `${photoId}:${expectedAiResponse}`;

  if (activeDiyJobs.has(jobKey)) {
    console.log("DIY generation is already running for photo:", photoId);
    return false;
  }

  activeDiyJobs.add(jobKey);

  try {
    console.log("Background DIY generation started:", photoId);

    const diyInstructions = await generateDiyInstructions(
      analysisResult,
      urgency || "Low"
    );

    const updateResult = await PhotoAnalysisModel.updateOne(
      {
        _id: photoId,
        userId: userId,
        isDeleted: false,
        aiResponse: expectedAiResponse,
        diyGenerationStatus: "pending",
      },
      {
        $set: {
          diyInstructions: diyInstructions,
          diyGeneratedAt: new Date(),
          diyGenerationStatus: "completed",
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      console.log(
        "DIY result was not saved because the photo analysis changed or no longer exists:",
        photoId
      );

      return false;
    }

    console.log("Background DIY generation completed:", photoId);

    return true;
  } catch (error) {
    console.error(
      "Background DIY generation failed:",
      photoId,
      error.message
    );

    try {
      await PhotoAnalysisModel.updateOne(
        {
          _id: photoId,
          userId: userId,
          isDeleted: false,
          aiResponse: expectedAiResponse,
          diyGenerationStatus: "pending",
        },
        {
          $set: {
            diyGenerationStatus: "failed",
          },
        }
      );
    } catch (statusUpdateError) {
      console.error(
        "Failed to update DIY generation status:",
        statusUpdateError.message
      );
    }

    return false;
  } finally {
    activeDiyJobs.delete(jobKey);
  }
};

export { generateAndCacheDiyInstructions };