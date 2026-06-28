import {
  getProvider,
  createAIClient,
} from "./aiClientService.js";

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "meta-llama/llama-4-scout-17b-16e-instruct";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || "llava";

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
    confidence.toLowerCase();

  if (normalizedConfidence === "high") {
    return "High";
  }

  if (normalizedConfidence === "medium") {
    return "Medium";
  }

  return "Low";
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
    category: "Plumbing",
    confidence: "Low",
    confidenceReason:
      "The image analysis could not be completed reliably.",
    recommendedActions: getRetakePhotoActions(),
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
  "repairCategory": "Plumbing",
  "confidence": "Low, Medium, or High",
  "confidenceReason": "short explanation of why this confidence level was selected",
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
- If confidence is Low:
  - detectedIssue must be null;
  - recommendedActions must contain photo-retake guidance only.
- If confidence is Medium or High:
  - detectedObject and detectedIssue must be populated;
  - recommendedActions must relate only to the detected plumbing issue;
  - do not include photo, camera, lighting, framing, focus, capture, or retake advice.

ISSUE ANALYSIS RULES:

- Identify the visible plumbing object.
- Identify only issues supported by visible evidence.
- Use cautious wording such as "possible", "appears", or "may indicate" when certainty is limited.
- Do not provide a final diagnosis.
- Do not invent hidden damage or internal causes that are not visible.
- Do not invent severity, repair cost, repair time, tools, or DIY instructions.
- Keep the detectedIssue short and specific.

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
    category: "Plumbing",
    confidence: "Low",
    confidenceReason:
      aiResult?.confidenceReason ||
      "The affected area is not visible clearly enough for a reliable assessment.",
    recommendedActions: getRetakePhotoActions(),
    isFallback: false,
    imageUrl: imageUrl,
  };
};

const cleanRecommendedActions = (actions) => {
  if (!Array.isArray(actions)) {
    return [];
  }

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

  const cleanedActions = [];

  for (const action of actions) {
    if (
      typeof action !== "string" ||
      action.trim() === ""
    ) {
      continue;
    }

    const trimmedAction = action.trim();
    const normalizedAction =
      trimmedAction.toLowerCase();

    const isCameraAdvice =
      cameraAdviceKeywords.some((keyword) => {
        return normalizedAction.includes(keyword);
      });

    if (isCameraAdvice) {
      continue;
    }

    const isDuplicate =
      cleanedActions.some((existingAction) => {
        return (
          existingAction.toLowerCase() ===
          normalizedAction
        );
      });

    if (!isDuplicate) {
      cleanedActions.push(trimmedAction);
    }
  }

  return cleanedActions;
};

const ensureThreeIssueActions = (actions) => {
  const finalActions = [...actions];
  const fallbackActions = getDefaultIssueActions();

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
    category: "Plumbing",
    confidence: confidence,
    confidenceReason:
      aiResult?.confidenceReason ||
      "The plumbing object and possible issue are visible in the image.",
    recommendedActions: recommendedActions,
    isFallback: false,
    imageUrl: imageUrl,
  };
};

const analyzeImageWithAI = async (imageUrl) => {
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

  const aiClient = createAIClient(provider);
  const model = getModelForProvider(provider);

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
                    "Analyze this plumbing image. Use Low confidence only when the image is genuinely unusable and identifying an issue would require guessing. For Medium or High confidence, return exactly three issue-specific recommended actions and do not include camera, photo, focus, lighting, framing, or retake advice. Return only the required JSON object.",
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
          max_tokens: 700,
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