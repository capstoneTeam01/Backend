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

  const normalizedConfidence = confidence.toLowerCase();

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
    "Keep the full fixture and damaged area visible.",
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
You are a cautious plumbing image-analysis assistant for a mobile app called FixBee.

Analyze the uploaded image and return ONLY one valid JSON object.
Do not include markdown, comments, explanations, or extra text.

Return exactly these fields:

{
  "detectedObject": "string or null",
  "detectedIssue": "string or null",
  "repairCategory": "Plumbing",
  "confidence": "Low, Medium, or High",
  "confidenceReason": "short explanation of why this confidence level was selected",
  "recommendedActions": ["safe user actions"]
}

Allowed repairCategory value:
["Plumbing"]

Allowed confidence values:
["Low", "Medium", "High"]

IMPORTANT IMAGE-QUALITY RULES:

- First evaluate whether the image is clear enough for reliable analysis.
- If the image is blurry, motion-blurred, dark, overexposed, distant, cropped, obstructed, or the affected area is not clearly visible:
  - confidence MUST be "Low"
  - detectedIssue MUST be null
  - do not guess a plumbing failure
  - recommendedActions must only tell the user how to retake the photo
- Do not identify a specific problem from the general shape of an object alone.
- Do not claim a leak, clog, damage, or failure unless visible evidence supports it.
- If visible evidence is insufficient, return confidence "Low".
- Medium confidence requires visible evidence of a possible issue, but some uncertainty remains.
- High confidence requires the object and visible issue to be clearly shown.
- Never invent severity, cost, repair time, tools, or DIY repair steps.
- Never provide a final diagnosis.
- Use wording such as "possible", "appears", or "may indicate" when certainty is limited.
- Keep all actions safe and suitable for a homeowner.
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

  let recommendedActions = [];

  if (Array.isArray(aiResult?.recommendedActions)) {
    recommendedActions =
      aiResult.recommendedActions.filter((action) => {
        return (
          typeof action === "string" &&
          action.trim() !== ""
        );
      });
  }

  if (recommendedActions.length === 0) {
    recommendedActions = [
      "Avoid using the affected fixture until it is checked.",
      "Monitor the area for visible leaking or further damage.",
      "Contact a licensed plumber if the issue becomes worse.",
    ];
  }

  return {
    analysisStatus: "ANALYZED",
    userMessage: null,
    detectedObject: detectedObject,
    detectedIssue: detectedIssue,
    category: "Plumbing",
    confidence: confidence,
    confidenceReason:
      aiResult?.confidenceReason ||
      "The object and possible issue are visible in the image.",
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
                    "First evaluate image clarity. Only identify a plumbing issue when visible evidence is clear enough. Return only the required JSON object.",
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