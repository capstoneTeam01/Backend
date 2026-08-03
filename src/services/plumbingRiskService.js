const normalizeRiskScore = (score, fallbackScore = null) => {
  const numberScore = Number(score);

  if (!Number.isFinite(numberScore)) return fallbackScore;
  return Math.round(Math.min(100, Math.max(0, numberScore)));
};

const calculatePlumbingRiskScore = ({
  requestedScore,
  visualEvidence = {},
  evidenceText = "",
}) => {
  const score = normalizeRiskScore(requestedScore, 1);
  const corrosionExtent = String(visualEvidence.corrosionExtent || "None").toLowerCase();
  const damageExtent = String(visualEvidence.damageExtent || "None").toLowerCase();
  const pipeIntegrity = String(visualEvidence.pipeIntegrity || "Intact").toLowerCase();
  const leakSeverity = String(
    visualEvidence.leakSeverity || visualEvidence.waterFlow || "None"
  ).toLowerCase();
  const floodingLevel = String(visualEvidence.floodingLevel || "None").toLowerCase();
  const text = String(evidenceText || "").toLowerCase();

  const highRisk =
    ["spraying", "gushing"].includes(leakSeverity) ||
    floodingLevel === "major" ||
    visualEvidence.burstOrRuptureVisible === true ||
    visualEvidence.sewageVisible === true ||
    visualEvidence.waterNearElectrical === true ||
    visualEvidence.immediateHazardVisible === true ||
    corrosionExtent === "heavy" ||
    damageExtent === "severe" ||
    ["deteriorated", "ruptured"].includes(pipeIntegrity) ||
    /\b(pressurized spray|gushing|burst|ruptured|major flooding|sewage|water near electrical|scalding|steam release|structural danger|heavy rust|extensive rust|severe rust|heavy corrosion|extensive corrosion|severe corrosion|advanced corrosion|severe scaling|visible pipe deterioration)\b/.test(text);

  if (highRisk) return Math.max(71, score);

  const mediumRisk =
    leakSeverity === "steady" ||
    floodingLevel === "minor" ||
    corrosionExtent === "significant" ||
    damageExtent === "significant" ||
    pipeIntegrity === "affected" ||
    visualEvidence.waterDamageVisible === true ||
    /\b(continuous leak|steady leak|steady flow|pooling|standing water|overflow|blockage|blocked|clogged|visible crack|significant corrosion|moisture damage)\b/.test(text);

  if (mediumRisk) return Math.min(70, Math.max(31, score));
  return Math.min(30, Math.max(1, score));
};

const getUrgencyFromRiskScore = (riskScore) => {
  const score = normalizeRiskScore(riskScore, null);
  if (score === null || score === 0) return null;
  if (score >= 71) return "High";
  if (score >= 31) return "Medium";
  return "Low";
};

export {
  calculatePlumbingRiskScore,
  getUrgencyFromRiskScore,
};
