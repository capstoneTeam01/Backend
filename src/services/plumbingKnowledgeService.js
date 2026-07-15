import fs from "node:fs";

const KNOWLEDGE_FILE_URL = new URL(
  "../../training/fixbee-plumbing-knowledge.json",
  import.meta.url
);

const MAX_VISION_KNOWLEDGE_CHARS = 9000;

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

const joinItems = (items, separator = "; ") => {
  return Array.isArray(items)
    ? items.map(clean).filter(Boolean).join(separator)
    : "";
};

const loadPlumbingKnowledge = () => {
  try {
    const raw = fs.readFileSync(KNOWLEDGE_FILE_URL, "utf8");
    const knowledge = JSON.parse(raw);

    if (!Array.isArray(knowledge?.issueFamilies)) {
      throw new Error("issueFamilies is missing");
    }

    return knowledge;
  } catch (error) {
    console.error(
      "[FixBee][AI] plumbing knowledge could not be loaded:",
      error.message
    );
    return null;
  }
};

const plumbingKnowledge = loadPlumbingKnowledge();

const buildIssueReference = (knowledge) => {
  return knowledge.issueFamilies.flatMap((family) => {
    return (family.issues || []).map((issue) => {
      const evidence = joinItems(
        (issue.visibleEvidence || []).slice(0, 3),
        ", "
      );
      return `- ${clean(issue.name)}: visible evidence may include ${evidence}.`;
    });
  });
};

const buildTrainingExamples = (knowledge) => {
  return (knowledge.trainingExamples || []).map((example) => {
    const minimumRisk = Number.isFinite(example.minimumRiskScore)
      ? ` Minimum risk score: ${example.minimumRiskScore}.`
      : "";

    return `- Input: ${clean(example.input)} Expected: ${clean(example.preferredClassification)}; ${clean(example.preferredIssue) || "no issue"}.${minimumRisk} Avoid: ${clean(example.avoid)}.`;
  });
};

const buildVisionAnalysisKnowledge = () => {
  if (!plumbingKnowledge) {
    return "";
  }

  const identity = plumbingKnowledge.fixbeeIdentity || {};
  const policy = plumbingKnowledge.analysisPolicy || {};
  const sections = [
    "FIXBEE PLUMBING KNOWLEDGE GROUNDING:",
    `Dataset: ${clean(plumbingKnowledge.dataset?.name)} version ${clean(plumbingKnowledge.dataset?.version)}.`,
    `Role: ${clean(identity.role)}`,
    `Evidence rules: ${joinItems(policy.evidenceRules)}`,
    `Critical overrides: ${joinItems(policy.criticalOverrides)}`,
    `Forbidden behavior: ${joinItems(
      (identity.forbiddenBehaviour || []).slice(0, 2)
    )}`,
    "FIXBEE CLASSIFICATION EXAMPLES:",
    ...buildTrainingExamples(plumbingKnowledge),
    "VISIBLE ISSUE REFERENCE:",
    ...buildIssueReference(plumbingKnowledge),
    "Apply this knowledge only to visible image evidence. Never invent a hidden cause. A visible abnormal condition must not be classified as NO_ISSUE_DETECTED merely because the exact cause is uncertain."
  ];

  const includedSections = [];
  let currentLength = 0;

  for (const section of sections.filter(Boolean)) {
    const nextLength = currentLength + section.length + 1;
    if (nextLength > MAX_VISION_KNOWLEDGE_CHARS) break;

    includedSections.push(section);
    currentLength = nextLength;
  }

  return includedSections.join("\n");
};

const visionAnalysisKnowledge = buildVisionAnalysisKnowledge();

if (visionAnalysisKnowledge) {
  console.log("[FixBee][AI] plumbing knowledge loaded", {
    version: plumbingKnowledge.dataset?.version || "unknown",
    issueFamilies: plumbingKnowledge.issueFamilies.length,
    issues: plumbingKnowledge.issueFamilies.reduce(
      (count, family) => count + (family.issues?.length || 0),
      0
    ),
    promptCharacters: visionAnalysisKnowledge.length,
  });
}

export {
  buildVisionAnalysisKnowledge,
  plumbingKnowledge,
  visionAnalysisKnowledge,
};
