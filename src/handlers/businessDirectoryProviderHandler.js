import mongoose from "mongoose";
import { colName } from "../internal/db/businessDirectoryProvider.js";
import { getList } from "../services/businessDirectoryProviderService.js";
import { sendProviderQuoteRequest } from "../services/providerQuoteRequestService.js";
import { PhotoAnalysisModel } from "../internal/db/photoAnalysis.js";
import { sendProviderReplyReminder } from "../services/notificationService.js";

const bdHealth = async (_req, res) => {
    const version = "business-directory-v1";
    res.json({
    ok: true,
    feature: "BusinessDirectoryProvider",
    databaseName: mongoose.connection.name || process.env.DB_NAME || null,
    sourceCollection: process.env.COL_NAME,
    structureVersion: version,
    message: "Business directory provider API is available",
    checkedAt: new Date().toISOString(),
  });
}

const bdSync = async (req, res) => {

    try {
    const city = req.query.city || "Vancouver";
    const cat = req.query.category || "plumber";
    const limit = req.query.limit || 20;

    const data = await getList(city, cat, limit);
    res.json(data);
    } catch (error) {
    res.status(500).json({
      ok: false,
      feature: "BusinessDirectoryProvider",
      sourceCollection: colName,
      message: "Could not load providers",
      error: error.message,
      });
    }  


}

const sendQuoteRequest = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        ok: false,
        message: "User session is required to send a quote request.",
      });
    }

    const result = await sendProviderQuoteRequest({
      user: req.user,
      payload: req.body || {},
    });
    const photoId = req.body?.photoId ||
    req.body?.issue?.photoId ||
    req.body?.serviceRequest?.photoId ||
    req.body?.rawPayload?.photoId;

    const selectedProviders =
      req.body?.providers ||
      req.body?.selectedProviders ||
      req.body?.rawPayload?.providers ||
      [];

   if (photoId) {
  const feedbackRequestedAt = new Date(Date.now() + 60 * 1000);

  await PhotoAnalysisModel.findOneAndUpdate(
    {
      _id: photoId,
      userId: req.user._id,
      isDeleted: false,
    },
    {
      $set: {
        repairFlow: "expert",
        repairStatus: "in_progress",
        providerRequested: true,
        providerReplyStatus: "waiting",
        selectedProviders,
        feedbackRequestedAt,
      },
    },
    { new: true }
  );

  await sendProviderReplyReminder(
    req.user._id,
    photoId,
    selectedProviders,
    feedbackRequestedAt.getTime() - Date.now()
  );
}
    return res.status(201).json({
      ok: true,
      collection: "recentScans",
      recentScanId: result.recentScan._id,
      photoId,
      providerTrackingStarted: Boolean(photoId),
      providerReplyStatus: photoId ? "waiting" : null,
      userID: result.recentScan.userID,
      to: result.to,
      cc: result.cc,
      bccCount: result.bcc.length,
      messageId: result.mailResult.messageId,
      message: "Quote request email sent and saved to recent scans.",
    });
  } catch (error) {
    console.log("[FixBee][QuoteEmail] official quote send failed", error?.message);
    return res.status(500).json({
      ok: false,
      collection: "recentScans",
      message: error.message || "Could not send quote request.",
    });
  }
};

export { bdHealth, bdSync, sendQuoteRequest };
