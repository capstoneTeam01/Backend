import { estimateRepairCost } from "./costEstimationService.js";

const urgentKeywords = [
  "flood",
  "flooding",
  "burst",
  "major leak",
  "active leak",
  "water damage",
  "sewage",
  "overflow",
];

const mediumKeywords = [
  "leak",
  "drip",
  "clog",
  "clogged",
  "slow drain",
  "blocked",
  "stain",
  "water stain",
];

const lowKeywords = [
  "unclear",
  "unknown",
  "could not be completed",
  "unable to analyze",
];

const assignUrgencyLevel = (analysisResult) => {
  const detectedIssue = analysisResult?.detectedIssue || "";
  const detectedObject = analysisResult?.detectedObject || "";
  const confidence = analysisResult?.confidence || "Low";

  const combinedText = `${detectedIssue} ${detectedObject}`.toLowerCase();

  if (confidence === "Low") {
    return {
      urgency: "Low",
      urgencyDescription:
        "The issue could not be confidently identified. A clearer image or professional inspection is recommended.",
    };
  }

  if (urgentKeywords.some((keyword) => combinedText.includes(keyword))) {
    return {
      urgency: "High",
      urgencyDescription:
        "This may require quick attention because leaks or water damage can worsen if not handled soon.",
    };
  }

  if (mediumKeywords.some((keyword) => combinedText.includes(keyword))) {
    return {
      urgency: "Medium",
      urgencyDescription:
        "This issue should be checked soon to prevent possible plumbing damage or inconvenience.",
    };
  }

  if (lowKeywords.some((keyword) => combinedText.includes(keyword))) {
    return {
      urgency: "Low",
      urgencyDescription:
        "The image or issue is unclear. Try uploading a clearer photo or consult a plumber if needed.",
    };
  }

  return {
    urgency: analysisResult?.urgency || "Low",
    urgencyDescription:
      analysisResult?.urgencyDescription ||
      "Please monitor the issue and contact a licensed plumber if it becomes worse.",
  };
};



const generateRecommendation = async (
  analysisResult,
  location = "Vancouver, BC, Canada"
) => {
  const urgencyResult = assignUrgencyLevel(analysisResult);

  const costEstimate = await estimateRepairCost(
    analysisResult,
    urgencyResult.urgency,
    location
  );

  return {
    ...analysisResult,
    urgency: urgencyResult.urgency,
    urgencyDescription: urgencyResult.urgencyDescription,
    ...costEstimate,
  };
};

export { assignUrgencyLevel, generateRecommendation };