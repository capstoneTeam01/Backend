import sharp from "sharp";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 4096;

const validateImage = async (file) => {
  if (!file) {
    return { valid: false, message: "No image file provided" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      message: "Only JPEG, PNG, and WebP images are allowed",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      message: "Image must be under 5MB",
    };
  }

  let metadata;

  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    return { valid: false, message: "Invalid or corrupted image file" };
  }

  const { width, height } = metadata;

  if (!width || !height) {
    return { valid: false, message: "Could not read image dimensions" };
  }

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      valid: false,
      message: `Image must be at least ${MIN_WIDTH}x${MIN_HEIGHT} pixels`,
    };
  }

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    return {
      valid: false,
      message: `Image must be at most ${MAX_WIDTH}x${MAX_HEIGHT} pixels`,
    };
  }

  return { valid: true, width, height };
};

const AVATAR_MIN_DIMENSION = 64;

const validateAvatarImage = async (file) => {
  if (!file) {
    return { valid: false, message: "No image file provided" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      message: "Only JPEG, PNG, and WebP images are allowed",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      message: "Image must be under 5MB",
    };
  }

  let metadata;

  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    return { valid: false, message: "Invalid or corrupted image file" };
  }

  const { width, height } = metadata;

  if (!width || !height) {
    return { valid: false, message: "Could not read image dimensions" };
  }

  if (width < AVATAR_MIN_DIMENSION || height < AVATAR_MIN_DIMENSION) {
    return {
      valid: false,
      message: `Image must be at least ${AVATAR_MIN_DIMENSION}x${AVATAR_MIN_DIMENSION} pixels`,
    };
  }

  return { valid: true, width, height };
};

export { validateImage, validateAvatarImage };
