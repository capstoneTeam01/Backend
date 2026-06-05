// src/routes/notificationRoutes.js
import express from "express";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";
import {
  GetNotifications,
  MarkNotificationRead,
  MarkAllNotificationsRead,
  SendAppointmentReminder,
} from "../handlers/notificationHandler.js";

const notificationRoutes = (services) => {
  const router = express.Router();

  router.use(AuthMiddleware(services));

  router.get("/", GetNotifications(services));
  router.post("/reminder", SendAppointmentReminder(services));
  router.patch("/:id/read", MarkNotificationRead(services));
  router.patch("/read-all", MarkAllNotificationsRead(services));

  return router;
};

export default notificationRoutes;