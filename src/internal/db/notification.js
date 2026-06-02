import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  isRead: {
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
  constructor(userId, title, message) {
    this.userId = userId;
    this.title = title;
    this.message = message;
  }

  async save() {
    const notification = new NotificationModel(this);
    await notification.save();
  }

  static async getAllByUser(userId) {
    return NotificationModel.find({
      userId: userId,
    }).sort({ createdAt: -1 });
  }

  static async markAsRead(id) {
    await NotificationModel.findByIdAndUpdate(id, {
      isRead: true,
    });
  }
}

export { Notification, NotificationModel };