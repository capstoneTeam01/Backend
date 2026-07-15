import {
  getProvider,
  createAIClient,
} from "./aiClientService.js";

const clean = (value) => {
  return String(value || "").trim();
};

const cleanList = (values, maximumItems = 5) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value) => {
      return typeof value === "string";
    })
    .map((value) => {
      return value.trim();
    })
    .filter(Boolean)
    .slice(0, maximumItems);
};

const getReportModel = (provider) => {
  if (provider === "groq") {
    return (
      process.env.GROQ_REPORT_MODEL ||
      process.env.GROQ_VISION_MODEL ||
      "meta-llama/llama-4-scout-17b-16e-instruct"
    );
  }

  if (provider === "openai") {
    return (
      process.env.OPENAI_REPORT_MODEL ||
      process.env.OPENAI_VISION_MODEL ||
      "gpt-4o-mini"
    );
  }

  if (provider === "ollama") {
    return (
      process.env.OLLAMA_TEXT_MODEL ||
      "llama3.2"
    );
  }

  return null;
};

const createFallbackReport = (analysis = {}) => {
  const detectedIssue =
    clean(analysis.detectedIssue) ||
    "Visible plumbing concern";

  const detectedObject =
    clean(analysis.detectedObject) ||
    "Affected plumbing component";

  const issuesToFix =
    cleanList(analysis.issuesToFix);

  const recommendedActions =
    cleanList(
      analysis.recommendedActions,
      4
    );

  return {
    executiveSummary:
      `${detectedIssue} was identified around the ${detectedObject}. ` +
      "The available image supports a preliminary assessment only, and the final cause should be confirmed during an on-site inspection.",

    visibleObservations:
      issuesToFix.length > 0
        ? issuesToFix
        : [
            `${detectedObject} appears to require further inspection.`,
          ],

    technicalAssessment:
      "The visible condition may affect the normal operation of the plumbing fixture or connection. The full extent of the issue cannot be confirmed from the image alone.",

    possibleCauses: [
      "The exact underlying cause cannot be confirmed from the submitted image.",
      "A technician should inspect the affected component and surrounding connections before selecting a repair method.",
    ],

    recommendedDiagnosticChecks: [
      "Inspect the affected component and nearby connections for visible damage, looseness, corrosion, or moisture.",
      "Check whether the issue continues while the fixture is operating and while it is not in use.",
      "Confirm whether adjacent materials or components have been affected.",
    ],

    likelyRepairScope:
      issuesToFix.length > 0
        ? issuesToFix
        : [
            "Inspect and repair or replace the affected plumbing component as required.",
          ],

    riskAssessment:
      clean(analysis.urgency)
        ? `FixBee classified the visible issue as ${analysis.urgency} risk. The technician should confirm whether the condition has worsened before beginning work.`
        : "The risk level should be confirmed during the on-site inspection.",

    immediatePrecautions:
      recommendedActions.length > 0
        ? recommendedActions
        : [
            "Limit use of the affected fixture until it has been inspected.",
            "Monitor the area for continued leaking, moisture, or further damage.",
          ],

    limitations:
      "This report is based on image analysis. Hidden damage, internal component failure, pressure conditions, and the final root cause cannot be confirmed without an on-site inspection.",
  };
};

const normalizeTechnicalReport = (
  aiReport,
  fallbackReport
) => {
  return {
    executiveSummary:
      clean(aiReport?.executiveSummary) ||
      fallbackReport.executiveSummary,

    visibleObservations:
      cleanList(
        aiReport?.visibleObservations
      ).length > 0
        ? cleanList(
            aiReport.visibleObservations
          )
        : fallbackReport.visibleObservations,

    technicalAssessment:
      clean(aiReport?.technicalAssessment) ||
      fallbackReport.technicalAssessment,

    possibleCauses:
      cleanList(aiReport?.possibleCauses)
        .length > 0
        ? cleanList(
            aiReport.possibleCauses
          )
        : fallbackReport.possibleCauses,

    recommendedDiagnosticChecks:
      cleanList(
        aiReport?.recommendedDiagnosticChecks
      ).length > 0
        ? cleanList(
            aiReport.recommendedDiagnosticChecks
          )
        : fallbackReport.recommendedDiagnosticChecks,

    likelyRepairScope:
      cleanList(
        aiReport?.likelyRepairScope
      ).length > 0
        ? cleanList(
            aiReport.likelyRepairScope
          )
        : fallbackReport.likelyRepairScope,

    riskAssessment:
      clean(aiReport?.riskAssessment) ||
      fallbackReport.riskAssessment,

    immediatePrecautions:
      cleanList(
        aiReport?.immediatePrecautions
      ).length > 0
        ? cleanList(
            aiReport.immediatePrecautions
          )
        : fallbackReport.immediatePrecautions,

    limitations:
      clean(aiReport?.limitations) ||
      fallbackReport.limitations,
  };
};

const SYSTEM_PROMPT = `
You create technical plumbing assessment reports for FixBee service providers.

Use only the supplied analysis data.

Return one valid JSON object with exactly these fields:

{
  "executiveSummary": "string",
  "visibleObservations": ["string"],
  "technicalAssessment": "string",
  "possibleCauses": ["string"],
  "recommendedDiagnosticChecks": ["string"],
  "likelyRepairScope": ["string"],
  "riskAssessment": "string",
  "immediatePrecautions": ["string"],
  "limitations": "string"
}

Rules:

- Write from the perspective of a cautious plumbing professional reviewing a submitted image analysis.
- Provide useful technical detail for a service provider.
- Clearly separate visible evidence from possible causes.
- Do not present a possible cause as a confirmed diagnosis.
- Use wording such as "may indicate", "possible", "appears", and "should be verified".
- Do not invent hidden damage, failed internal parts, measurements, building conditions, or code violations.
- Do not change the supplied urgency, cost estimate, repair time, or confidence.
- Recommended diagnostic checks must describe what a technician should verify on-site.
- Likely repair scope must remain preliminary.
- Mention that the final diagnosis requires physical inspection.
- Do not include requester names, email addresses, or service addresses.
- Return JSON only.
`;

const generateExpertTechnicalReport = async (
  analysis = {},
  { useLocalLlm = false } = {}
) => {
  const fallbackReport =
    createFallbackReport(analysis);

  const provider = getProvider({ useLocalLlm });

  if (!provider) {
    console.warn(
      "[FixBee][TechnicalReport] no AI provider configured; using fallback report"
    );

    return fallbackReport;
  }

  const client =
    createAIClient(provider);

  const model =
    getReportModel(provider);

  if (!client || !model) {
    return fallbackReport;
  }

  const technicalInput = {
    detectedObject:
      analysis.detectedObject,

    detectedIssue:
      analysis.detectedIssue,

    category:
      analysis.category,

    confidence:
      analysis.confidence,

    confidenceReason:
      analysis.confidenceReason,

    urgency:
      analysis.urgency,

    visualEvidence:
      analysis.visualEvidence,

    issuesToFix:
      analysis.issuesToFix,

    recommendedActions:
      analysis.recommendedActions,

    estimatedCostRange:
      analysis.estimatedCostRange,

    estimatedRepairTime:
      analysis.estimatedRepairTime,

    providerType:
      analysis.providerType,
  };

  try {
    const response =
      await client.chat.completions.create({
        model,

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content:
              `Create a technical provider report from this FixBee analysis:\n${JSON.stringify(
                technicalInput
              )}`,
          },
        ],

        response_format: {
          type: "json_object",
        },

        temperature: 0.2,
        max_tokens: 1400,
      });

    const content =
      response.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackReport;
    }

    const aiReport =
      JSON.parse(content);

    return normalizeTechnicalReport(
      aiReport,
      fallbackReport
    );
  } catch (error) {
    console.error(
      "[FixBee][TechnicalReport] generation failed:",
      error.message
    );

    return fallbackReport;
  }
};

export {
  generateExpertTechnicalReport,
};
