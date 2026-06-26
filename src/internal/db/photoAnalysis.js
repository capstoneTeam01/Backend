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
      type: [String],
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
    enum: ["not_started", "pending", "completed", "failed"],
    default: "not_started",
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PhotoAnalysisModel = mongoose.model("PhotoAnalysis", PhotoAnalysisSchema);

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
    const saved = await photoAnalysis.save();
    return saved;
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
    await PhotoAnalysisModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { PhotoAnalysis, PhotoAnalysisModel };