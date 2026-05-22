import mongoose from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
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

// strip sensitive fields before returning to caller
const sanitize = (userDoc) => {
  if (!userDoc) return null;
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  const { password, __v, ...safe } = obj;
  return safe;
};

class User {
  constructor(email, password, name, location, role = "user", profileImage = null) {
    this.email = email?.toLowerCase().trim();
    this.password = password;
    this.name = name;
    this.location = location;
    this.role = role;
    this.profileImage = profileImage;
  }

  async save() {
    const hashed = await bcrypt.hash(this.password, SALT_ROUNDS);
    const user = new UserModel({ ...this, password: hashed });
    const saved = await user.save();
    return sanitize(saved);
  }

  static async getAll() {
    const users = await UserModel.find({ isDeleted: false }).lean();
    return users.map(sanitize);
  }

  static async getById(id) {
    const user = await UserModel.findOne({
      _id: id,
      isDeleted: false,
    }).lean();
    return sanitize(user);
  }

  async login() {
    const user = await UserModel.findOne({
      email: this.email,
      isDeleted: false,
    }).lean();

    if (!user) return null;

    const match = await bcrypt.compare(this.password, user.password);
    if (!match) return null;

    return sanitize(user);
  }

  async updateById(id) {
    const updateData = { ...this };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
    }
    await UserModel.findByIdAndUpdate(id, updateData);
  }

  static async softDelete(id) {
    await UserModel.findByIdAndUpdate(id, { isDeleted: true });
  }
}

export { User, UserModel };