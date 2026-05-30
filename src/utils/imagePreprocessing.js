import sharp from "sharp";

const AI_MAX_DIMENSION = 1024;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 85;

const preprocessImageForAI = async (buffer) => {
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: AI_MAX_DIMENSION,
      height: AI_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .normalize()
    .jpeg({ quality: OUTPUT_QUALITY, mozjpeg: true })
    .toBuffer();

  const { width, height } = await sharp(processedBuffer).metadata();

  return {
    buffer: processedBuffer,
    mimetype: OUTPUT_MIME,
    width,
    height,
    extension: "jpeg",
  };
};

export { preprocessImageForAI };
