import mongoose from "mongoose";

const NOTIFICATION_TYPES = [
  "appointment_reminder",
  "appointment_confirmed",
  "provider_reply",
  "general",
];

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    default: "general",
  },
  // frontend uses this to route the user (e.g. "/my-services")
  redirectTo: {
    type: String,
    required: false,
    default: "",
  },
  // optional reference to the related analysis/issue for context
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
 triggerAt: {
  type: Date,
  required: false,
  default: null,
},
selectedProviders: {
  type: [mongoose.Schema.Types.Mixed],
  default: [],
}, 
  isRead: {
    type: Boolean,
    default: false,
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

const NotificationModel = mongoose.model("Notification", NotificationSchema);

class Notification {
  constructor(
  userId,
  title,
  message,
  type = "general",
  redirectTo = "",
  relatedId = null,
  triggerAt = null,
  selectedProviders = [],
) {
  this.userId = userId;
  this.title = title;
  this.message = message;
  this.type = type;
  this.redirectTo = redirectTo;
  this.relatedId = relatedId;
  this.triggerAt = triggerAt;
  this.selectedProviders = selectedProviders;
}

  async save() {
    const notification = new NotificationModel(this);
    const saved = await notification.save();
    return saved;
  }

static async getAllByUser(userId) {
  return NotificationModel.find({
    userId,
    isDeleted: false,
    $or: [
      { triggerAt: null },
      { triggerAt: { $lte: new Date() } },
    ],
  }).sort({ createdAt: -1 });
}

  static async getById(id) {
    return NotificationModel.findOne({
      _id: id,
      isDeleted: false,
    });
  }

  static async countUnread(userId) {
    return NotificationModel.countDocuments({
      userId,
      isRead: false,
      isDeleted: false,
    });
  }

  static async markAsRead(id, userId) {
    // scope by userId so a user can only mark their own notifications
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { isRead: true },
      { new: true },
    );
  }

  static async markAllAsRead(userId) {
    await NotificationModel.updateMany(
      { userId, isRead: false, isDeleted: false },
      { isRead: true },
    );
  }

  static async softDelete(id, userId) {
    await NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { isDeleted: true },
    );
  }
}

export { Notification, NotificationModel, NOTIFICATION_TYPES };
