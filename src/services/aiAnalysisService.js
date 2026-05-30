import OpenAI from "openai";

const PLUMBING_COST_RANGE = "$150 - $400";
const PLUMBING_PROVIDER_TYPE = "Licensed Plumber";

const getFallbackResult = (imageUrl) => {
  return {
    detectedObject: "Unable to analyze plumbing image",
    detectedIssue: "Analysis could not be completed",
    category: "Plumbing",
    confidence: "Low",
    providerType: PLUMBING_PROVIDER_TYPE,
    estimatedCostRange: PLUMBING_COST_RANGE,
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
- If the image is unclear, unrelated, or not enough information is visible, still return repairCategory "Plumbing", urgencyLevel "Low", and confidence "Low".
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

const analyzeImageWithAI = async (imageUrl) => {
  if (!imageUrl) {
    console.error("No image URL provided for analysis");
    return getFallbackResult(imageUrl);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key is not configured");
    return getFallbackResult(imageUrl);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    try {
      attempt += 1;
      console.log(`AI plumbing analysis attempt ${attempt}`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: "text",
                text: "Analyze this plumbing repair image and return only the JSON object.",
              },
            ],
          },
        ],
        response_format: {
          type: "json_object",
        },
        max_tokens: 600,
      });

      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        console.error("OpenAI returned empty content");
        return getFallbackResult(imageUrl);
      }

      let aiResult;

      try {
        aiResult = JSON.parse(content);
      } catch (error) {
        console.error("AI returned invalid JSON:", content);
        return getFallbackResult(imageUrl);
      }

      const confidence = normalizeConfidence(aiResult.confidence);

      return {
        detectedObject: aiResult.detectedObject || "Unknown plumbing object",
        detectedIssue: aiResult.detectedIssue || "Unknown plumbing issue",
        category: "Plumbing",
        confidence,
        providerType: PLUMBING_PROVIDER_TYPE,
        estimatedCostRange: PLUMBING_COST_RANGE,
        recommendedActions: Array.isArray(aiResult.recommendedActions)
          ? aiResult.recommendedActions
          : ["Consult a licensed plumber for inspection."],
        isFallback: false,
        imageUrl,
      };
    } catch (error) {
      if (error?.status === 429 && attempt <= maxRetries) {
        console.warn("OpenAI rate limit reached. Retrying in 3 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      if (error?.status >= 500 && attempt <= maxRetries) {
        console.warn("OpenAI server error. Retrying in 2 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      console.error("AI plumbing analysis failed after retries:", error.message);
      return getFallbackResult(imageUrl);
    }
  }

  return getFallbackResult(imageUrl);
};

export { analyzeImageWithAI };