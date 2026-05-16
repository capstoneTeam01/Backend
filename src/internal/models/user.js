import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "provider", "admin"],
    default: "user",
  },
  profileImage: {
    data: Buffer,
    contentType: String,
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

const UserModel = mongoose.model("User", UserSchema);

class User {
  constructor(email, password, name, location, role = "user", profileImage = null) {
    this.email = email;
    this.password = password;
    this.name = name;
    this.location = location;
    this.role = role;
    this.profileImage = profileImage;
  }

  async save() {
    const user = new UserModel(this);
    await user.save();
  }

  static async getAll() {
    return UserModel.find({ isDeleted: false });
  }

  static async getById(id) {
    return UserModel.findOne({
      _id: id,
      isDeleted: false,
    });
  }

  async login() {
    return UserModel.findOne({
      email: this.email,
      password: this.password,
      isDeleted: false,
    }).lean();
  }

  async updateById(id) {
    await UserModel.findByIdAndUpdate(id, this);
  }

  static async softDelete(id) {
    await UserModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { User, UserModel };