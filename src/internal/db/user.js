import mongoose from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const isLocal = function () {
  return this.provider === "local";
};

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
    required: isLocal,
  },
  location: {
    type: String,
    default: "",
  },
  provider: {
    type: String,
    enum: ["local", "google", "apple"],
    default: "local",
  },
  providerId: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ["user", "provider", "admin"],
    default: "user",
  },
  profileImage: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: "",
  },
  notificationSettings: {
    push: {
      type: Boolean,
      default: true,
    },
    appointmentReminders: {
      type: Boolean,
      default: true,
    },
  },
  aiSettings: {
    useLocalLlm: {
      type: Boolean,
      default: false,
    },
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

UserSchema.index(
  { provider: 1, providerId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerId: { $type: "string" } },
  },
);

const UserModel = mongoose.model("User", UserSchema);

const sanitize = (userDoc) => {
  if (!userDoc) return null;
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  const { password, __v, ...safe } = obj;
  return safe;
};

class User {
  constructor(
    email,
    password,
    name,
    location,
    phone = "",
    role = "user",
    profileImage = null,
    provider = "local",
    providerId = null,
  ) {
    this.email = email?.toLowerCase().trim();
    this.password = password;
    this.name = name;
    this.location = location;
    this.phone = phone;
    this.role = role;
    this.profileImage = profileImage;
    this.provider = provider;
    this.providerId = providerId;
  }

  async save() {
    const payload = { ...this };
    if (this.password) {
      payload.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    } else {
      delete payload.password;
    }
    const user = new UserModel(payload);
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

    if (!user.password) return null;

    const match = await bcrypt.compare(this.password, user.password);
    if (!match) return null;

    return sanitize(user);
  }
  static async findOrCreateSocialUser({
    provider,
    providerId,
    email,
    name,
    profileImage = null,
  }) {
    const cleanEmail = email?.toLowerCase().trim();

    let user = await UserModel.findOne({
      provider,
      providerId,
      isDeleted: false,
    }).lean();
    if (user) return { user: sanitize(user), created: false };

    if (cleanEmail) {
      const byEmail = await UserModel.findOne({
        email: cleanEmail,
        isDeleted: false,
      });
      if (byEmail) {
        if (!byEmail.providerId) {
          byEmail.provider = provider;
          byEmail.providerId = providerId;
          if (profileImage && !byEmail.profileImage)
            byEmail.profileImage = profileImage;
          await byEmail.save();
        }
        return { user: sanitize(byEmail), created: false };
      }
    }

    const created = await UserModel.create({
      name: name || "FixBee User",
      email: cleanEmail,
      provider,
      providerId,
      profileImage,
    });
    return { user: sanitize(created), created: true };
  }

  async updateById(id) {
    const updateData = { ...this };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
    } else {
      delete updateData.password;
    }
    await UserModel.findByIdAndUpdate(id, updateData);
  }

  static async softDelete(id) {
    await UserModel.findByIdAndUpdate(id, { isDeleted: true });
  }

  static async verifyPassword(id, plainPassword) {
    const user = await UserModel.findOne({ _id: id, isDeleted: false }).lean();
    if (!user || !user.password) return false;
    return bcrypt.compare(plainPassword, user.password);
  }
}

export { User, UserModel };