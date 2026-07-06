import {
  getProvider,
  createAIClient,
} from "./aiClientService.js";

const GROQ_COST_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const OPENAI_COST_MODEL =
  process.env.OPENAI_COST_MODEL || "gpt-4o-mini";

const OLLAMA_COST_MODEL =
  process.env.OLLAMA_TEXT_MODEL || "llama3.2";

const DEFAULT_LOCATION = "Vancouver, BC, Canada";

const getCostModel = (provider) => {
  if (provider === "groq") {
    return GROQ_COST_MODEL;
  }

  if (provider === "openai") {
    return OPENAI_COST_MODEL;
  }
  if (provider === "ollama") {
    return OLLAMA_COST_MODEL;
  }

  return null;
};

const isLowConfidence = (analysisResult) => {
  const confidence = analysisResult?.confidence || "Low";

  return confidence.toLowerCase() === "low";
};

const normalizeCostConfidence = (confidence) => {
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

const normalizeRangeSeparator = (value) => {
  return value
    .replace(/\s*-\s*/g, "–")
    .replace(/\s*to\s*/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeMoneyRange = (value, type) => {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let normalizedValue = normalizeRangeSeparator(value);

  normalizedValue = normalizedValue
    .replace(/\bCAD\b/gi, "")
    .replace(/\bper\s+hour\b/gi, "")
    .replace(/\/\s*hour/gi, "")
    .replace(/\/\s*hr/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedValue.startsWith("$")) {
    normalizedValue = `$${normalizedValue}`;
  }

  if (type === "labor") {
    return `${normalizedValue} CAD/hour`;
  }

  return `${normalizedValue} CAD`;
};

const normalizeRepairTime = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let normalizedValue = normalizeRangeSeparator(value);

  normalizedValue = normalizedValue
    .replace(/^approximately\s+/i, "")
    .replace(/^about\s+/i, "")
    .replace(/^around\s+/i, "")
    .replace(/\bHours\b/g, "hours")
    .replace(/\bHour\b/g, "hour")
    .replace(/\bMinutes\b/g, "minutes")
    .replace(/\bMinute\b/g, "minute")
    .replace(/\bDays\b/g, "days")
    .replace(/\bDay\b/g, "day")
    .trim();

  return `Approximately ${normalizedValue}`;
};

const getUnavailableCostEstimate = () => {
  return {
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
  };
};

const getFallbackCostEstimate = (
  analysisResult,
  urgency,
  location
) => {
  return {
    providerType: "Licensed Plumber",
    estimatedRepairTime: "Approximately 1–3 hours",
    laborRateRange: "$90–$160 CAD/hour",
    partsCostRange: "$30–$200 CAD",
    estimatedCostRange: "$120–$680 CAD",
    currency: "CAD",
    locationUsed: location || DEFAULT_LOCATION,
    costConfidence: "Low",
    costSource: "Backend fallback estimate",
    costNote:
      "This is an approximate fallback range, not a guaranteed quote. Actual cost and repair time may change after inspection, parts availability, site conditions, and contractor assessment.",
  };
};

const estimateRepairCost = async (
  analysisResult,
  urgency = "Low",
  location = DEFAULT_LOCATION
) => {
  if (isLowConfidence(analysisResult)) {
    console.log(
      "Cost estimation skipped because image analysis confidence is low"
    );

    return getUnavailableCostEstimate();
  }

  const provider = getProvider();

  if (!provider) {
    console.error(
      "No AI cost estimation API key is configured"
    );

    return getFallbackCostEstimate(
      analysisResult,
      urgency,
      location
    );
  }

  const aiClient = createAIClient(provider);
  const model = getCostModel(provider);

  const promptPayload = {
    task:
      "Provide an approximate home-repair cost and repair-time range for the FixBee backend.",
    location: location,
    currency: "CAD",
    category:
      analysisResult?.category || "Plumbing",
    detectedObject:
      analysisResult?.detectedObject || "Unknown object",
    detectedIssue:
      analysisResult?.detectedIssue || "Unknown issue",
    confidence:
      analysisResult?.confidence || "Low",
    urgency: urgency,
    rules: [
      "Return only valid JSON.",
      "Do not include markdown.",
      "Use typical plumbing repair market ranges for the supplied location.",
      "Use realistic broad ranges instead of exact promises.",
      "Do not invent a specific contractor or company price.",
      "Estimate likely on-site inspection and repair time, not appointment waiting time or travel time.",
      "Use uppercase CAD for every monetary value.",
      "Format laborRateRange like '$90–$160 CAD/hour'.",
      "Format partsCostRange like '$30–$200 CAD'.",
      "Format estimatedCostRange like '$120–$680 CAD'.",
      "Format estimatedRepairTime like 'Approximately 1–3 hours'.",
      "Ensure estimatedCostRange is reasonably consistent with labor rate, likely labor time, and parts cost.",
      "Do not claim the price or repair duration is guaranteed.",
      "Explain that the estimate may change after professional inspection.",
      "If the available diagnosis is not reliable, do not provide a cost estimate.",
    ],
    requiredJsonFields: {
      providerType: "string",
      estimatedRepairTime:
        "Approximately X–Y hours, minutes, or days",
      laborRateRange: "$MIN–$MAX CAD/hour",
      partsCostRange: "$MIN–$MAX CAD",
      estimatedCostRange: "$MIN–$MAX CAD",
      currency: "CAD",
      locationUsed: "string",
      costConfidence: "Low, Medium, or High",
      costNote: "string",
    },
  };

  try {
    console.log(`${provider} cost estimation started`);
    console.log("Using cost model:", model);

    const response =
      await aiClient.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You estimate approximate home-repair costs for FixBee. Return only valid JSON. Never present estimates as guaranteed prices or guaranteed repair times.",
          },
          {
            role: "user",
            content: JSON.stringify(promptPayload),
          },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0.2,
        max_tokens: 600,
      });

    const content =
      response.choices?.[0]?.message?.content;

    if (!content) {
      console.error(
        `${provider} returned empty cost content`
      );

      return getFallbackCostEstimate(
        analysisResult,
        urgency,
        location
      );
    }

    const costResult = JSON.parse(content);

    const estimatedRepairTime =
      normalizeRepairTime(
        costResult.estimatedRepairTime
      ) || "Approximately 1–3 hours";

    const laborRateRange =
      normalizeMoneyRange(
        costResult.laborRateRange,
        "labor"
      ) || "$90–$160 CAD/hour";

    const partsCostRange =
      normalizeMoneyRange(
        costResult.partsCostRange,
        "parts"
      ) || "$30–$200 CAD";

    const estimatedCostRange =
      normalizeMoneyRange(
        costResult.estimatedCostRange,
        "total"
      ) || "$120–$680 CAD";

    let costSource = "OpenAI market estimate";

    if (provider === "groq") {
      costSource = "Groq market estimate";
    }

    return {
      providerType:
        costResult.providerType ||
        "Licensed Plumber",
      estimatedRepairTime: estimatedRepairTime,
      laborRateRange: laborRateRange,
      partsCostRange: partsCostRange,
      estimatedCostRange: estimatedCostRange,
      currency: "CAD",
      locationUsed:
        costResult.locationUsed || location,
      costConfidence: normalizeCostConfidence(
        costResult.costConfidence
      ),
      costSource: costSource,
      costNote:
        costResult.costNote ||
        "This estimate is approximate and may change after inspection, parts availability, site conditions, and contractor assessment.",
    };
  } catch (error) {
    console.error(
      `${provider} cost estimation failed:`,
      error.message
    );

    return getFallbackCostEstimate(
      analysisResult,
      urgency,
      location
    );
  }
};

export { estimateRepairCost };