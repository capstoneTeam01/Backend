import { estimateRepairCost } from "./costEstimationService.js";


const highRiskKeywords = [
  "burst pipe",
  "pipe burst",
  "burst water line",
  "ruptured pipe",
  "pipe rupture",
  "split pipe",
  "broken pipe",
  "broken water line",
  "gushing water",
  "water gushing",
  "uncontrolled water flow",
  "uncontrolled leak",
  "major flooding",
  "active flooding",
  "severe flooding",
  "flooded basement",
  "flooded room",
  "sewage overflow",
  "sewage backup",
  "sewer backup",
  "wastewater overflow",
  "water near electrical",
  "electrical hazard",
  "ceiling leak",
  "wall leak",
  "main water line",
  "supply line leak",
];


const pressurizedFlowKeywords = [
  "pressurized leak",
  "pressurized spray",
  "strong water spray",
  "heavy water spray",
  "water shooting out",
  "water jet",
  "rapid water flow",
  "heavy leak",
];


const exposedPipeSourceKeywords = [
  "pipe joint",
  "pipe connection",
  "pipe fitting",
  "supply line",
  "water line",
  "main line",
  "wall pipe",
  "ceiling pipe",
  "exposed pipe",
  "water heater connection",
  "valve connection",
];


const containedFixtureKeywords = [
  "faucet",
  "tap",
  "sink",
  "basin",
  "shower head",
  "showerhead",
  "bathtub faucet",
  "tub faucet",
  "tub spout",
];


const lowRiskKeywords = [
  "small drip",
  "minor drip",
  "occasional drip",
  "minor seepage",
  "loose fitting",
  "minor corrosion",
  "minor wear",
  "routine maintenance",
];


const mediumRiskKeywords = [
  "leak",
  "active leak",
  "continuous leak",
  "drip",
  "dripping",
  "steady flow",
  "pressurized spray",
  "strong water spray",
  "heavy water spray",
  "water shooting out",
  "spraying water",
  "faucet spray",
  "spraying faucet",
  "clog",
  "clogged",
  "slow drain",
  "blocked drain",
  "blockage",
  "water stain",
  "minor pooling",
  "localized standing water",
];

const allowedUrgencyLevels = [
  "Low",
  "Medium",
  "High",
];

const isLowConfidence = (analysisResult) => {
  const analysisStatus = String(
    analysisResult?.analysisStatus || ""
  ).toUpperCase();

  if (
    analysisStatus === "LOW_CONFIDENCE" ||
    analysisStatus === "ANALYSIS_FAILED"
  ) {
    return true;
  }

  const confidence = String(
    analysisResult?.confidence || "Low"
  ).toLowerCase();

  return confidence === "low";
};

const isNoIssueDetected = (analysisResult) => {
  const analysisStatus = String(
    analysisResult?.analysisStatus || ""
  ).toUpperCase();

  return analysisStatus === "NO_ISSUE_DETECTED";
};

const containsKeyword = (text, keywords) => {
  return keywords.some((keyword) => {
    return text.includes(keyword);
  });
};

const normalizeBoolean = (value) => {
  if (value === true) {
    return true;
  }

  if (
    typeof value === "string" &&
    value.trim().toLowerCase() === "true"
  ) {
    return true;
  }

  return false;
};

const normalizeExistingUrgency = (urgency) => {
  if (typeof urgency !== "string") {
    return null;
  }

  const normalizedUrgency =
    urgency.trim().toLowerCase();


  if (
    normalizedUrgency === "critical" ||
    normalizedUrgency === "high" ||
    normalizedUrgency === "emergency" ||
    normalizedUrgency === "urgent"
  ) {
    return "High";
  }

  if (
    normalizedUrgency === "medium" ||
    normalizedUrgency === "moderate"
  ) {
    return "Medium";
  }

  if (normalizedUrgency === "low") {
    return "Low";
  }

  return null;
};

const getVisualEvidence = (analysisResult) => {
  const visualEvidence =
    analysisResult?.visualEvidence;

  if (
    !visualEvidence ||
    typeof visualEvidence !== "object" ||
    Array.isArray(visualEvidence)
  ) {
    return {};
  }

  return visualEvidence;
};

const getCombinedIssueText = (analysisResult) => {
  const detectedIssue = String(
    analysisResult?.detectedIssue || ""
  );

  const detectedObject = String(
    analysisResult?.detectedObject || ""
  );

  const issuesToFix = Array.isArray(
    analysisResult?.issuesToFix
  )
    ? analysisResult.issuesToFix.join(" ")
    : "";

  const visibleRiskSignals = Array.isArray(
    analysisResult?.visibleRiskSignals
  )
    ? analysisResult.visibleRiskSignals.join(" ")
    : "";

  return `
    ${detectedIssue}
    ${detectedObject}
    ${issuesToFix}
    ${visibleRiskSignals}
  `
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const getRiskScore = (analysisResult) => {
  const riskScore = Number(
    analysisResult?.riskScore
  );

  if (!Number.isFinite(riskScore)) {
    return null;
  }

  if (riskScore < 0) {
    return 0;
  }

  if (riskScore > 100) {
    return 100;
  }

  return Math.round(riskScore);
};

const isContainedFixtureIssue = (
  combinedText
) => {
  const containsFixture =
    containsKeyword(
      combinedText,
      containedFixtureKeywords
    );

  const containsExposedPipeSource =
    containsKeyword(
      combinedText,
      exposedPipeSourceKeywords
    );

  return (
    containsFixture &&
    !containsExposedPipeSource
  );
};

const hasExposedPipeSource = (
  combinedText
) => {
  return containsKeyword(
    combinedText,
    exposedPipeSourceKeywords
  );
};

const hasHighRiskVisualEvidence = (
  analysisResult,
  combinedText
) => {
  const visualEvidence =
    getVisualEvidence(analysisResult);

  const waterFlow = String(
    visualEvidence.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence.floodingLevel || ""
  ).toLowerCase();

  const burstOrRuptureVisible =
    normalizeBoolean(
      visualEvidence.burstOrRuptureVisible
    );

  const sewageVisible =
    normalizeBoolean(
      visualEvidence.sewageVisible
    );

  const waterNearElectrical =
    normalizeBoolean(
      visualEvidence.waterNearElectrical
    );

  const immediateHazardVisible =
    normalizeBoolean(
      visualEvidence.immediateHazardVisible
    );

  const activeLeakVisible =
    normalizeBoolean(
      visualEvidence.activeLeakVisible
    );

  const exposedPipeSourceVisible =
    hasExposedPipeSource(combinedText);

  const sprayingFromExposedPipe =
    waterFlow === "spraying" &&
    activeLeakVisible &&
    exposedPipeSourceVisible;

  const seriousImmediateHazard =
    immediateHazardVisible &&
    (
      exposedPipeSourceVisible ||
      burstOrRuptureVisible ||
      sewageVisible ||
      waterNearElectrical ||
      floodingLevel === "major" ||
      waterFlow === "gushing"
    );


  if (
    burstOrRuptureVisible ||
    sewageVisible ||
    waterNearElectrical ||
    seriousImmediateHazard ||
    floodingLevel === "major" ||
    waterFlow === "gushing" ||
    sprayingFromExposedPipe
  ) {
    return true;
  }

  return false;
};

const getUrgencyFromRiskScore = (riskScore) => {
  if (riskScore === null) {
    return null;
  }

  if (riskScore >= 71) {
    return "High";
  }

  if (riskScore >= 31) {
    return "Medium";
  }

  if (riskScore >= 1) {
    return "Low";
  }

  return null;
};

const getUrgencyDescription = (urgency) => {
  if (urgency === "High") {
    return "This issue presents a serious risk of property damage or a possible safety hazard. Take safe damage-control steps and contact a qualified professional immediately.";
  }

  if (urgency === "Medium") {
    return "This issue should be inspected and repaired soon to prevent further damage or inconvenience.";
  }

  if (urgency === "Low") {
    return "This appears to be a lower-risk issue, but it should still be monitored and repaired if it continues.";
  }

  return null;
};

const hasHighRiskKeywordEvidence = (
  combinedText
) => {
  if (
    containsKeyword(
      combinedText,
      highRiskKeywords
    )
  ) {
    return true;
  }

  const hasPressurizedFlow =
    containsKeyword(
      combinedText,
      pressurizedFlowKeywords
    );

  if (!hasPressurizedFlow) {
    return false;
  }


  return hasExposedPipeSource(combinedText);
};

const hasSpecificLowRiskEvidence = (
  analysisResult,
  combinedText
) => {
  if (
    !containsKeyword(
      combinedText,
      lowRiskKeywords
    )
  ) {
    return false;
  }

  const visualEvidence =
    getVisualEvidence(analysisResult);

  const waterFlow = String(
    visualEvidence.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence.floodingLevel || ""
  ).toLowerCase();

  const hasSeriousHazard =
    normalizeBoolean(
      visualEvidence.burstOrRuptureVisible
    ) ||
    normalizeBoolean(
      visualEvidence.sewageVisible
    ) ||
    normalizeBoolean(
      visualEvidence.waterNearElectrical
    ) ||
    floodingLevel === "major" ||
    waterFlow === "gushing" ||
    waterFlow === "spraying";

  return !hasSeriousHazard;
};

const hasLowRiskContainedDrip = (
  analysisResult,
  combinedText
) => {
  if (!isContainedFixtureIssue(combinedText)) {
    return false;
  }

  const visualEvidence =
    getVisualEvidence(analysisResult);

  const waterFlow = String(
    visualEvidence.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence.floodingLevel || ""
  ).toLowerCase();

  const hasHazard =
    normalizeBoolean(
      visualEvidence.burstOrRuptureVisible
    ) ||
    normalizeBoolean(
      visualEvidence.sewageVisible
    ) ||
    normalizeBoolean(
      visualEvidence.waterNearElectrical
    ) ||
    normalizeBoolean(
      visualEvidence.immediateHazardVisible
    ) ||
    floodingLevel === "major" ||
    waterFlow === "gushing" ||
    waterFlow === "spraying" ||
    waterFlow === "steady";

  if (hasHazard) {
    return false;
  }

  return (
    waterFlow === "dripping" ||
    containsKeyword(
      combinedText,
      [
        "small drip",
        "minor drip",
        "occasional drip",
        "faucet drip",
        "dripping faucet",
        "tap drip",
        "dripping tap",
      ]
    )
  );
};

const hasMediumRiskVisualEvidence = (
  analysisResult
) => {
  const visualEvidence =
    getVisualEvidence(analysisResult);

  const activeLeakVisible =
    normalizeBoolean(
      visualEvidence.activeLeakVisible
    );

  const waterFlow = String(
    visualEvidence.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence.floodingLevel || ""
  ).toLowerCase();

  return (
    activeLeakVisible ||
    waterFlow === "dripping" ||
    waterFlow === "steady" ||
    waterFlow === "spraying" ||
    floodingLevel === "minor"
  );
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

const getNoIssueActions = () => {
  return [
    createUserAction(
      "NO_ACTION_NEEDED",
      "No Repair Needed",
      "No visible plumbing issue was detected in this scan.",
      "Info"
    ),
    createUserAction(
      "MONITOR_FIXTURE",
      "Monitor Fixture",
      "Continue normal use and scan again if leaking, slow drainage, odors, moisture, or damage appears.",
      "Optional"
    ),
  ];
};

const getHighUrgencyActions = () => {
  return [
    createUserAction(
      "FIND_PROFESSIONAL",
      "Get Emergency Help",
      "Contact a qualified professional immediately because this issue may cause serious property damage or present a safety risk.",
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

const assignUrgencyLevel = (
  analysisResult
) => {
  if (isNoIssueDetected(analysisResult)) {
    return {
      urgency: null,
      urgencyDescription: null,
    };
  }

  if (isLowConfidence(analysisResult)) {
    return {
      urgency: null,
      urgencyDescription: null,
    };
  }

  const combinedText =
    getCombinedIssueText(analysisResult);


  if (
    hasHighRiskVisualEvidence(
      analysisResult,
      combinedText
    )
  ) {
    return {
      urgency: "High",
      urgencyDescription: getUrgencyDescription("High"),
    };
  }

  if (
    hasHighRiskKeywordEvidence(
      combinedText
    )
  ) {
    return {
      urgency: "High",
      urgencyDescription: getUrgencyDescription("High"),
    };
  }

  if (
    hasLowRiskContainedDrip(
      analysisResult,
      combinedText
    )
  ) {
    return {
      urgency: "Low",
      urgencyDescription:
        getUrgencyDescription("Low"),
    };
  }

  if (
    hasMediumRiskVisualEvidence(
      analysisResult
    ) ||
    containsKeyword(
      combinedText,
      mediumRiskKeywords
    )
  ) {
    return {
      urgency: "Medium",
      urgencyDescription:
        "This issue should be inspected and repaired soon to prevent further damage or inconvenience.",
    };
  }


  if (
    hasSpecificLowRiskEvidence(
      analysisResult,
      combinedText
    )
  ) {
    return {
      urgency: "Low",
      urgencyDescription:
        "This appears to be a lower-risk issue, but it should still be monitored and repaired if it continues.",
    };
  }

  const scoreUrgency =
    getUrgencyFromRiskScore(
      getRiskScore(analysisResult)
    );

  if (scoreUrgency) {
    return {
      urgency: scoreUrgency,
      urgencyDescription:
        getUrgencyDescription(scoreUrgency),
    };
  }


  const existingUrgency =
    normalizeExistingUrgency(
      analysisResult?.urgency
    );

  if (
    existingUrgency &&
    allowedUrgencyLevels.includes(
      existingUrgency
    )
  ) {
    return {
      urgency: existingUrgency,
      urgencyDescription:
        analysisResult?.urgencyDescription ||
        "Monitor the issue and contact a qualified professional if it becomes worse.",
    };
  }


  return {
    urgency: "Medium",
    urgencyDescription:
      "This issue should be inspected and repaired soon because the available evidence indicates a visible plumbing problem.",
  };
};

const getUserActions = (
  analysisResult,
  urgency
) => {
  if (isNoIssueDetected(analysisResult)) {
    return getNoIssueActions();
  }

  if (isLowConfidence(analysisResult)) {
    return getLowConfidenceActions();
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

    issuesToFix: [],

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

    userActions:
      getLowConfidenceActions(),
  };
};

const getNoIssueRecommendation = (
  analysisResult
) => {
  return {
    ...analysisResult,

    detectedIssue: null,
    issuesToFix: [],

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

    userActions:
      getNoIssueActions(),
  };
};

const generateRecommendation = async (
  analysisResult,
  location = "Vancouver, BC, Canada",
  { useLocalLlm = false } = {}
) => {
  if (isNoIssueDetected(analysisResult)) {
    return getNoIssueRecommendation(
      analysisResult
    );
  }

  if (isLowConfidence(analysisResult)) {
    return getLowConfidenceRecommendation(
      analysisResult
    );
  }

  const urgencyResult =
    assignUrgencyLevel(analysisResult);

  const costEstimate =
    await estimateRepairCost(
      analysisResult,
      urgencyResult.urgency,
      location,
      { useLocalLlm }
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
