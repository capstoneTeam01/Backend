// src/handlers/notificationHandler.js
import { Notification } from "../internal/db/notification.js";
import { sendAppointmentReminder } from "../services/notificationService.js";

const GetNotifications = (services) => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const notifications = await Notification.getAllByUser(userId);
      const unreadCount = await Notification.countUnread(userId);

      return res.status(200).json({
        success: true,
        unreadCount,
        notifications,
      });
    } catch (error) {
      console.log("GetNotifications error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const MarkNotificationRead = (services) => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { id } = req.params;

      const updated = await Notification.markAsRead(id, userId);
      if (!updated) {
        return res.status(404).json({ message: "notification not found" });
      }

      return res.status(200).json({
        success: true,
        message: "notification marked as read",
        notification: updated,
      });
    } catch (error) {
      console.log("MarkNotificationRead error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

const MarkAllNotificationsRead = (services) => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      await Notification.markAllAsRead(userId);

      return res.status(200).json({
        success: true,
        message: "all notifications marked as read",
      });
    } catch (error) {
      console.log("MarkAllNotificationsRead error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

// triggers the appointment reminder for the current user
const SendAppointmentReminder = (services) => {
  return async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { suggestedProviders } = req.body;

      const notification = await sendAppointmentReminder(
        userId,
        suggestedProviders,
      );

      if (!notification) {
        return res.status(500).json({ message: "could not create reminder" });
      }

      return res.status(201).json({
        success: true,
        message: "appointment reminder sent",
        notification,
      });
    } catch (error) {
      console.log("SendAppointmentReminder error:", error);
      return res.status(500).json({ message: "internal server error" });
    }
  };
};

export {
  GetNotifications,
  MarkNotificationRead,
  MarkAllNotificationsRead,
  SendAppointmentReminder,
};
