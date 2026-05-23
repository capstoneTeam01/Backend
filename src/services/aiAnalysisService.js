const analyzeImageWithAI = async (imageUrl) => {
  return {
    detectedObject: "leaking pipe",
    detectedIssue: "Possible pipe leak",
    category: "Plumbing",
    urgency: "High",
    confidence: 0.89,
    providerType: "Plumber",
    estimatedCostRange: "$150 - $400",
    recommendedActions: [
      "Turn off the nearby water supply if safe.",
      "Avoid using the affected fixture.",
      "Place a bucket or towel to reduce water damage.",
      "Contact a plumber for inspection."
    ],
    imageUrl
  };
};

export { analyzeImageWithAI };