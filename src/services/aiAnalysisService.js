import {
  getProvider,
  createAIClient,
  isOllamaEnabled,
} from "./aiClientService.js";
import fs from "fs/promises";
import { visionAnalysisKnowledge } from "./plumbingKnowledgeService.js";

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "meta-llama/llama-4-scout-17b-16e-instruct";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ||
  "gpt-4o-mini";

const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL ||
  "qwen3-vl:8b";

const WATER_FLOW_LEVELS = [
  "Unknown",
  "None",
  "Dripping",
  "Steady",
  "Spraying",
  "Gushing",
];

const FLOODING_LEVELS = [
  "Unknown",
  "None",
  "Minor",
  "Major",
];

const getModelForProvider = (provider) => {
  if (provider === "groq") {
    return GROQ_VISION_MODEL;
  }

  if (provider === "openai") {
    return OPENAI_VISION_MODEL;
  }

  if (provider === "ollama") {
    return OLLAMA_VISION_MODEL;
  }

  return null;
};

const extractJsonObject = (text) => {
  if (typeof text !== "string") {
    return "{}";
  }

  const cleanedText = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBraceIndex = cleanedText.indexOf("{");
  const lastBraceIndex = cleanedText.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    return cleanedText;
  }

  return cleanedText.substring(firstBraceIndex, lastBraceIndex + 1);
};

const VISION_GATE_PROMPT = `
Inspect only the visible plumbing evidence in the image and return one JSON object with this exact structure:
{
  "classification": "NORMAL, VISIBLE_ISSUE, or UNCLEAR",
  "detectedObject": "visible plumbing object or null",
  "abnormalEvidence": ["directly visible abnormal sign"],
  "confidence": "Medium or High",
  "reason": "brief evidence-based reason"
}

Use NORMAL when a recognizable plumbing fixture is clearly visible and there is no directly visible leak, liquid, pooling, blockage, crack, rupture, corrosion, irregular deposit, material damage, overflow, sewage, loose part, or abnormal water flow.
Use VISIBLE_ISSUE only when abnormal physical evidence is directly visible. Do not infer a concealed problem or maintenance need.
Use UNCLEAR only when the plumbing area cannot be assessed reliably.
Clean PVC union nuts, moulded seams, fitting edges, normal joint geometry, harmless alignment differences, reflections, highlights, and shadows are normal—not wetness, deposits, looseness, misalignment, or damage.
A wet ring requires directly visible liquid, droplets, or credible surrounding moisture. Mineral deposits require irregular crust, scale, residue, or discolouration.
A suspended droplet, forming droplet, or thin intermittent stream hanging from a faucet spout or aerator is VISIBLE_ISSUE evidence of dripping, even when no pooling is visible.
Irregular white crust, scale, or residue around a faucet aerator is VISIBLE_ISSUE evidence of mineral buildup. Do not confuse irregular crust with clean manufactured plastic or a smooth reflected highlight.
The normal-PVC safeguards apply to clean pipe fittings and union geometry; they must not suppress directly visible faucet droplets, thin drip streams, or irregular aerator deposits.
Return JSON only.
`;

const createResultFromVisualGate = (gateResult, imageUrl) => {
  const classification = String(
    gateResult?.classification || ""
  ).trim().toUpperCase();

  const detectedObject =
    typeof gateResult?.detectedObject === "string"
      ? gateResult.detectedObject.trim()
      : "";

  if (classification === "NORMAL" && detectedObject) {
    return getNoIssueResult(
      {
        confidence: gateResult?.confidence,
        confidenceReason: gateResult?.reason,
        visualEvidence: getUnknownVisualEvidence(),
      },
      imageUrl,
      detectedObject
    );
  }

  if (classification === "UNCLEAR") {
    return getLowConfidenceResult(
      {
        confidenceReason: gateResult?.reason,
      },
      imageUrl,
      detectedObject || null
    );
  }

  return null;
};

const requestOllamaVisionJson = async ({
  base64Image,
  prompt,
}) => {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_VISION_MODEL || "qwen3-vl:8b",
      prompt,
      images: [base64Image],
      stream: false,
      format: "json",
      options: {
        num_ctx: 8192,
        temperature: 0,
        seed: 42,
        top_k: 1,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama vision request failed");
  }

  const data = await response.json();
  const modelOutput = data.response || data.thinking;
  return JSON.parse(extractJsonObject(modelOutput));
};

const analyzeImageWithOllama = async (imageUrl) => {
  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("Unable to download image for Ollama analysis");
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const gateResult = await requestOllamaVisionJson({
      base64Image,
      prompt: VISION_GATE_PROMPT,
    });

    const gatedResult = createResultFromVisualGate(
      gateResult,
      imageUrl
    );

    if (gatedResult) {
      return gatedResult;
    }

    const ollamaPrompt = `
${SHARED_SYSTEM_PROMPT}

${ANALYSIS_REQUEST_PROMPT}

VISUAL GATE RESULT:
${JSON.stringify(gateResult)}
`;

    const detailedResult = await requestOllamaVisionJson({
      base64Image,
      prompt: ollamaPrompt,
    });

    const aiResult = {
      ...detailedResult,
      visibleRiskSignals:
        Array.isArray(detailedResult?.visibleRiskSignals) &&
        detailedResult.visibleRiskSignals.length > 0
          ? detailedResult.visibleRiskSignals
          : gateResult?.abnormalEvidence,
    };

    return createNormalizedResult(aiResult, imageUrl);
  } catch (error) {
    console.error("Ollama image analysis failed:", error.message);
    return getFallbackResult(imageUrl);
  }
};

const normalizeConfidence = (confidence) => {
  if (typeof confidence !== "string") {
    return "Low";
  }

  const normalizedConfidence =
    confidence.trim().toLowerCase();

  if (normalizedConfidence === "high") {
    return "High";
  }

  if (normalizedConfidence === "medium") {
    return "Medium";
  }

  return "Low";
};

const normalizeAnalysisStatus = (status) => {
  if (typeof status !== "string") {
    return null;
  }

  const normalizedStatus = status.trim().toUpperCase();

  if (
    normalizedStatus === "NO_ISSUE_DETECTED" ||
    normalizedStatus === "NORMAL" ||
    normalizedStatus === "NO_VISIBLE_ISSUE"
  ) {
    return "NO_ISSUE_DETECTED";
  }

  if (
    normalizedStatus === "LOW_CONFIDENCE" ||
    normalizedStatus === "ANALYSIS_FAILED"
  ) {
    return "LOW_CONFIDENCE";
  }

  if (normalizedStatus === "ANALYZED") {
    return "ANALYZED";
  }

  return null;
};

const normalizeRiskScore = (score, fallbackScore = null) => {
  const numberScore = Number(score);

  if (!Number.isFinite(numberScore)) {
    return fallbackScore;
  }

  if (numberScore < 0) {
    return 0;
  }

  if (numberScore > 100) {
    return 100;
  }

  return Math.round(numberScore);
};

const normalizeIssueRiskScore = (
  aiResult,
  visualEvidence
) => {
  const requestedScore = normalizeRiskScore(
    aiResult?.riskScore,
    1
  );

  const evidenceText = [
    aiResult?.detectedIssue,
    ...(Array.isArray(aiResult?.visibleRiskSignals)
      ? aiResult.visibleRiskSignals
      : []),
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const waterFlow = String(
    visualEvidence?.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence?.floodingLevel || ""
  ).toLowerCase();

  const hasHighRiskEvidence =
    waterFlow === "spraying" ||
    waterFlow === "gushing" ||
    floodingLevel === "major" ||
    normalizeBoolean(visualEvidence?.burstOrRuptureVisible) ||
    normalizeBoolean(visualEvidence?.sewageVisible) ||
    normalizeBoolean(visualEvidence?.waterNearElectrical) ||
    normalizeBoolean(visualEvidence?.immediateHazardVisible) ||
    /\b(pressurized spray|gushing|burst|ruptured|major flooding|sewage|water near electrical|scalding|steam release|structural danger)\b/.test(
      evidenceText
    );

  if (hasHighRiskEvidence) {
    return Math.max(71, requestedScore);
  }

  const hasMediumRiskEvidence =
    waterFlow === "steady" ||
    floodingLevel === "minor" ||
    /\b(continuous leak|steady leak|steady flow|pooling|standing water|overflow|blockage|blocked|clogged|visible crack|significant corrosion|moisture damage)\b/.test(
      evidenceText
    );

  if (hasMediumRiskEvidence) {
    return Math.min(70, Math.max(31, requestedScore));
  }

  return Math.min(30, Math.max(1, requestedScore));
};

const cleanRiskSignals = (signals, maximumItems = 6) => {
  if (!Array.isArray(signals)) {
    return [];
  }

  const cleanedSignals = [];

  for (const signal of signals) {
    if (
      typeof signal !== "string" ||
      signal.trim() === ""
    ) {
      continue;
    }

    const cleanedSignal = signal.trim();
    const duplicate = cleanedSignals.some((existingSignal) => {
      return existingSignal.toLowerCase() === cleanedSignal.toLowerCase();
    });

    if (!duplicate) {
      cleanedSignals.push(cleanedSignal);
    }

    if (cleanedSignals.length >= maximumItems) {
      break;
    }
  }

  return cleanedSignals;
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

const normalizeAllowedValue = (
  value,
  allowedValues,
  fallbackValue
) => {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalizedValue =
    value.trim().toLowerCase();

  const matchedValue = allowedValues.find(
    (allowedValue) => {
      return (
        allowedValue.toLowerCase() ===
        normalizedValue
      );
    }
  );

  return matchedValue || fallbackValue;
};

const getUnknownVisualEvidence = () => {
  return {
    activeLeakVisible: false,
    waterFlow: "Unknown",
    floodingLevel: "Unknown",
    burstOrRuptureVisible: false,
    sewageVisible: false,
    waterNearElectrical: false,
    immediateHazardVisible: false,
  };
};

const getEmptyVisualEvidence = () => {
  return {
    activeLeakVisible: false,
    waterFlow: "None",
    floodingLevel: "None",
    burstOrRuptureVisible: false,
    sewageVisible: false,
    waterNearElectrical: false,
    immediateHazardVisible: false,
  };
};

const normalizeVisualEvidence = (
  visualEvidence
) => {
  if (
    !visualEvidence ||
    typeof visualEvidence !== "object" ||
    Array.isArray(visualEvidence)
  ) {
    return getEmptyVisualEvidence();
  }

  return {
    activeLeakVisible: normalizeBoolean(
      visualEvidence.activeLeakVisible
    ),

    waterFlow: normalizeAllowedValue(
      visualEvidence.waterFlow,
      WATER_FLOW_LEVELS,
      "None"
    ),

    floodingLevel: normalizeAllowedValue(
      visualEvidence.floodingLevel,
      FLOODING_LEVELS,
      "None"
    ),

    burstOrRuptureVisible: normalizeBoolean(
      visualEvidence.burstOrRuptureVisible
    ),

    sewageVisible: normalizeBoolean(
      visualEvidence.sewageVisible
    ),

    waterNearElectrical: normalizeBoolean(
      visualEvidence.waterNearElectrical
    ),

    immediateHazardVisible: normalizeBoolean(
      visualEvidence.immediateHazardVisible
    ),
  };
};

const getRetakePhotoActions = () => {
  return [
    "Hold the camera steady and retake the photo.",
    "Move closer to the affected area.",
    "Use brighter lighting.",
    "Keep the affected fixture and damaged area visible.",
  ];
};

const getDefaultIssueActions = () => {
  return [
    "Avoid using the affected fixture until the condition has been checked.",
    "Monitor the area for continued leaking, moisture, blockage, or further damage.",
    "Contact a licensed plumber if the issue continues, becomes worse, or cannot be safely confirmed.",
  ];
};

const getNoIssueActions = () => {
  return [
    "No visible plumbing issue was detected.",
    "Continue normal use and monitor for leaks, slow drainage, odors, moisture, or unusual sounds.",
    "Scan again if a visible plumbing issue appears.",
  ];
};

const getFallbackResult = (imageUrl) => {
  return {
    analysisStatus: "ANALYSIS_FAILED",

    userMessage:
      "FixBee could not analyze this image reliably. Please retake the photo.",

    detectedObject: null,
    detectedIssue: null,
    issuesToFix: [],
    riskScore: null,
    visibleRiskSignals: [],

    visualEvidence:
      getUnknownVisualEvidence(),

    category: "Plumbing",
    confidence: "Low",

    confidenceReason:
      "The image analysis could not be completed reliably.",

    recommendedActions:
      getRetakePhotoActions(),

    isFallback: true,
    imageUrl: imageUrl,
  };
};

const SYSTEM_PROMPT = `
You are a practical and cautious plumbing image-analysis assistant for a mobile app called FixBee.

Analyze the uploaded image and return ONLY one valid JSON object.
Do not include markdown, comments, explanations, or extra text.

Return exactly these fields:

{
  "analysisStatus": "NO_ISSUE_DETECTED, ANALYZED, or LOW_CONFIDENCE",
  "detectedObject": "string or null",
  "detectedIssue": "string or null",
  "issuesToFix": [
    "first visible repair concern",
    "second visible repair concern"
  ],
  "riskScore": "number from 0 to 100 or null",
  "visibleRiskSignals": [
    "short visible risk signal",
    "second short visible risk signal"
  ],
  "repairCategory": "Plumbing",
  "confidence": "Low, Medium, or High",
  "confidenceReason": "short explanation of why this confidence level was selected",
  "visualEvidence": {
    "activeLeakVisible": true,
    "waterFlow": "Unknown, None, Dripping, Steady, Spraying, or Gushing",
    "floodingLevel": "Unknown, None, Minor, or Major",
    "burstOrRuptureVisible": false,
    "sewageVisible": false,
    "waterNearElectrical": false,
    "immediateHazardVisible": false
  },
  "recommendedActions": [
    "first issue-specific action",
    "second issue-specific action",
    "third issue-specific action"
  ]
}

Allowed repairCategory value:
["Plumbing"]

Allowed confidence values:
["Low", "Medium", "High"]

Allowed waterFlow values:
["Unknown", "None", "Dripping", "Steady", "Spraying", "Gushing"]

Allowed floodingLevel values:
["Unknown", "None", "Minor", "Major"]

Risk score meaning:
- Use null for LOW_CONFIDENCE.
- Use 0 for NO_ISSUE_DETECTED.
- Use 1 to 30 for Low risk visible repair concerns.
- Use 31 to 70 for Medium risk visible repair concerns.
- Use 71 to 100 for High risk visible repair concerns.

VISIBLE-EVIDENCE SEVERITY RUBRIC:

- No issue requires a recognizable plumbing object, an assessable relevant area, dry and intact visible surfaces, and no abnormal visible evidence.
- Low risk requires at least one localized minor visible concern, such as an isolated droplet, thin intermittent drip, small seepage without spread, light irregular mineral crust, minor surface corrosion, or a slightly loose accessible component without pooling.
- Suggested Low anchors: minor deposit only 5 to 10; occasional drip 10 to 20; repeated localized dripping 20 to 30.
- Medium risk requires visible continuous leakage, steady flow, localized pooling, overflow, blockage, visible cracking without spray, significant corrosion, or moisture damage requiring timely repair.
- High risk requires a visible critical override: pressurized spray, gushing water, burst or ruptured pipe, major flooding, sewage, water near electrical equipment, scalding water or steam, or structural danger.
- Do not increase severity because of a possible concealed cause, repair complexity, cost, or a condition that is not visible.
- Confidence describes image reliability only. Never use Low confidence to represent Low issue severity.
- The visual gate evidence and detailed analysis must agree. Do not replace directly visible gate evidence with an unsupported different issue.

CLASSIFICATION RULES:

Classify the image first using exactly one analysisStatus value:

1. "NO_ISSUE_DETECTED"
Use this when a plumbing object or fixture is visible and the image is clear enough to assess, but there is no visible repair concern.
Examples include a dry normal sink, normal faucet, normal drain, normal toilet, normal pipe, or normal fixture with no visible leak, pooling, clog, crack, rupture, corrosion, damage, stain, overflow, sewage, moisture, loose part, or abnormal water behavior.

2. "ANALYZED"
Use this only when a plumbing object or fixture is visible and there is a visible repair concern supported by the image.

3. "LOW_CONFIDENCE"
Use this when the image is not reliable enough for assessment because it is blurry, too dark, overexposed, unrelated to plumbing, obstructed, or missing the affected plumbing area.

IMAGE QUALITY AND CONFIDENCE RULES:

- Use "Low" only when the image is genuinely unusable for a meaningful plumbing assessment.
- Examples of genuinely unusable images include:
  - severe motion blur;
  - extreme darkness or overexposure;
  - the plumbing object is not recognizable;
  - the affected area is fully obstructed;
  - the image is unrelated to plumbing;
  - identifying any issue would require guessing.
- Minor blur, phone-camera compression, shadows, reflections, partial cropping, or imperfect framing must not automatically result in Low confidence.
- Use "Medium" when the plumbing object and visible signs of a possible issue can be identified, but the exact cause remains uncertain.
- Use "High" when the plumbing object and visible issue are clearly shown with strong visual evidence.
- A clear image of a normal fixture with no visible issue must use analysisStatus "NO_ISSUE_DETECTED", not "LOW_CONFIDENCE" and not "ANALYZED".

NO-ISSUE OUTPUT RULES:

If analysisStatus is "NO_ISSUE_DETECTED":

- detectedObject must be populated with the visible plumbing object.
- detectedIssue must be null.
- issuesToFix must be an empty array.
- riskScore must be 0.
- visibleRiskSignals must be an empty array.
- confidence must be "High" if the fixture is clearly visible, or "Medium" if visibility is usable but imperfect.
- recommendedActions must contain normal monitoring guidance only.
- visualEvidence must use:
  - activeLeakVisible: false;
  - waterFlow: "None";
  - floodingLevel: "None";
  - burstOrRuptureVisible: false;
  - sewageVisible: false;
  - waterNearElectrical: false;
  - immediateHazardVisible: false.
- Do not invent maintenance needs.
- Do not recommend repair, DIY instructions, cost estimation, provider contact, or emergency action.

LOW-CONFIDENCE OUTPUT RULES:

If analysisStatus is "LOW_CONFIDENCE" or confidence is Low:

- detectedIssue must be null;
- issuesToFix must be an empty array;
- riskScore must be null;
- visibleRiskSignals must be an empty array;
- recommendedActions must contain photo-retake guidance only;
- visualEvidence must use:
  - activeLeakVisible: false;
  - waterFlow: "Unknown";
  - floodingLevel: "Unknown";
  - burstOrRuptureVisible: false;
  - sewageVisible: false;
  - waterNearElectrical: false;
  - immediateHazardVisible: false.

MEDIUM OR HIGH-CONFIDENCE OUTPUT RULES:

If analysisStatus is "ANALYZED" and confidence is Medium or High:

- detectedObject must be populated;
- detectedIssue must be populated;
- issuesToFix must contain exactly three concise visible repair concerns;
- riskScore must be between 1 and 100;
- visibleRiskSignals must contain short visible evidence phrases such as "active leak", "pressurized spray", "gushing water", "minor pooling", "slow drain", "visible corrosion", "burst pipe", "sewage backup", or "water near electrical";
- recommendedActions must contain exactly three issue-specific actions;
- do not include photo, camera, lighting, focus, framing, capture, or retake advice.

ISSUES-TO-FIX RULES:

- Include only repair concerns supported by visible evidence.
- Keep each item short and suitable for a mobile card.
- Describe what visibly needs repair, correction, containment, or professional inspection.
- Do not invent hidden internal causes.
- Do not guess that a seal, valve, connection, pipe, or component failed unless the image visibly supports it.
- Do not include instructions or safety actions in issuesToFix.
- Do not repeat detectedIssue using multiple slightly different phrases.
- Return exactly three distinct items.

VISUAL-EVIDENCE RULES:

- activeLeakVisible must be true when water is visibly escaping from a plumbing fixture, pipe, joint, valve, drain, or connection.
- Use waterFlow "Dripping" for separated drops or a minor drip.
- Use waterFlow "Steady" for a continuous but controlled-looking stream.
- Use waterFlow "Spraying" when visible water is projected or sprayed under apparent pressure.
- Use waterFlow "Gushing" for a heavy, uncontrolled, continuous flow.
- Use floodingLevel "Minor" for localized standing water or small pooling.
- Use floodingLevel "Major" when standing water covers a substantial floor area or clearly threatens surrounding property.
- burstOrRuptureVisible must be true only when a break, split, rupture, or clearly failed pipe section is visible.
- sewageVisible must be true only when sewage, wastewater overflow, or sewer backup is visibly supported.
- waterNearElectrical must be true when water is visibly touching, approaching, or pooling near electrical equipment, wiring, outlets, panels, or powered appliances.
- immediateHazardVisible must be true when the visible condition presents an immediate safety or major property-damage concern.
- Do not mark a normal drip as spraying, gushing, flooding, or an immediate hazard.

HIGH-RISK SIGNAL RULES:

- If water is visibly projected outward from a pipe, fitting, valve, joint, or connection, set waterFlow to "Spraying", include "pressurized spray" in visibleRiskSignals, and use riskScore 71 or higher.
- If heavy uncontrolled water is visibly flowing from a pipe or plumbing component, set waterFlow to "Gushing", include "gushing water" in visibleRiskSignals, and use riskScore 85 or higher.
- If a pipe or water line appears split, ruptured, broken, or burst, set burstOrRuptureVisible to true, include "burst pipe" or "ruptured pipe" in visibleRiskSignals, and use riskScore 85 or higher.
- If major flooding, sewage overflow, sewer backup, or water near electrical equipment is visible, use riskScore 85 or higher.
- Use High risk evidence for words and visuals such as gushing, spraying, pressurized spray, water shooting out, water jet, rapid water flow, uncontrolled leak, burst pipe, ruptured pipe, split pipe, broken pipe, broken water line, active flooding, major flooding, sewage backup, sewage overflow, water near electrical, electrical hazard, ceiling leak, wall leak, main water line, or supply line leak.

ISSUE ANALYSIS RULES:

- Identify the visible plumbing object.
- Identify only issues supported by visible evidence.
- Use cautious wording such as "possible", "appears", or "may indicate" when certainty is limited.
- Do not provide a final diagnosis.
- Do not invent hidden damage or internal causes that are not visible.
- Do not invent urgency, repair cost, repair time, tools, or DIY instructions.
- Keep detectedIssue short and specific.
- When water is visibly spraying, gushing, or flooding, include that visible condition in detectedIssue.
- Do not describe a strong visible spray only as a generic "leak".
- Do not classify a normal dry fixture as a repair issue.
- Do not infer hidden clogs, hidden leaks, worn parts, old parts, or maintenance needs when the fixture appears normal and dry.

RECOMMENDED ACTION RULES FOR MEDIUM OR HIGH CONFIDENCE:

- Return exactly three distinct actions.
- Every action must relate directly to the detected object and detected issue.
- The first action should be an immediate safe precaution.
- The second action should explain what the user should inspect, monitor, or verify.
- The third action should explain when professional help is required.
- Do not include camera or image-capture instructions.
- Do not repeat the same recommendation in different wording.
- Keep each action short and suitable for a mobile app.
`;

const SHARED_SYSTEM_PROMPT = `
${SYSTEM_PROMPT}

FIXBEE PLUMBING KNOWLEDGE:
${visionAnalysisKnowledge}

Use this knowledge as supporting reference for issue terminology and visible evidence. The uploaded image and the FixBee rules above remain authoritative.
`;

const ANALYSIS_REQUEST_PROMPT = `
Analyze this plumbing image. First classify it as NO_ISSUE_DETECTED, ANALYZED, or LOW_CONFIDENCE.
Return riskScore and visibleRiskSignals.
Use NO_ISSUE_DETECTED for a clear normal dry plumbing fixture with no visible leak, pooling, clog, crack, rupture, corrosion, damage, stain, overflow, sewage, moisture, loose part, or abnormal water behavior.
Use LOW_CONFIDENCE only when the image is genuinely unusable.
Use ANALYZED only when a visible repair concern is supported by the image.
Clearly identify visible dripping, steady flow, pressurized spraying, gushing, burst pipes, standing water, major flooding, sewage, or water near electrical equipment.
Pressurized spray, gushing water, burst or ruptured pipe, major flooding, sewage, or water near electrical must produce high-risk evidence and a riskScore of at least 71.
Populate detectedIssue, issuesToFix, visibleRiskSignals, and recommendedActions whenever visible abnormal evidence is present.
Return only the required JSON object with no markdown or additional explanation.
`;

const getLowConfidenceResult = (
  aiResult,
  imageUrl,
  detectedObject = null
) => {
  return {
    analysisStatus: "LOW_CONFIDENCE",

    userMessage:
      "The image is not clear enough for a reliable repair assessment. Please retake the photo.",

    detectedObject: detectedObject,
    detectedIssue: null,
    issuesToFix: [],
    riskScore: null,
    visibleRiskSignals: [],

    visualEvidence:
      getUnknownVisualEvidence(),

    category: "Plumbing",
    confidence: "Low",

    confidenceReason:
      aiResult?.confidenceReason ||
      "The affected area is not visible clearly enough for a reliable assessment.",

    recommendedActions:
      getRetakePhotoActions(),

    isFallback: false,
    imageUrl: imageUrl,
  };
};

const getNoIssueResult = (
  aiResult,
  imageUrl,
  detectedObject
) => {
  const visualEvidence =
    normalizeVisualEvidence(
      aiResult?.visualEvidence
    );

  return {
    analysisStatus: "NO_ISSUE_DETECTED",

    userMessage:
      "No visible plumbing issue was detected in this image.",

    detectedObject: detectedObject,
    detectedIssue: null,
    issuesToFix: [],
    riskScore: 0,
    visibleRiskSignals: [],

    visualEvidence: {
      ...visualEvidence,
      activeLeakVisible: false,
      waterFlow: "None",
      floodingLevel: "None",
      burstOrRuptureVisible: false,
      sewageVisible: false,
      waterNearElectrical: false,
      immediateHazardVisible: false,
    },

    category: "Plumbing",
    confidence:
      normalizeConfidence(aiResult?.confidence) === "Low"
        ? "Medium"
        : normalizeConfidence(aiResult?.confidence),

    confidenceReason:
      aiResult?.confidenceReason ||
      "The plumbing fixture is visible and no leak, pooling, blockage, damage, corrosion, overflow, moisture, or abnormal condition is visible.",

    recommendedActions:
      getNoIssueActions(),

    isFallback: false,
    imageUrl: imageUrl,
  };
};

const containsCameraAdvice = (text) => {
  const cameraAdviceKeywords = [
    "photo",
    "image",
    "camera",
    "lighting",
    "well-lit",
    "focus",
    "focused",
    "framing",
    "frame",
    "retake",
    "move closer",
    "capture",
    "picture",
  ];

  const normalizedText =
    text.toLowerCase();

  return cameraAdviceKeywords.some(
    (keyword) => {
      return normalizedText.includes(keyword);
    }
  );
};

const cleanStringArray = (
  values,
  maximumItems
) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const cleanedValues = [];

  for (const value of values) {
    if (
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      continue;
    }

    const trimmedValue = value.trim();

    if (containsCameraAdvice(trimmedValue)) {
      continue;
    }

    const normalizedValue =
      trimmedValue.toLowerCase();

    const isDuplicate =
      cleanedValues.some((existingValue) => {
        return (
          existingValue.toLowerCase() ===
          normalizedValue
        );
      });

    if (!isDuplicate) {
      cleanedValues.push(trimmedValue);
    }

    if (
      cleanedValues.length >= maximumItems
    ) {
      break;
    }
  }

  return cleanedValues;
};

const cleanRecommendedActions = (actions) => {
  return cleanStringArray(actions, 3);
};

const cleanIssuesToFix = (
  issuesToFix,
  detectedIssue
) => {
  const cleanedIssues =
    cleanStringArray(issuesToFix, 3);

  if (
    typeof detectedIssue === "string" &&
    detectedIssue.trim() !== ""
  ) {
    const detectedIssueText =
      detectedIssue.trim();

    const alreadyExists =
      cleanedIssues.some((issue) => {
        return (
          issue.toLowerCase() ===
          detectedIssueText.toLowerCase()
        );
      });

    if (!alreadyExists) {
      cleanedIssues.push(detectedIssueText);
    }
  }

  const fallbackIssues = [
    "Inspect the affected fixture or plumbing component.",
    "Check for continued leaking, moisture, blockage, or damage.",
    "Confirm whether the issue continues during normal use.",
  ];

  for (const fallbackIssue of fallbackIssues) {
    if (cleanedIssues.length >= 3) {
      break;
    }

    const alreadyExists =
      cleanedIssues.some((issue) => {
        return (
          issue.toLowerCase() ===
          fallbackIssue.toLowerCase()
        );
      });

    if (!alreadyExists) {
      cleanedIssues.push(fallbackIssue);
    }
  }

  return cleanedIssues.slice(0, 3);
};

const ensureThreeIssueActions = (actions) => {
  const finalActions = [...actions];

  const fallbackActions =
    getDefaultIssueActions();

  for (const fallbackAction of fallbackActions) {
    if (finalActions.length >= 3) {
      break;
    }

    const alreadyExists =
      finalActions.some((existingAction) => {
        return (
          existingAction.toLowerCase() ===
          fallbackAction.toLowerCase()
        );
      });

    if (!alreadyExists) {
      finalActions.push(fallbackAction);
    }
  }

  return finalActions.slice(0, 3);
};

const hasVisibleIssueEvidence = (visualEvidence) => {
  if (!visualEvidence || typeof visualEvidence !== "object") {
    return false;
  }

  const waterFlow = String(
    visualEvidence.waterFlow || ""
  ).toLowerCase();

  const floodingLevel = String(
    visualEvidence.floodingLevel || ""
  ).toLowerCase();

  return (
    normalizeBoolean(visualEvidence.activeLeakVisible) ||
    waterFlow === "dripping" ||
    waterFlow === "steady" ||
    waterFlow === "spraying" ||
    waterFlow === "gushing" ||
    floodingLevel === "minor" ||
    floodingLevel === "major" ||
    normalizeBoolean(visualEvidence.burstOrRuptureVisible) ||
    normalizeBoolean(visualEvidence.sewageVisible) ||
    normalizeBoolean(visualEvidence.waterNearElectrical) ||
    normalizeBoolean(visualEvidence.immediateHazardVisible)
  );
};

const inferVisibleIssue = (aiResult) => {
  const candidates = [
    ...(Array.isArray(aiResult?.visibleRiskSignals)
      ? aiResult.visibleRiskSignals
      : []),
    ...(Array.isArray(aiResult?.issuesToFix)
      ? aiResult.issuesToFix
      : []),
  ].filter((value) => typeof value === "string");

  const issuePattern =
    /\b(leak|leaking|moisture|wet|stain|discoloration|corrosion|rust|crack|rupture|damage|deterioration|pooling|overflow|blockage|clog|loose|spray|gushing|sewage)\b/i;

  return candidates.find((value) => {
    return issuePattern.test(value);
  })?.trim() || "";
};

const createNormalizedResult = (
  aiResult,
  imageUrl
) => {
  const confidence = normalizeConfidence(
    aiResult?.confidence
  );

  const detectedObject =
    typeof aiResult?.detectedObject === "string"
      ? aiResult.detectedObject.trim()
      : "";

  const detectedIssue =
    typeof aiResult?.detectedIssue === "string"
      ? aiResult.detectedIssue.trim()
      : "";

  const effectiveDetectedIssue =
    detectedIssue || inferVisibleIssue(aiResult);

  const analysisStatus =
    normalizeAnalysisStatus(
      aiResult?.analysisStatus || aiResult?.status
    );

  if (
    analysisStatus === "LOW_CONFIDENCE" ||
    confidence === "Low"
  ) {
    return getLowConfidenceResult(
      aiResult,
      imageUrl,
      detectedObject || null
    );
  }

  if (analysisStatus === "NO_ISSUE_DETECTED") {
    const visualEvidence =
      normalizeVisualEvidence(
        aiResult?.visualEvidence
      );

    if (
      detectedObject &&
      !effectiveDetectedIssue &&
      !hasVisibleIssueEvidence(visualEvidence)
    ) {
      return getNoIssueResult(
        aiResult,
        imageUrl,
        detectedObject
      );
    }
  }

  if (!detectedObject || !effectiveDetectedIssue) {
    return getLowConfidenceResult(
      aiResult,
      imageUrl,
      detectedObject || null
    );
  }

  const issuesToFix = cleanIssuesToFix(
    aiResult?.issuesToFix,
    effectiveDetectedIssue
  );

  const visibleRiskSignals = cleanRiskSignals(
    aiResult?.visibleRiskSignals
  );

  const visualEvidence =
    normalizeVisualEvidence(
      aiResult?.visualEvidence
    );

  const riskScore = normalizeIssueRiskScore(
    aiResult,
    visualEvidence
  );

  const cleanedActions =
    cleanRecommendedActions(
      aiResult?.recommendedActions
    );

  const recommendedActions =
    ensureThreeIssueActions(cleanedActions);

  return {
    analysisStatus: "ANALYZED",
    userMessage: null,

    detectedObject: detectedObject,
    detectedIssue: effectiveDetectedIssue,
    issuesToFix: issuesToFix,
    riskScore: riskScore,
    visibleRiskSignals: visibleRiskSignals,

    visualEvidence: visualEvidence,

    category: "Plumbing",
    confidence: confidence,

    confidenceReason:
      aiResult?.confidenceReason ||
      "The plumbing object and visible issue are shown clearly enough for an assessment.",

    recommendedActions:
      recommendedActions,

    isFallback: false,
    imageUrl: imageUrl,
  };
};

const analyzeImageWithAI = async (
  imageUrl,
  { useLocalLlm = false } = {}
) => {


  if (!imageUrl) {
    console.error(
      "No image URL provided for analysis"
    );

    return getFallbackResult(imageUrl);
  }

  const provider = getProvider({ useLocalLlm });
    if (provider === "ollama") {
  return analyzeImageWithOllama(imageUrl);
}

  if (!provider) {
    console.error(
      "No AI image analysis API key is configured"
    );

    return getFallbackResult(imageUrl);
  }

  const aiClient =
    createAIClient(provider, {
      fallbackToOllama: false,
    });

  const getBackupAnalysis = async () => {
    if (isOllamaEnabled()) {
      console.warn(
        `[FixBee][AI] ${provider} vision analysis failed; retrying with Ollama`
      );
      return analyzeImageWithOllama(imageUrl);
    }

    return getFallbackResult(imageUrl);
  };

  const model =
    getModelForProvider(provider);

  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    try {
      attempt += 1;

      console.log(
        `${provider} plumbing image analysis attempt ${attempt}`
      );

      console.log(
        "Using image analysis model:",
        model
      );

      const gateResponse =
        await aiClient.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: VISION_GATE_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Classify the visible plumbing evidence in this image.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_object",
          },
          temperature: 0,
          max_tokens: 300,
        });

      const gateContent =
        gateResponse.choices?.[0]?.message?.content;

      if (!gateContent) {
        console.error(
          `${provider} returned empty visual-gate content`
        );
        return getBackupAnalysis();
      }

      let gateResult;

      try {
        gateResult = JSON.parse(gateContent);
      } catch (error) {
        console.error(
          `${provider} returned invalid visual-gate JSON:`,
          gateContent
        );
        return getBackupAnalysis();
      }

      const gatedResult = createResultFromVisualGate(
        gateResult,
        imageUrl
      );

      if (gatedResult) {
        return gatedResult;
      }

      const response =
        await aiClient.chat.completions.create({
          model: model,

          messages: [
            {
              role: "system",
              content: SHARED_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${ANALYSIS_REQUEST_PROMPT}\n\nVISUAL GATE RESULT:\n${JSON.stringify(gateResult)}`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],

          response_format: {
            type: "json_object",
          },

          temperature: 0.1,
          max_tokens: 900,
        });

      const content =
        response.choices?.[0]?.message?.content;

      if (!content) {
        console.error(
          `${provider} returned empty image-analysis content`
        );

        return getBackupAnalysis();
      }

      let aiResult;

      try {
        aiResult = JSON.parse(content);
      } catch (error) {
        console.error(
          `${provider} returned invalid image-analysis JSON:`,
          content
        );

        return getBackupAnalysis();
      }

      if (
        !Array.isArray(aiResult?.visibleRiskSignals) ||
        aiResult.visibleRiskSignals.length === 0
      ) {
        aiResult.visibleRiskSignals =
          gateResult?.abnormalEvidence;
      }

      return createNormalizedResult(
        aiResult,
        imageUrl
      );
    } catch (error) {
      if (
        error?.status === 429 &&
        attempt <= maxRetries
      ) {
        console.warn(
          `${provider} rate limit reached. Retrying in 3 seconds...`
        );

        await new Promise((resolve) => {
          setTimeout(resolve, 3000);
        });

        continue;
      }

      if (
        error?.status >= 500 &&
        attempt <= maxRetries
      ) {
        console.warn(
          `${provider} server error. Retrying in 2 seconds...`
        );

        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });

        continue;
      }

      console.error(
        `${provider} image analysis failed after retries:`,
        error.message
      );

      return getBackupAnalysis();
    }
  }

  return getBackupAnalysis();
};

export { analyzeImageWithAI };
