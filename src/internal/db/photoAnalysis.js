import mongoose from "mongoose";

const DiyRepairStepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    instruction: {
      type: String,
      required: false,
    },
  },
  {
    _id: false,
  }
);

const DiyInstructionsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: false,
    },
    summary: {
      type: String,
      required: false,
    },
    difficulty: {
      type: String,
      required: false,
    },
    estimatedTime: {
      type: String,
      required: false,
    },
    toolsNeeded: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    repairSteps: {
      type: [DiyRepairStepSchema],
      default: [],
    },
    safetyWarnings: {
      type: [String],
      default: [],
    },
    professionalAdvice: {
      type: String,
      required: false,
    },
    source: {
      type: String,
      required: false,
    },
  },
  {
    _id: false,
  }
);

const PhotoAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: false,
  },
  repairStatus: {
    type: String,
    enum: [ "open", "in_progress","completed"],
    default: "open",
  },
  repairFlow : {
    type: String,
    enum: ["none", "diy", "expert"],
    default: "none",
  },
  feedbackRequestedAt: {
    type: Date,
    default: null,
  },
  feedbackSubmitted: {
    type: Boolean,
    default: false,
  },

  repairCompletedAt: {
    type: Date,
    default: null,
  },
  providerRequested: {
    type: Boolean,
    default: false,
},
  providerAssigned: {
    type: Boolean,
    default: false,
  },
  repairFeedback: {
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    note: String,
    submittedAt: Date,
},
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Issue",
    required: false,
  },
  image: {
    data: Buffer,
    contentType: String,
  },
  imageUrl: {
    type: String,
    required: false,
  },
  detectedObject: {
    type: String,
    required: false,
  },
  aiResponse: {
    type: String,
    required: false,
  },
  diyInstructions: {
    type: DiyInstructionsSchema,
    required: false,
    default: null,
  },
  diyGeneratedAt: {
    type: Date,
    required: false,
    default: null,
  },
  diyGenerationStatus: {
    type: String,
    enum: [
      "not_started",
      "pending",
      "completed",
      "failed",
      "skipped",
    ],
    default: "not_started",
  },
  diyGenerationReason: {
    type: String,
    required: false,
    default: null,
  },
  expertReportStatus: {
    type: String,
    enum: [
      "not_started",
      "pending",
      "completed",
      "failed",
      "skipped",
    ],
    default: "not_started",
  },
  expertReportUrl: {
    type: String,
    required: false,
    default: null,
  },
  expertReportFilename: {
    type: String,
    required: false,
    default: null,
  },
  expertReportGeneratedAt: {
    type: Date,
    required: false,
    default: null,
  },
  expertReportReason: {
    type: String,
    required: false,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  selectedProviders: {
  type: [mongoose.Schema.Types.Mixed],
  default: [],
},

chosenProvider: {
  type: mongoose.Schema.Types.Mixed,
  default: null,
},

providerReplyStatus: {
  type: String,
  enum: ["not_requested", "waiting", "replied", "no_reply"],
  default: "not_requested",
},
});

const PhotoAnalysisModel = mongoose.model(
  "PhotoAnalysis",
  PhotoAnalysisSchema
);

class PhotoAnalysis {
  constructor(
    userId,
    image = null,
    detectedObject = null,
    categoryId = null,
    issueId = null,
    aiResponse = "",
    imageUrl = null
  ) {
    this.userId = userId;
    this.image = image;
    this.detectedObject = detectedObject;
    this.categoryId = categoryId;
    this.issueId = issueId;
    this.aiResponse = aiResponse;
    this.imageUrl = imageUrl;
  }

  async save() {
    const photoAnalysis = new PhotoAnalysisModel(this);
    const savedPhotoAnalysis = await photoAnalysis.save();

    return savedPhotoAnalysis;
  }

  static async getAllByUserId(userId) {
    return PhotoAnalysisModel.find({
      userId: userId,
      isDeleted: false,
    })
      .populate("categoryId")
      .populate("issueId")
      .sort({ createdAt: -1 });
  }

  static async getRecentAnalyzedByUserId(userId, limit = 20) {
    return PhotoAnalysisModel.find({
      userId: userId,
      isDeleted: false,
      aiResponse: {
        $exists: true,
        $nin: ["", null],
      },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  static async getByIdForUser(id, userId) {
    return PhotoAnalysisModel.findOne({
      _id: id,
      userId: userId,
      isDeleted: false,
    }).lean();
  }

  static async getById(id) {
    return PhotoAnalysisModel.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("userId")
      .populate("categoryId")
      .populate("issueId");
  }

  static async softDelete(id) {
    await PhotoAnalysisModel.findByIdAndUpdate(id, {
      isDeleted: true,
    });
  }
}

export {
  PhotoAnalysis,
  PhotoAnalysisModel,
};
