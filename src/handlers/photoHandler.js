import { PhotoAnalysis } from "../internal/db/photoAnalysis.js";
import { uploadToBlob } from "../services/blobStorage.js";
import { preprocessImageForAI } from "../utils/imagePreprocessing.js";
import { validateImage } from "../utils/imageValidation.js";

const UploadPhoto = () => {
  return async (req, res) => {
    try {
      const validation = await validateImage(req.file);

      if (!validation.valid) {
        return res.status(400).json({
          error: "VALIDATION_FAILED",
          message: validation.message,
        });
      }

      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({
          message: "Upload failed: storage is not configured",
        });
      }

      const preprocessed = await preprocessImageForAI(req.file.buffer);

      const userId = req.user._id || req.user.id;
      const pathname = `uploads/${userId}/${Date.now()}.${preprocessed.extension}`;

      const blob = await uploadToBlob(
        preprocessed.buffer,
        pathname,
        preprocessed.mimetype
      );

      const photo = new PhotoAnalysis(userId, null, null, null, null, "", blob.url);
      const saved = await photo.save();

      return res.status(201).json({
        message: "Image uploaded successfully",
        url: blob.url,
        id: saved._id,
        width: preprocessed.width,
        height: preprocessed.height,
        originalWidth: validation.width,
        originalHeight: validation.height,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        message: "Upload failed. Please try again.",
      });
    }
  };
};


const GetPhotoHistory = () => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;

      const photos = await PhotoAnalysis.getRecentAnalyzedByUserId(userId);

      const history = [];

      for (const photo of photos) {
        if (photo.aiResponse) {
          try {
            const analysis = JSON.parse(photo.aiResponse);

            const historyItem = {
              photoId: photo._id,
              imageUrl: photo.imageUrl,
              detectedObject: photo.detectedObject,
              analysis: analysis,
              createdAt: photo.createdAt,
            };

            history.push(historyItem);
          } catch (error) {
            console.log(
              "Could not read analysis for photo:",
              photo._id
            );
          }
        }
      }

      return res.status(200).json({
        success: true,
        history: history,
      });
    } catch (error) {
      console.error("Photo history error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load photo history",
      });
    }
  };
};

export { UploadPhoto, GetPhotoHistory };
