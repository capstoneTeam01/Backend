import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeIssueRegion } from "../utils/normalizeIssueRegion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_DIR = path.join(__dirname, "../../ml");
const SEGMENT_SCRIPT = path.join(ML_DIR, "segment.py");
const DEFAULT_MODEL = path.join(ML_DIR, "weights", "pipe-seg.pt");
const VENV_PYTHON = path.join(ML_DIR, ".venv/bin/python3");

const isYoloEnabled = () => process.env.YOLO_SEGMENTATION_ENABLED !== "false";

const resolvePythonPath = () => {
  const configured = process.env.YOLO_PYTHON;

  if (!configured) {
    return VENV_PYTHON;
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  return path.resolve(path.join(__dirname, "../.."), configured);
};

const resolveModelPath = () => {
  const configured = process.env.YOLO_MODEL_PATH || DEFAULT_MODEL;

  if (path.isAbsolute(configured)) {
    return configured;
  }

  return path.resolve(path.join(__dirname, "../.."), configured);
};

const runPythonSegmentation = (imagePath, mode = "auto") => {
  const python = resolvePythonPath();
  const modelPath = resolveModelPath();

  return new Promise((resolve, reject) => {
    const args = [SEGMENT_SCRIPT, imagePath, "--model", modelPath, "--mode", mode];
    const processRef = spawn(python, args);
    let stdout = "";
    let stderr = "";

    processRef.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on("close", (code) => {
      let parsed = null;

      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        parsed = null;
      }

      if (code !== 0) {
        const error = new Error(
          parsed?.error || stderr.trim() || stdout.trim() || "YOLO segmentation failed"
        );
        if (parsed?.brightness != null) {
          error.brightness = parsed.brightness;
        }
        reject(error);
        return;
      }

      if (!parsed) {
        reject(new Error("Invalid JSON from YOLO segment.py"));
        return;
      }

      resolve(parsed);
    });
  });
};

const writeBase64Image = async (imageBase64) => {
  const trimmed = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(trimmed, "base64");
  const tempPath = path.join(os.tmpdir(), `fixbee-segment-${Date.now()}.jpg`);
  await fs.writeFile(tempPath, buffer);
  return tempPath;
};

const normalizeResult = (raw) => {
  const issueRegion = normalizeIssueRegion(raw.issueRegion);

  if (!issueRegion) {
    return null;
  }

  return {
    detectedObject: raw.detectedObject || "pipe",
    issueRegion,
    issueOutline: Array.isArray(raw.issueOutline) ? raw.issueOutline : null,
    source: raw.source || "yolo",
    brightness: typeof raw.brightness === "number" ? raw.brightness : null,
  };
};

const detectPipeOutlineWithYolo = async ({ imageBase64 }) => {
  if (!isYoloEnabled() || !imageBase64) {
    return { issueRegion: null, brightness: null };
  }

  let tempPath = null;

  try {
    tempPath = await writeBase64Image(imageBase64);
    const mode = process.env.YOLO_SEGMENTATION_MODE || "auto";
    const raw = await runPythonSegmentation(tempPath, mode);
    return normalizeResult(raw);
  } catch (error) {
    if (error.message?.includes("no outline detected")) {
      return {
        issueRegion: null,
        brightness: typeof error.brightness === "number" ? error.brightness : null,
      };
    }

    console.warn("YOLO segmentation failed:", error.message);
    throw error;
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
};

export { detectPipeOutlineWithYolo };
