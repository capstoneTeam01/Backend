import {
  getProvider,
  createAIClient,
} from "./aiClientService.js";

const GROQ_TEXT_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const OPENAI_TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

const OLLAMA_TEXT_MODEL =
  process.env.OLLAMA_TEXT_MODEL || "llama3.2";

const getModelForProvider = (provider) => {
  if (provider === "groq") {
    return GROQ_TEXT_MODEL;
  }

  if (provider === "openai") {
    return OPENAI_TEXT_MODEL;
  }

  if (provider === "ollama") {
    return OLLAMA_TEXT_MODEL;
  }

  return null;
};

const normalizeUrgency = (urgency) => {
  if (typeof urgency !== "string") {
    return "Low";
  }

  const normalizedUrgency = urgency.toLowerCase();

  if (normalizedUrgency === "critical") {
    return "Critical";
  }

  if (normalizedUrgency === "high") {
    return "High";
  }

  if (normalizedUrgency === "medium") {
    return "Medium";
  }

  return "Low";
};

const isLowConfidence = (analysisResult) => {
  const confidence = analysisResult?.confidence || "Low";

  return confidence.toLowerCase() === "low";
};

const getDetectedObjectLabel = (analysisResult) => {
  if (
    typeof analysisResult?.detectedObject === "string" &&
    analysisResult.detectedObject.trim() !== ""
  ) {
    return analysisResult.detectedObject.trim();
  }

  return "affected plumbing area";
};

const getDetectedIssueLabel = (analysisResult) => {
  if (
    typeof analysisResult?.detectedIssue === "string" &&
    analysisResult.detectedIssue.trim() !== ""
  ) {
    return analysisResult.detectedIssue.trim();
  }

  return "possible plumbing issue";
};

const getCriticalFallbackInstructions = (analysisResult) => {
  const detectedIssue = getDetectedIssueLabel(analysisResult);

  return {
    title: "Emergency Safety Steps",
    summary:
      `FixBee identified ${detectedIssue}. Do not attempt a full repair. Use these temporary safety steps while arranging immediate professional help.`,
    difficulty: "Temporary safety only",
    estimatedTime: "Approximately 5–10 minutes",
    toolsNeeded: [
      "Flashlight",
      "Bucket or container",
      "Absorbent towels",
      "Protective gloves",
    ],
    repairSteps: [
      {
        stepNumber: 1,
        title: "Keep People Away",
        instruction:
          "Keep children, pets, and other people away from the affected area.",
      },
      {
        stepNumber: 2,
        title: "Shut Off Water If Safe",
        instruction:
          "Turn off the nearest water shutoff valve or the main water supply only if it is safe and accessible.",
      },
      {
        stepNumber: 3,
        title: "Avoid Electrical Hazards",
        instruction:
          "Do not touch water near outlets, wiring, appliances, electrical panels, or extension cords.",
      },
      {
        stepNumber: 4,
        title: "Limit Water Spread",
        instruction:
          "Use buckets and towels to contain water only when this can be done without entering an unsafe area.",
      },
      {
        stepNumber: 5,
        title: "Contact Emergency Help",
        instruction:
          "Contact a licensed plumber or appropriate emergency service immediately.",
      },
    ],
    safetyWarnings: [
      "Do not attempt to dismantle or repair the damaged component.",
      "Leave the area if sewage, contaminated water, structural damage, or electrical danger is present.",
      "Do not restore the water supply until the issue has been professionally inspected.",
    ],
    professionalAdvice:
      "This is a critical issue. These steps are temporary damage-control measures and are not a repair.",
    source: "Backend fallback DIY guidance",
  };
};

const getStandardFallbackInstructions = (
  analysisResult,
  urgency
) => {
  const detectedObject = getDetectedObjectLabel(analysisResult);
  const detectedIssue = getDetectedIssueLabel(analysisResult);

  const temporaryOnly = urgency === "High";

  return {
    title: temporaryOnly
      ? "Temporary Plumbing Safety Steps"
      : `Basic Check for ${detectedObject}`,
    summary: temporaryOnly
      ? `FixBee identified ${detectedIssue}. Follow these temporary control steps and arrange professional inspection.`
      : `FixBee identified ${detectedIssue}. These steps help you inspect the area safely without attempting an advanced repair.`,
    difficulty: temporaryOnly
      ? "Temporary safety only"
      : "Basic",
    estimatedTime: "Approximately 10–20 minutes",
    toolsNeeded: [
      "Flashlight",
      "Bucket or container",
      "Absorbent towels",
      "Protective gloves",
    ],
    repairSteps: [
      {
        stepNumber: 1,
        title: "Stop Using the Fixture",
        instruction:
          "Stop using the affected fixture so the condition does not become worse during inspection.",
      },
      {
        stepNumber: 2,
        title: "Prepare the Area",
        instruction:
          "Place a bucket and absorbent towels below the affected area before touching nearby fittings.",
      },
      {
        stepNumber: 3,
        title: "Dry and Inspect",
        instruction:
          "Dry the visible surface completely, then use a flashlight to check where moisture, movement, or blockage first appears.",
      },
      {
        stepNumber: 4,
        title: "Check for an Obvious Loose Part",
        instruction:
          "Check only accessible fittings by hand. Do not force, dismantle, cut, or remove any component.",
      },
      {
        stepNumber: 5,
        title: "Test Carefully",
        instruction:
          "If there is no safety concern, use a small amount of water and observe the area for 30–60 seconds.",
      },
    ],
    safetyWarnings: [
      "Stop immediately if leaking increases or water spreads.",
      "Do not continue if water is near electricity.",
      "Do not use excessive force on corroded, cracked, or damaged fittings.",
    ],
    professionalAdvice:
      "Contact a licensed plumber if the source cannot be confirmed, the issue continues, or any fitting appears damaged.",
    source: "Backend fallback DIY guidance",
  };
};

const getFallbackDiyInstructions = (
  analysisResult,
  urgency = "Low"
) => {
  const normalizedUrgency = normalizeUrgency(urgency);

  if (normalizedUrgency === "Critical") {
    return getCriticalFallbackInstructions(analysisResult);
  }

  return getStandardFallbackInstructions(
    analysisResult,
    normalizedUrgency
  );
};

const cleanStringArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const cleanedValues = [];

  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      cleanedValues.push(value.trim());
    }
  }

  return cleanedValues;
};

const cleanRepairSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  const cleanedSteps = [];

  for (const step of steps) {
    if (!step || typeof step !== "object") {
      continue;
    }

    const title =
      typeof step.title === "string"
        ? step.title.trim()
        : "";

    const instruction =
      typeof step.instruction === "string"
        ? step.instruction.trim()
        : "";

    if (!title || !instruction) {
      continue;
    }

    cleanedSteps.push({
      stepNumber: cleanedSteps.length + 1,
      title: title,
      instruction: instruction,
    });
  }

  return cleanedSteps;
};

const hasUsefulDiyContent = (
  toolsNeeded,
  repairSteps,
  safetyWarnings
) => {
  if (toolsNeeded.length < 2) {
    return false;
  }

  if (repairSteps.length < 4) {
    return false;
  }

  if (safetyWarnings.length < 2) {
    return false;
  }

  return true;
};

const generateDiyInstructions = async (
  analysisResult,
  urgency = "Low",
  { useLocalLlm = false } = {}
) => {
  const normalizedUrgency = normalizeUrgency(urgency);

  if (isLowConfidence(analysisResult)) {
    console.log(
      "DIY generation skipped because image analysis confidence is low"
    );

    return null;
  }

  const provider = getProvider({ useLocalLlm });

  if (!provider) {
    console.error(
      "No AI provider API key is configured for DIY instructions"
    );

    return getFallbackDiyInstructions(
      analysisResult,
      normalizedUrgency
    );
  }

  const aiClient = createAIClient(provider);
  const model = getModelForProvider(provider);

  const promptPayload = {
    task:
      "Generate practical, safe, issue-specific DIY guidance for the FixBee mobile app.",
    category:
      analysisResult?.category || "Plumbing",
    detectedObject:
      getDetectedObjectLabel(analysisResult),
    detectedIssue:
      getDetectedIssueLabel(analysisResult),
    confidence:
      analysisResult?.confidence || "Medium",
    confidenceReason:
      analysisResult?.confidenceReason || null,
    urgency: normalizedUrgency,
    rules: [
      "Return only valid JSON.",
      "Do not include markdown.",
      "Base every tool and repair step on the detected object and detected issue.",
      "toolsNeeded must contain at least 3 practical tools or materials.",
      "Never return an empty toolsNeeded array.",
      "Do not provide generic steps that could apply to every plumbing issue.",
      "Write instructions for a beginner who may have no plumbing experience.",
      "List only tools or materials that are actually required for these steps.",
      "Explain where each tool is used through the repair-step instructions.",
      "Put preparation and water-control steps before inspection or adjustment.",
      "Use four to seven repair steps in a safe and logical order.",
      "Include a final verification step explaining how to check whether leaking, blockage, or movement continues.",
      "Return at least two distinct safetyWarnings.",
      "Each safety warning must describe a clear stop condition or safety risk.",
      "Do not ask the user to cut pipes, solder, open walls, handle sewage, work near electricity, or perform advanced repairs.",
      "Do not recommend excessive tightening because fittings may crack or become damaged.",
      "Do not claim that the issue is completely repaired unless the user verifies the result.",
      "Use cautious wording when the exact internal cause cannot be confirmed from the image.",
      "For High urgency, provide temporary control and inspection steps only, not a full repair.",
      "For Critical urgency, provide emergency safety and damage-control steps only.",
      "For Critical urgency, do not instruct the user to dismantle, tighten, replace, seal, or repair the component.",
      "Keep each instruction clear enough to display on a mobile screen.",
      "Return exactly these top-level fields: title, summary, difficulty, estimatedTime, toolsNeeded, repairSteps, safetyWarnings, professionalAdvice.",
      "Do not use alternative field names such as steps, warnings, tools, materials, cautions, or instructions.",
      "toolsNeeded must be an array of at least 3 strings.",
      "repairSteps must be an array of 4 to 7 objects.",
      "Each repairSteps object must contain exactly these fields: stepNumber, title, instruction.",
      "Each repairSteps instruction must be a non-empty string.",
      "safetyWarnings must be an array of at least 2 strings.",
      "Do not return repairSteps as plain strings.",
      "Do not return safetyWarnings as objects.",
    ],
    requiredJsonFields: {
      title: "issue-specific string",
      summary:
        "brief explanation of what the steps will safely accomplish",
      difficulty:
        "Basic, Moderate, or Temporary safety only",
      estimatedTime:
        "Approximately X–Y minutes or hours",
      toolsNeeded: [
        "specific tool or material",
      ],
      repairSteps: [
        {
          stepNumber: "number",
          title: "Keep People Away",
          instruction:
            "specific beginner-readable instruction",
        },
      ],
      safetyWarnings: [
        "at least two distinct warnings or stop conditions",
      ],
      professionalAdvice:
        "explain when and why professional help is required",
    },
  };

  try {
    console.log(
      `${provider} DIY instruction generation started`
    );

    console.log(
      "Using DIY instruction model:",
      model
    );

    const response =
      await aiClient.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You create safe, practical, issue-specific home-repair guidance for FixBee. Return only valid JSON. Never invent advanced or unsafe repair steps.",
          },
          {
            role: "user",
            content: JSON.stringify(promptPayload),
          },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0.1,
        max_tokens: 1200,
      });

    const content =
      response.choices?.[0]?.message?.content;

    if (!content) {
      console.error(
        `${provider} returned empty DIY instruction content`
      );

      return getFallbackDiyInstructions(
        analysisResult,
        normalizedUrgency
      );
    }

    const diyResult = JSON.parse(content);

 let toolsNeeded = cleanStringArray(
     diyResult.toolsNeeded
  );

  if (toolsNeeded.length < 2) {
    toolsNeeded = [
    "Flashlight",
    "Bucket or container",
    "Absorbent towels",
    "Protective gloves",
  ];
}

    const repairSteps = cleanRepairSteps(
      diyResult.repairSteps
    );

    const safetyWarnings = cleanStringArray(
      diyResult.safetyWarnings
    );

    const contentIsUseful = hasUsefulDiyContent(
      toolsNeeded,
      repairSteps,
      safetyWarnings
    );

    console.log("DIY validation result:", {
      urgency: normalizedUrgency,
      toolsCount: toolsNeeded.length,
      repairStepsCount: repairSteps.length,
      safetyWarningsCount: safetyWarnings.length,
      contentIsUseful: contentIsUseful,
    });

    if (!contentIsUseful) {
      console.error(
        `${provider} returned incomplete DIY instructions`
      );

      return getFallbackDiyInstructions(
        analysisResult,
        normalizedUrgency
      );
    }

    let source = "OpenAI DIY guidance";

    if (provider === "groq") {
      source = "Groq DIY guidance";
    }

    if (provider === "ollama") {
      source = "Ollama DIY guidance";
    }

    return {
      title:
        typeof diyResult.title === "string" &&
          diyResult.title.trim() !== ""
          ? diyResult.title.trim()
          : `Guidance for ${getDetectedObjectLabel(
            analysisResult
          )}`,
      summary:
        typeof diyResult.summary === "string" &&
          diyResult.summary.trim() !== ""
          ? diyResult.summary.trim()
          : "Follow these steps carefully and stop if the condition becomes worse.",
      difficulty:
        typeof diyResult.difficulty === "string" &&
          diyResult.difficulty.trim() !== ""
          ? diyResult.difficulty.trim()
          : normalizedUrgency === "High" ||
            normalizedUrgency === "Critical"
            ? "Temporary safety only"
            : "Basic",
      estimatedTime:
        typeof diyResult.estimatedTime === "string" &&
          diyResult.estimatedTime.trim() !== ""
          ? diyResult.estimatedTime.trim()
          : "Approximately 10–20 minutes",
      toolsNeeded: toolsNeeded,
      repairSteps: repairSteps,
      safetyWarnings: safetyWarnings,
      professionalAdvice:
        typeof diyResult.professionalAdvice ===
          "string" &&
          diyResult.professionalAdvice.trim() !== ""
          ? diyResult.professionalAdvice.trim()
          : "Contact a licensed professional if the issue continues, the source cannot be confirmed, or the area becomes unsafe.",
      source: source,
    };
  } catch (error) {
    console.error(
      `${provider} DIY instruction generation failed:`,
      error.message
    );

    return getFallbackDiyInstructions(
      analysisResult,
      normalizedUrgency
    );
  }
};

export { generateDiyInstructions };
