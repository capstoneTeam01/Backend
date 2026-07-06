import { callOllama } from "./ollamaService.js";

const useLocalLlm = () => {
  return process.env.OLLAMA_ENABLED === "true";
};

const runAi = async ({ prompt, cloudFallback }) => {
  if (useLocalLlm()) {
    try {
      return await callOllama(prompt);
    } catch (error) {
      console.log("[FixBee][AI] Local LLM failed. Falling back to cloud:", error.message);
    }
  }

  return cloudFallback();
};

export { runAi };