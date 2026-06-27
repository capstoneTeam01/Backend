import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { generateDiyInstructions } from "./diyInstructionService.js";

const activeDiyJobs = new Set();

const hasValidDiyInstructions = (diyInstructions) => {
  if (!diyInstructions || typeof diyInstructions !== "object") {
    return false;
  }

  if (!Array.isArray(diyInstructions.repairSteps)) {
    return false;
  }

  if (diyInstructions.repairSteps.length < 3) {
    return false;
  }

  if (!Array.isArray(diyInstructions.toolsNeeded)) {
    return false;
  }

  if (!Array.isArray(diyInstructions.safetyWarnings)) {
    return false;
  }

  return true;
};

const markDiyGenerationFailed = async ({
  photoId,
  userId,
  expectedAiResponse,
  reason,
}) => {
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
          diyGenerationReason: reason,
          diyInstructions: null,
          diyGeneratedAt: null,
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to update DIY generation failure status:",
      error.message
    );
  }
};

const generateAndCacheDiyInstructions = async ({
  photoId,
  userId,
  analysisResult,
  urgency,
  expectedAiResponse,
}) => {
  if (
    !photoId ||
    !userId ||
    !analysisResult ||
    !expectedAiResponse
  ) {
    console.error(
      "Background DIY generation could not start because required data is missing."
    );

    return false;
  }

  const jobKey = `${photoId}:${expectedAiResponse}`;

  if (activeDiyJobs.has(jobKey)) {
    console.log(
      "DIY generation is already running for photo:",
      photoId
    );

    return false;
  }

  activeDiyJobs.add(jobKey);

  try {
    console.log(
      "Background DIY generation started:",
      photoId
    );

    const diyInstructions =
      await generateDiyInstructions(
        analysisResult,
        urgency || "Low"
      );

    if (!hasValidDiyInstructions(diyInstructions)) {
      console.error(
        "DIY generation returned incomplete instructions:",
        photoId
      );

      await markDiyGenerationFailed({
        photoId: photoId,
        userId: userId,
        expectedAiResponse: expectedAiResponse,
        reason: "INVALID_DIY_RESULT",
      });

      return false;
    }

    const updateResult =
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
            diyInstructions: diyInstructions,
            diyGeneratedAt: new Date(),
            diyGenerationStatus: "completed",
            diyGenerationReason: null,
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

    console.log(
      "Background DIY generation completed:",
      photoId
    );

    console.log(
      "DIY instruction source:",
      diyInstructions.source
    );

    return true;
  } catch (error) {
    console.error(
      "Background DIY generation failed:",
      photoId,
      error.message
    );

    await markDiyGenerationFailed({
      photoId: photoId,
      userId: userId,
      expectedAiResponse: expectedAiResponse,
      reason: "DIY_GENERATION_ERROR",
    });

    return false;
  } finally {
    activeDiyJobs.delete(jobKey);
  }
};

export { generateAndCacheDiyInstructions };