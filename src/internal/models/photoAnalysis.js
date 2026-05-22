import mongoose from "mongoose";

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
    this._id = saved._id;
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