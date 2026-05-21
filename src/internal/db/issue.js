import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  objectName: {
    type: String,
    required: true,
  },
  issueName: {
    type: String,
    required: true,
  },
  solution: {
    type: String,
    required: true,
  },
  urgency: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low",
  },
  estimatedCost: {
    type: String,
    required: false,
  },
  estimatedTime: {
    type: String,
    required: false,
  },
  providerType: {
    type: String,
    required: true,
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

const IssueModel = mongoose.model("Issue", IssueSchema);

class Issue {
  constructor(
    categoryId,
    objectName,
    issueName,
    solution,
    urgency,
    estimatedCost,
    estimatedTime,
    providerType
  ) {
    this.categoryId = categoryId;
    this.objectName = objectName;
    this.issueName = issueName;
    this.solution = solution;
    this.urgency = urgency;
    this.estimatedCost = estimatedCost;
    this.estimatedTime = estimatedTime;
    this.providerType = providerType;
  }

  async save() {
    const issue = new IssueModel(this);
    await issue.save();
  }

  static async getAll() {
    return IssueModel.find({ isDeleted: false }).populate("categoryId");
  }

  static async getById(id) {
    return IssueModel.findOne({
      _id: id,
      isDeleted: false,
    }).populate("categoryId");
  }

  static async getByObjectName(objectName) {
    return IssueModel.findOne({
      objectName: objectName,
      isDeleted: false,
    }).populate("categoryId");
  }

  static async getByCategory(categoryId) {
    return IssueModel.find({
      categoryId: categoryId,
      isDeleted: false,
    }).populate("categoryId");
  }

  async updateById(id) {
    await IssueModel.findByIdAndUpdate(id, this);
  }

  static async softDelete(id) {
    await IssueModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { Issue, IssueModel };