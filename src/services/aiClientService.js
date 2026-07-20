import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const isOllamaEnabled = () => {
  return (
    process.env.OLLAMA_ENABLED === "true" &&
    Boolean(process.env.OLLAMA_URL)
  );
};

const getProvider = ({ useLocalLlm = false } = {}) => {
  if (useLocalLlm) {
    return isOllamaEnabled() ? "ollama" : null;
  }

  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (hasGroqKey && hasOpenAIKey) {
    console.error(
      "Both GROQ_API_KEY and OPENAI_API_KEY are set. Please keep only one active in .env."
    );
    return null;
  }

  if (hasGroqKey) return "groq";
  if (hasOpenAIKey) return "openai";

  if (isOllamaEnabled()) {
    return "ollama";
  }

  return null;
};


const createDirectClient = (provider) => {
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
    baseURL: `${process.env.OLLAMA_URL}/v1`,
  });
}
  return null;
};

const requestUsesVision = (request = {}) => {
  return request.messages?.some((message) => {
    return Array.isArray(message?.content) &&
      message.content.some(
        (item) => item?.type === "image_url"
      );
  });
};

const createAIClient = (
  provider,
  { fallbackToOllama = true } = {}
) => {
  const primaryClient =
    createDirectClient(provider);

  if (
    !primaryClient ||
    provider === "ollama" ||
    !fallbackToOllama ||
    !isOllamaEnabled()
  ) {
    return primaryClient;
  }

  const ollamaClient =
    createDirectClient("ollama");

  return {
    chat: {
      completions: {
        create: async (request) => {
          try {
            return await primaryClient.chat.completions.create(
              request
            );
          } catch (error) {
            console.warn(
              `[FixBee][AI] ${provider} failed; retrying with Ollama:`,
              error.message
            );

            const model = requestUsesVision(request)
              ? process.env.OLLAMA_VISION_MODEL || "qwen3-vl:8b"
              : process.env.OLLAMA_TEXT_MODEL || "llama3.2";

            return ollamaClient.chat.completions.create({
              ...request,
              model,
            });
          }
        },
      },
    },
  };
};

export {
  getProvider,
  createAIClient,
  isOllamaEnabled,
};
