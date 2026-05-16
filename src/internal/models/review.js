import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Provider",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: false,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ReviewModel = mongoose.model("Review", ReviewSchema);

class Review {
  constructor(userId, providerId, rating, comment = "") {
    this.userId = userId;
    this.providerId = providerId;
    this.rating = rating;
    this.comment = comment;
  }

  async save() {
    const review = new ReviewModel(this);
    await review.save();
  }

  static async getAllByProvider(providerId) {
    return ReviewModel.find({
      providerId: providerId,
    })
      .populate("userId")
      .populate("providerId")
      .sort({ createdAt: -1 });
  }

  static async getAllByUser(userId) {
    return ReviewModel.find({
      userId: userId,
    }).populate("providerId");
  }
}

export { Review, ReviewModel };