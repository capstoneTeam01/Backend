import { getProvider, createAIClient } from "./aiClientService.js";

const GROQ_TEXT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

const getModelForProvider = (provider) => {
  if (provider === "groq") {
    return GROQ_TEXT_MODEL;
  }

  if (provider === "openai") {
    return OPENAI_TEXT_MODEL;
  }

  return null;
};

const getFallbackDiyInstructions = (analysisResult, urgency = "Low") => {
  return {
    title: "Basic Safety Guidance",
    summary:
      "These are temporary safety steps only. Contact a professional if the issue continues or becomes worse.",
    difficulty: urgency === "High" ? "Temporary safety only" : "Basic",
    estimatedTime: "10 - 20 minutes",
    toolsNeeded: ["Bucket", "Towel", "Flashlight"],
    repairSteps: [
      {
        stepNumber: 1,
        title: "Stop Using the Affected Area",
        instruction:
          "Avoid using the affected fixture or area until the issue is checked.",
      },
      {
        stepNumber: 2,
        title: "Control Visible Water",
        instruction:
          "Place a bucket or towel near the leak if it is safe to do so.",
      },
      {
        stepNumber: 3,
        title: "Monitor the Issue",
        instruction:
          "Check whether the problem is getting worse and avoid attempting complex repairs.",
      },
    ],
    safetyWarnings: [
      "Stop immediately if water is spreading quickly.",
      "Do not continue if electrical outlets, wiring, or appliances are near water.",
      "Contact a licensed professional if the issue continues.",
    ],
    professionalAdvice:
      "This guidance is not a final repair. A licensed service provider should inspect the issue if it continues or appears unsafe.",
    source: "Backend fallback DIY guidance",
  };
};

const generateDiyInstructions = async (
  analysisResult,
  urgency = "Low"
) => {
  const provider = getProvider();

  if (!provider) {
    console.error("No AI provider API key is configured for DIY instructions");
    return getFallbackDiyInstructions(analysisResult, urgency);
  }

  const aiClient = createAIClient(provider);
  const model = getModelForProvider(provider);

  const promptPayload = {
    task: "Generate safe DIY guidance for a home repair issue in the FixBee app.",
    detectedObject: analysisResult?.detectedObject || "Unknown object",
    detectedIssue: analysisResult?.detectedIssue || "Unknown issue",
    category: analysisResult?.category || "Plumbing",
    confidence: analysisResult?.confidence || "Low",
    urgency,
    rules: [
      "Return only valid JSON.",
      "Do not include markdown.",
      "Do not suggest risky or advanced repairs.",
      "Do not ask the user to handle electrical wiring, gas lines, sewage, or unsafe repairs.",
      "For High urgency, provide temporary safety steps only and recommend a professional.",
      "For Low or Medium urgency, provide simple beginner-friendly steps only.",
      "Use clear short instructions suitable for a mobile app screen.",
      "Do not claim the issue is fully fixed unless inspected or confirmed.",
      "For High urgency, avoid calling it a full fix. Use wording like temporary safety steps or temporary control steps.",
    ],
    requiredJsonFields: {
      title: "string",
      summary: "string",
      difficulty: "Basic, Moderate, or Temporary safety only",
      estimatedTime: "string",
      toolsNeeded: ["string"],
      repairSteps: [
        {
          stepNumber: "number",
          title: "string",
          instruction: "string",
        },
      ],
      safetyWarnings: ["string"],
      professionalAdvice: "string",
    },
  };

  try {
    console.log(`${provider} DIY instruction generation started`);
    console.log("Using DIY instruction model:", model);

    const response = await aiClient.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a safe home repair guidance assistant for FixBee. Return only valid JSON.",
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
      max_tokens: 900,
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`${provider} returned empty DIY instruction content`);
      return getFallbackDiyInstructions(analysisResult, urgency);
    }

    const diyResult = JSON.parse(content);

    return {
      title: diyResult.title || "DIY Guidance",
      summary:
        diyResult.summary ||
        "Follow these basic safety steps and contact a professional if needed.",
      difficulty: diyResult.difficulty || "Basic",
      estimatedTime: diyResult.estimatedTime || "10 - 20 minutes",
      toolsNeeded: Array.isArray(diyResult.toolsNeeded)
        ? diyResult.toolsNeeded
        : ["Bucket", "Towel", "Flashlight"],
      repairSteps: Array.isArray(diyResult.repairSteps)
        ? diyResult.repairSteps
        : getFallbackDiyInstructions(analysisResult, urgency).repairSteps,
      safetyWarnings: Array.isArray(diyResult.safetyWarnings)
        ? diyResult.safetyWarnings
        : getFallbackDiyInstructions(analysisResult, urgency).safetyWarnings,
      professionalAdvice:
        diyResult.professionalAdvice ||
        "Contact a licensed professional if the issue continues or appears unsafe.",
      source:
        provider === "groq"
          ? "Groq DIY guidance"
          : "OpenAI DIY guidance",
    };
  } catch (error) {
    console.error(`${provider} DIY instruction generation failed:`, error.message);
    return getFallbackDiyInstructions(analysisResult, urgency);
  }
};

export { generateDiyInstructions };