import { put } from "@vercel/blob";

const uploadToBlob = async (buffer, pathname, contentType) => {
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
  });

  return blob;
};

export { uploadToBlob };
