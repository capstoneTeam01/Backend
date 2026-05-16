import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: false,
    default: "",
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

const CategoryModel = mongoose.model("Category", CategorySchema);

class Category {
  constructor(name, description = "") {
    this.name = name;
    this.description = description;
  }

  async save() {
    const category = new CategoryModel(this);
    await category.save();
  }

  static async getAll() {
    return CategoryModel.find({ isDeleted: false });
  }

  static async getById(id) {
    return CategoryModel.findOne({
      _id: id,
      isDeleted: false,
    });
  }

  static async getByName(name) {
    return CategoryModel.findOne({
      name: name,
      isDeleted: false,
    });
  }

  async updateById(id) {
    await CategoryModel.findByIdAndUpdate(id, this);
  }

  static async softDelete(id) {
    await CategoryModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { Category, CategoryModel };