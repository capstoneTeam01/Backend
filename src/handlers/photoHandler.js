import { PhotoAnalysis } from "../internal/models/photoAnalysis.js";
import { uploadToBlob } from "../services/blobStorage.js";

const UploadPhoto = () => {
  return async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No image file provided",
        });
      }

      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({
          message: "Upload failed: storage is not configured",
        });
      }

      const userId = req.user._id || req.user.id;
      const extension = req.file.mimetype.split("/")[1];
      const pathname = `uploads/${userId}/${Date.now()}.${extension}`;

      const blob = await uploadToBlob(
        req.file.buffer,
        pathname,
        req.file.mimetype
      );

      const photo = new PhotoAnalysis(
        userId,
        null,
        null,
        null,
        null,
        "",
        blob.url
      );
      const saved = await photo.save();

      return res.status(201).json({
        message: "Image uploaded successfully",
        url: blob.url,
        id: saved._id,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        message: "Upload failed. Please try again.",
      });
    }
  };
};

export { UploadPhoto };
