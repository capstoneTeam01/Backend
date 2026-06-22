import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const getProvider = () => {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (hasGroqKey && hasOpenAIKey) {
    console.error(
      "Both GROQ_API_KEY and OPENAI_API_KEY are set. Please keep only one active in .env."
    );
    return null;
  }

  if (hasGroqKey) {
    return "groq";
  }

  if (hasOpenAIKey) {
    return "openai";
  }

  return null;
};


const createAIClient = (provider) => {
  if (provider === "groq") {
    return new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: GROQ_BASE_URL,
    });
  }

  if (provider === "openai") {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (provider === "ollama") {
    return new OpenAI({
      apiKey: "ollama",
      baseURL: process.env.OLLAMA_URL,
    });
  }

  return null;
};

export { getProvider, createAIClient };