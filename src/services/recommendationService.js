import { estimateRepairCost } from "./costEstimationService.js";

const criticalKeywords = [
  "burst pipe",
  "burst",
  "flood",
  "flooding",
  "sewage",
  "sewer backup",
  "sewage overflow",
  "major overflow",
  "uncontrolled water",
  "water near electrical",
];

const highKeywords = [
  "active leak",
  "major leak",
  "heavy leak",
  "water damage",
  "rapid leak",
  "continuous leak",
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
  "minor",
  "small drip",
  "loose fitting",
  "maintenance",
];

const allowedUrgencyLevels = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const isLowConfidence = (analysisResult) => {
  const confidence = analysisResult?.confidence || "Low";

  return confidence.toLowerCase() === "low";
};

const containsKeyword = (text, keywords) => {
  return keywords.some((keyword) => {
    return text.includes(keyword);
  });
};

const createUserAction = (
  actionType,
  label,
  description,
  priority
) => {
  return {
    actionType,
    label,
    description,
    priority,
  };
};

const createMarkResolvedAction = () => {
  return createUserAction(
    "MARK_RESOLVED",
    "Mark as Resolved",
    "Mark this repair as resolved after the issue has been fixed.",
    "Optional"
  );
};

const getLowConfidenceActions = () => {
  return [
    createUserAction(
      "UPLOAD_CLEARER_IMAGE",
      "Retake Photo",
      "Take a closer photo with better lighting and keep the affected area clearly visible.",
      "Required"
    ),
    createUserAction(
      "FIND_PROFESSIONAL",
      "Find Professional",
      "Contact a professional if there is active leaking, flooding, electrical danger, or another visible safety concern.",
      "Optional"
    ),
  ];
};

const getCriticalUrgencyActions = () => {
  return [
    createUserAction(
      "FIND_PROFESSIONAL",
      "Get Emergency Help",
      "Contact a qualified professional immediately because this issue may cause serious property damage or a safety risk.",
      "Required"
    ),
    createUserAction(
      "DIY_TEMPORARY_STEPS",
      "View Emergency Safety Steps",
      "View temporary safety and damage-control steps while professional help is being arranged.",
      "Safety Only"
    ),
  ];
};

const getHighUrgencyActions = () => {
  return [
    createUserAction(
      "FIND_PROFESSIONAL",
      "Find Professional",
      "Prompt professional attention is recommended because this issue may become worse if it is not repaired soon.",
      "High"
    ),
    createUserAction(
      "DIY_TEMPORARY_STEPS",
      "View Temporary Safety Steps",
      "View basic temporary safety steps while waiting for a professional.",
      "Optional"
    ),
    createMarkResolvedAction(),
  ];
};

const getMediumUrgencyActions = () => {
  return [
    createUserAction(
      "DIY_INSTRUCTIONS",
      "DIY Instructions",
      "View simple DIY guidance if you want to try a basic repair first.",
      "Optional"
    ),
    createUserAction(
      "FIND_PROFESSIONAL",
      "Find Professional",
      "Find a service provider if the issue continues or requires inspection.",
      "Recommended"
    ),
    createMarkResolvedAction(),
  ];
};

const getLowUrgencyActions = () => {
  return [
    createUserAction(
      "DIY_INSTRUCTIONS",
      "DIY Instructions",
      "View simple DIY guidance for a lower-risk repair issue.",
      "Optional"
    ),
    createUserAction(
      "FIND_PROFESSIONAL",
      "Find Professional",
      "Find a service provider if you prefer professional assistance.",
      "Optional"
    ),
    createMarkResolvedAction(),
  ];
};

const assignUrgencyLevel = (analysisResult) => {
  if (isLowConfidence(analysisResult)) {
    return {
      urgency: null,
      urgencyDescription: null,
    };
  }

  const detectedIssue =
    analysisResult?.detectedIssue || "";

  const detectedObject =
    analysisResult?.detectedObject || "";

  const combinedText =
    `${detectedIssue} ${detectedObject}`.toLowerCase();

  if (containsKeyword(combinedText, criticalKeywords)) {
    return {
      urgency: "Critical",
      urgencyDescription:
        "This issue may present an immediate safety risk or cause serious property damage. Take safe damage-control steps and contact a qualified professional immediately.",
    };
  }

  if (containsKeyword(combinedText, highKeywords)) {
    return {
      urgency: "High",
      urgencyDescription:
        "This issue requires prompt attention because continued leaking or damage may become worse if repair is delayed.",
    };
  }

  if (containsKeyword(combinedText, mediumKeywords)) {
    return {
      urgency: "Medium",
      urgencyDescription:
        "This issue should be inspected and repaired soon to prevent further damage or inconvenience.",
    };
  }

  if (containsKeyword(combinedText, lowKeywords)) {
    return {
      urgency: "Low",
      urgencyDescription:
        "This appears to be a lower-risk issue, but it should still be monitored and repaired if it continues.",
    };
  }

  const existingUrgency =
    analysisResult?.urgency || "";

  if (allowedUrgencyLevels.includes(existingUrgency)) {
    return {
      urgency: existingUrgency,
      urgencyDescription:
        analysisResult?.urgencyDescription ||
        "Monitor the issue and contact a qualified professional if it becomes worse.",
    };
  }

  return {
    urgency: "Low",
    urgencyDescription:
      "The available information does not indicate an urgent problem, but the area should still be monitored.",
  };
};

const getUserActions = (analysisResult, urgency) => {
  if (isLowConfidence(analysisResult)) {
    return getLowConfidenceActions();
  }

  if (urgency === "Critical") {
    return getCriticalUrgencyActions();
  }

  if (urgency === "High") {
    return getHighUrgencyActions();
  }

  if (urgency === "Medium") {
    return getMediumUrgencyActions();
  }

  return getLowUrgencyActions();
};

const getLowConfidenceRecommendation = (
  analysisResult
) => {
  return {
    ...analysisResult,
    urgency: null,
    urgencyDescription: null,
    providerType: null,
    estimatedRepairTime: null,
    laborRateRange: null,
    partsCostRange: null,
    estimatedCostRange: null,
    currency: null,
    locationUsed: null,
    costConfidence: null,
    costSource: null,
    costNote: null,
    userActions: getLowConfidenceActions(),
  };
};

const generateRecommendation = async (
  analysisResult,
  location = "Vancouver, BC, Canada"
) => {
  if (isLowConfidence(analysisResult)) {
    return getLowConfidenceRecommendation(
      analysisResult
    );
  }

  const urgencyResult =
    assignUrgencyLevel(analysisResult);

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
    urgencyDescription:
      urgencyResult.urgencyDescription,
    ...costEstimate,
    userActions: userActions,
  };
};

export {
  assignUrgencyLevel,
  generateRecommendation,
  getUserActions,
};