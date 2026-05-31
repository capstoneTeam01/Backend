import { getProvider, createAIClient } from "./aiClientService.js";

const GROQ_COST_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const OPENAI_COST_MODEL = process.env.OPENAI_COST_MODEL || "gpt-4o-mini";


const getCostModel = (provider) => {
    if (provider === "groq") {
        return GROQ_COST_MODEL;
    }

    if (provider === "openai") {
        return OPENAI_COST_MODEL;
    }

    return null;
};

const getFallbackCostEstimate = (analysisResult, urgency, location) => {
    return {
        providerType: "Licensed Plumber",
        estimatedRepairTime: "1 - 3 hours",
        laborRateRange: "$90 - $160 per hour",
        partsCostRange: "$30 - $200",
        estimatedCostRange: "$120 - $680",
        currency: "CAD",
        locationUsed: location || "Vancouver, BC, Canada",
        costConfidence: "Low",
        costSource: "Backend fallback estimate",
        costNote:
            "This is a rough fallback estimate. Final cost may vary after inspection, parts, location, and contractor quote.",
    };
};

const estimateRepairCost = async (
    analysisResult,
    urgency = "Low",
    location = "Vancouver, BC, Canada"
) => {
    const provider = getProvider();

    if (!provider) {
        console.error("No AI cost estimation API key is configured");
        return getFallbackCostEstimate(analysisResult, urgency, location);
    }

    const aiClient = createAIClient(provider);
    const model = getCostModel(provider);

    const promptPayload = {
        task: "Estimate home repair cost for FixBee backend response.",
        location,
        currency: "CAD",
        category: analysisResult?.category || "Plumbing",
        detectedObject: analysisResult?.detectedObject || "Unknown object",
        detectedIssue: analysisResult?.detectedIssue || "Unknown issue",
        confidence: analysisResult?.confidence || "Low",
        urgency,
        rules: [
            "Return only valid JSON.",
            "Do not include markdown.",
            "Estimate based on typical plumbing repair market rates in Vancouver, BC, Canada.",
            "Do not invent a specific company price.",
            "Use ranges, not exact fixed cost.",
            "Keep estimates realistic for homeowner repair recommendations.",
        ],
        requiredJsonFields: {
            providerType: "string",
            estimatedRepairTime: "string",
            laborRateRange: "string",
            partsCostRange: "string",
            estimatedCostRange: "string",
            currency: "CAD",
            locationUsed: "string",
            costConfidence: "Low, Medium, or High",
            costSource: "string",
            costNote: "string",
        },
    };

    try {
        console.log(`${provider} cost estimation started`);
        console.log("Using cost model:", model);

        const response = await aiClient.chat.completions.create({
            model,
            messages: [
                {
                    role: "system",
                    content:
                        "You are a backend cost estimation assistant for a home repair app. Return only valid JSON.",
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

        const content = response.choices?.[0]?.message?.content;

        if (!content) {
            console.error(`${provider} returned empty cost content`);
            return getFallbackCostEstimate(analysisResult, urgency, location);
        }

        const costResult = JSON.parse(content);

        return {
            providerType: costResult.providerType || "Licensed Plumber",
            estimatedRepairTime: costResult.estimatedRepairTime || "1 - 3 hours",
            laborRateRange: costResult.laborRateRange || "$90 - $160 per hour",
            partsCostRange: costResult.partsCostRange || "$30 - $200",
            estimatedCostRange: costResult.estimatedCostRange || "$120 - $680",
            currency: "CAD",
            locationUsed: costResult.locationUsed || location,
            costConfidence: costResult.costConfidence || "Medium",
            costSource:
                provider === "groq"
                    ? "Groq market estimate"
                    : "OpenAI market estimate",
            costNote:
                costResult.costNote ||
                "Estimated costs are approximate and may vary based on inspection, parts, and contractor quote.",
        };
    } catch (error) {
        console.error(`${provider} cost estimation failed:`, error.message);
        return getFallbackCostEstimate(analysisResult, urgency, location);
    }
};

export { estimateRepairCost };