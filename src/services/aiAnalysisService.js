import {
  getProvider,
  createAIClient,
} from "./aiClientService.js";

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "meta-llama/llama-4-scout-17b-16e-instruct";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ||
  "gpt-4o-mini";

const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL ||
  "llava";

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

const getFallbackResult = (imageUrl) => {
  return {
    analysisStatus: "ANALYSIS_FAILED",

    userMessage:
      "FixBee could not analyze this image reliably. Please retake the photo.",

    detectedObject: null,
    detectedIssue: null,
    issuesToFix: [],

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
  "detectedObject": "string or null",
  "detectedIssue": "string or null",
  "issuesToFix": [
    "first visible repair concern",
    "second visible repair concern"
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

LOW-CONFIDENCE OUTPUT RULES:

If confidence is Low:

- detectedIssue must be null;
- issuesToFix must be an empty array;
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

If confidence is Medium or High:

- detectedObject must be populated;
- detectedIssue must be populated;
- issuesToFix must contain between one and three concise visible repair concerns;
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
- Return a maximum of three distinct items.

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

  if (cleanedIssues.length > 0) {
    return cleanedIssues;
  }

  if (
    typeof detectedIssue === "string" &&
    detectedIssue.trim() !== ""
  ) {
    return [detectedIssue.trim()];
  }

  return [];
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

  if (confidence === "Low") {
    return getLowConfidenceResult(
      aiResult,
      imageUrl,
      detectedObject || null
    );
  }

  if (!detectedObject || !detectedIssue) {
    return getLowConfidenceResult(
      aiResult,
      imageUrl,
      detectedObject || null
    );
  }

  const issuesToFix = cleanIssuesToFix(
    aiResult?.issuesToFix,
    detectedIssue
  );

  const visualEvidence =
    normalizeVisualEvidence(
      aiResult?.visualEvidence
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
    detectedIssue: detectedIssue,
    issuesToFix: issuesToFix,

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
  imageUrl
) => {
  if (!imageUrl) {
    console.error(
      "No image URL provided for analysis"
    );

    return getFallbackResult(imageUrl);
  }

  const provider = getProvider();

  if (!provider) {
    console.error(
      "No AI image analysis API key is configured"
    );

    return getFallbackResult(imageUrl);
  }

  const aiClient =
    createAIClient(provider);

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

      const response =
        await aiClient.chat.completions.create({
          model: model,

          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Analyze this plumbing image. Use Low confidence only when the image is genuinely unusable. For a usable image, return detectedObject, detectedIssue, one to three visible issuesToFix, structured visualEvidence, and exactly three issue-specific recommendedActions. Clearly identify visible dripping, steady flow, pressurized spraying, gushing, burst pipes, standing water, major flooding, sewage, or water near electrical equipment. Return only the required JSON object.",
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

        return getFallbackResult(imageUrl);
      }

      let aiResult;

      try {
        aiResult = JSON.parse(content);
      } catch (error) {
        console.error(
          `${provider} returned invalid image-analysis JSON:`,
          content
        );

        return getFallbackResult(imageUrl);
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

      return getFallbackResult(imageUrl);
    }
  }

  return getFallbackResult(imageUrl);
};

export { analyzeImageWithAI };