const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const normalizeIssueRegion = (region) => {
  if (!region || typeof region !== "object") {
    return null;
  }

  const x = clamp01(region.x);
  const y = clamp01(region.y);
  const width = clamp01(region.width);
  const height = clamp01(region.height);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
};

export { normalizeIssueRegion };
