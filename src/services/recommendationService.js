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

  const userActions = getUserActions(
  analysisResult,
  urgencyResult.urgency
);

  return {
  ...analysisResult,
  urgency: urgencyResult.urgency,
  urgencyDescription: urgencyResult.urgencyDescription,
  ...costEstimate,
  userActions,
};
};


const getUserActions = (analysisResult, urgency) => {
  const confidence = analysisResult?.confidence || "Low";

  if (confidence === "Low") {
    return [
      {
        actionType: "UPLOAD_CLEARER_IMAGE",
        label: "Upload Clearer Image",
        description:
          "Upload a clearer photo so FixBee can provide a better recommendation.",
        priority: "Recommended",
      },
      {
        actionType: "FIND_PROFESSIONAL",
        label: "Find Professional",
        description:
          "Contact a professional if the issue is unclear or may become worse.",
        priority: "Recommended",
      },
      {
        actionType: "MARK_RESOLVED",
        label: "Mark as Resolved",
        description:
          "Mark this issue as resolved if no repair is needed anymore.",
        priority: "Optional",
      },
    ];
  }

  if (urgency === "High") {
    return [
      {
        actionType: "FIND_PROFESSIONAL",
        label: "Find Professional",
        description:
          "Recommended because this issue may worsen if it is not repaired soon.",
        priority: "High",
      },
      {
        actionType: "DIY_TEMPORARY_STEPS",
        label: "View Temporary DIY Steps",
        description:
          "View basic temporary safety steps while waiting for a professional.",
        priority: "Optional",
      },
      {
        actionType: "MARK_RESOLVED",
        label: "Mark as Resolved",
        description:
          "Mark this repair as resolved after the issue has been fixed.",
        priority: "Optional",
      },
    ];
  }

  if (urgency === "Medium") {
    return [
      {
        actionType: "DIY_INSTRUCTIONS",
        label: "DIY Instructions",
        description:
          "View simple DIY guidance if you want to try a basic fix first.",
        priority: "Optional",
      },
      {
        actionType: "FIND_PROFESSIONAL",
        label: "Find Professional",
        description:
          "Find a service provider if the issue continues or needs inspection.",
        priority: "Recommended",
      },
      {
        actionType: "MARK_RESOLVED",
        label: "Mark as Resolved",
        description:
          "Mark this repair as resolved after the issue has been fixed.",
        priority: "Optional",
      },
    ];
  }

  return [
    {
      actionType: "DIY_INSTRUCTIONS",
      label: "DIY Instructions",
      description:
        "View simple DIY guidance for a low-risk repair issue.",
      priority: "Optional",
    },
    {
      actionType: "FIND_PROFESSIONAL",
      label: "Find Professional",
      description:
        "Find a service provider if you prefer professional help.",
      priority: "Optional",
    },
    {
      actionType: "MARK_RESOLVED",
      label: "Mark as Resolved",
      description:
        "Mark this repair as resolved after the issue has been fixed.",
      priority: "Optional",
    },
  ];
};


export { assignUrgencyLevel, generateRecommendation, getUserActions };