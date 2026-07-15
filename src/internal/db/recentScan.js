import mongoose from "mongoose";

const RecentScanSchema = new mongoose.Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    scanType: {
      type: String,
      default: "service-provider-quote-request",
      index: true,
    },
    status: {
      type: String,
      default: "official-email-sent",
      index: true,
    },
    providers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    selectedProviderIds: {
      type: [String],
      default: [],
    },
    selectedProviderEmails: {
      type: [String],
      default: [],
    },
    requester: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    issue: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    serviceRequest: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    email: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    mailResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "recentScans",
    timestamps: true,
  }
);

const RecentScanModel =
  mongoose.models.RecentScan || mongoose.model("RecentScan", RecentScanSchema);

export { RecentScanModel };
