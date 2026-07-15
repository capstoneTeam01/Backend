import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { uploadToBlob } from "./blobStorage.js";
import { generateExpertTechnicalReport } from "./expertTechnicalReportService.js";
import { generateIssueReportPdf } from "./pdfReportService.js";

const activeExpertReportJobs = new Set();

const parseAnalysis = (aiResponse) => {
  if (!aiResponse || typeof aiResponse !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(aiResponse);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const buildReportData = (photo, analysis) => {
  return {
    photoId: photo._id.toString(),
    imageUrl: analysis.imageUrl || photo.imageUrl,
    detectedIssue: analysis.detectedIssue,
    detectedObject: analysis.detectedObject || photo.detectedObject,
    category: analysis.category || "Plumbing",
    urgency: analysis.urgency,
    confidence: analysis.confidence,
    confidenceReason: analysis.confidenceReason,
    visualEvidence: analysis.visualEvidence || {},
    issuesToFix: analysis.issuesToFix || [],
    recommendedActions: analysis.recommendedActions || [],
    estimatedCostRange: analysis.estimatedCostRange,
    estimatedRepairTime: analysis.estimatedRepairTime,
    providerType: analysis.providerType,
  };
};

const markExpertReportFailed = async ({
  photoId,
  userId,
  expectedAiResponse,
  reason,
}) => {
  try {
    await PhotoAnalysisModel.updateOne(
      {
        _id: photoId,
        userId,
        isDeleted: false,
        aiResponse: expectedAiResponse,
        expertReportStatus: "pending",
      },
      {
        $set: {
          expertReportStatus: "failed",
          expertReportReason: reason,
          expertReportUrl: null,
          expertReportFilename: null,
          expertReportGeneratedAt: null,
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to update expert report failure status:",
      error.message
    );
  }
};

const generateAndCacheExpertReport = async ({
  photoId,
  userId,
  expectedAiResponse,
  useLocalLlm = false,
}) => {
  if (!photoId || !userId || !expectedAiResponse) {
    console.error(
      "Expert report generation could not start because required data is missing."
    );

    return false;
  }

  const jobKey = `${photoId}:${expectedAiResponse}`;

  if (activeExpertReportJobs.has(jobKey)) {
    console.log(
      "Expert report generation is already running for photo:",
      photoId
    );

    return false;
  }

  activeExpertReportJobs.add(jobKey);

  try {
    console.log(
      "Background expert report generation started:",
      photoId
    );

    const photo = await PhotoAnalysisModel.findOne({
      _id: photoId,
      userId,
      isDeleted: false,
      aiResponse: expectedAiResponse,
    }).lean();

    if (!photo) {
      console.log(
        "Expert report was not generated because the photo analysis changed or no longer exists:",
        photoId
      );

      return false;
    }

    const analysis = parseAnalysis(photo.aiResponse);

    if (!analysis) {
      await markExpertReportFailed({
        photoId,
        userId,
        expectedAiResponse,
        reason: "INVALID_ANALYSIS",
      });

      return false;
    }

    const reportData = buildReportData(photo, analysis);
    const technicalReport =
      await generateExpertTechnicalReport(
        reportData,
        { useLocalLlm }
      );

    const pdfBuffer =
      await generateIssueReportPdf({
        ...reportData,
        technicalReport,
      });

    const pdfFilename =
      `FixBee-Issue-Report-${photoId}.pdf`;

    const blob = await uploadToBlob(
      pdfBuffer,
      `expert-reports/${userId}/${pdfFilename}`,
      "application/pdf"
    );

    const updateResult = await PhotoAnalysisModel.updateOne(
      {
        _id: photoId,
        userId,
        isDeleted: false,
        aiResponse: expectedAiResponse,
        expertReportStatus: "pending",
      },
      {
        $set: {
          expertReportStatus: "completed",
          expertReportUrl: blob.url,
          expertReportFilename: pdfFilename,
          expertReportGeneratedAt: new Date(),
          expertReportReason: null,
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      console.log(
        "Expert report result was not saved because the photo analysis changed or no longer exists:",
        photoId
      );

      return false;
    }

    console.log(
      "Background expert report generation completed:",
      photoId
    );

    return true;
  } catch (error) {
    console.error(
      "Background expert report generation failed:",
      photoId,
      error.message
    );

    await markExpertReportFailed({
      photoId,
      userId,
      expectedAiResponse,
      reason: "EXPERT_REPORT_GENERATION_ERROR",
    });

    return false;
  } finally {
    activeExpertReportJobs.delete(jobKey);
  }
};

export { generateAndCacheExpertReport };
