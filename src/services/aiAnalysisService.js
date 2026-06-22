import { getProvider, createAIClient } from "./aiClientService.js";

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "meta-llama/llama-4-scout-17b-16e-instruct";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

  const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || "llava";

const getFallbackResult = (imageUrl) => {
  return {
    detectedObject: "Unable to analyze plumbing image",
    detectedIssue: "Analysis could not be completed",
    category: "Plumbing",
    confidence: "Low",
    recommendedActions: [
      "Try uploading a clearer photo with better lighting.",
      "Make sure the pipe, sink, drain, toilet, faucet, or leak area is fully visible.",
      "Take the photo from a closer angle if it is safe.",
      "Contact a licensed plumber if there is active leaking, flooding, or water damage.",
    ],
    isFallback: true,
    imageUrl,
  };
};

const SYSTEM_PROMPT = `
You are an expert plumbing repair assistant for a mobile app called FixBee.

Analyze the uploaded image and return ONLY a valid JSON object.
Do not include markdown, explanation, or extra text.

Return these exact fields:
{
  "detectedObject": "short description of the visible plumbing object or area",
  "detectedIssue": "specific possible plumbing issue",
  "repairCategory": "Plumbing",
  "recommendedActions": ["3 to 4 safe homeowner actions"],
  "confidence": "Low, Medium, or High"
}

Allowed repairCategory value:
["Plumbing"]

Allowed confidence values:
["Low", "Medium", "High"]

Rules:
- Only analyze plumbing-related issues.
- Plumbing examples include leaks, pipes, faucets, sinks, toilets, drains, water stains, water damage, clogged drains, broken fixtures, and visible plumbing connections.
- Do NOT invent final repair prices.
- Do NOT include dollar amounts.
- Do NOT claim certainty if the image is unclear.
- If the image is unclear, unrelated, or not enough information is visible, still return repairCategory "Plumbing" and confidence "Low".
- Keep recommendedActions practical and safe.
- For active leaks, recommend turning off the nearby water supply if safe.
- For flooding or major leakage, recommend contacting a licensed plumber urgently.
`;

const normalizeConfidence = (confidence) => {
  const allowedConfidence = ["Low", "Medium", "High"];

  if (allowedConfidence.includes(confidence)) {
    return confidence;
  }

  return "Low";
};

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

const analyzeImageWithAI = async (imageUrl) => {
  if (!imageUrl) {
    console.error("No image URL provided for analysis");
    return getFallbackResult(imageUrl);
  }

  const provider = getProvider();

  if (!provider) {
    console.error("No AI image analysis API key is configured");
    return getFallbackResult(imageUrl);
  }

  const aiClient = createAIClient(provider);
  const model = getModelForProvider(provider);

  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    try {
      attempt += 1;

      console.log(`${provider} plumbing image analysis attempt ${attempt}`);
      console.log("Using image analysis model:", model);

      const response = await aiClient.chat.completions.create({
        model,
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
                text: "Analyze this plumbing repair image and return only the JSON object.",
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
        temperature: 0.2,
        max_tokens: 600,
      });

      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        console.error(`${provider} returned empty content`);
        return getFallbackResult(imageUrl);
      }

      let aiResult;

      try {
        aiResult = JSON.parse(content);
      } catch (error) {
        console.error(`${provider} returned invalid JSON:`, content);
        return getFallbackResult(imageUrl);
      }

      const confidence = normalizeConfidence(aiResult.confidence);

      return {
        detectedObject: aiResult.detectedObject || "Unknown plumbing object",
        detectedIssue: aiResult.detectedIssue || "Unknown plumbing issue",
        category: "Plumbing",
        confidence,
        recommendedActions: Array.isArray(aiResult.recommendedActions)
          ? aiResult.recommendedActions
          : ["Consult a licensed plumber for inspection."],
        isFallback: false,
        imageUrl,
      };
    } catch (error) {
      if (error?.status === 429 && attempt <= maxRetries) {
        console.warn(`${provider} rate limit reached. Retrying in 3 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      if (error?.status >= 500 && attempt <= maxRetries) {
        console.warn(`${provider} server error. Retrying in 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      console.error(`${provider} image analysis failed after retries:`, error.message);
      return getFallbackResult(imageUrl);
    }
  }

  return getFallbackResult(imageUrl);
};

export { analyzeImageWithAI };