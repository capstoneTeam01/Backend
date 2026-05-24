import mongoose from "mongoose";

const ProviderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  businessName: {
    type: String,
    required: true,
  },
  providerType: {
    type: String,
    required: true,
  },
  websiteUrl: {
    type: String,
    required: false,
  },
  sourceWebsite: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: false,
  },
  location: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  availability: {
    type: String,
    required: false,
    default: "available",
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

const ProviderModel = mongoose.model("Provider", ProviderSchema);

class Provider {
  constructor(
    categoryId,
    businessName,
    providerType,
    phone,
    email,
    location,
    userId = null
  ) {
    this.userId = userId;
    this.categoryId = categoryId;
    this.businessName = businessName;
    this.providerType = providerType;
    this.phone = phone;
    this.email = email;
    this.location = location;
  }

  async save() {
    const provider = new ProviderModel(this);
    await provider.save();
  }

  static async getAll() {
    return ProviderModel.find({ isDeleted: false }).populate("categoryId");
  }

  static async getById(id) {
    return ProviderModel.findOne({
      _id: id,
      isDeleted: false,
    }).populate("categoryId");
  }

  static async getByCategory(categoryId) {
    return ProviderModel.find({
      categoryId: categoryId,
      isDeleted: false,
    }).populate("categoryId");
  }

  static async getByLocation(location) {
    return ProviderModel.find({
      location: location,
      isDeleted: false,
    }).populate("categoryId");
  }

  static async getByCategoryAndLocation(categoryId, location) {
    return ProviderModel.find({
      categoryId: categoryId,
      location: location,
      isDeleted: false,
    }).populate("categoryId");
  }

  async updateById(id) {
    await ProviderModel.findByIdAndUpdate(id, this);
  }

  static async softDelete(id) {
    await ProviderModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { Provider, ProviderModel };