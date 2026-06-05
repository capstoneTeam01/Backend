// src/services/notificationService.js
import { Notification } from "../internal/db/notification.js";

// where the notification should take the user when clicked
const MY_SERVICES_ROUTE = "/my-services";

/*
 * sendAppointmentReminder
 * Creates a reminder prompting the user to finalize one provider from the
 * suggested list and confirm the appointment. Integrates with the existing
 * suggested-provider list passed in by the caller.
 */
const sendAppointmentReminder = async (userId, suggestedProviders = []) => {
  if (!userId) {
    console.error("sendAppointmentReminder: missing userId");
    return null;
  }

  const count = Array.isArray(suggestedProviders)
    ? suggestedProviders.length
    : 0;

  const message =
    count > 0
      ? `You have ${count} suggested provider${
          count === 1 ? "" : "s"
        }. Choose one to finalize and confirm your appointment.`
      : "Finalize one provider from your replies and confirm your appointment.";

  try {
    const notification = new Notification(
      userId,
      "Confirm your appointment",
      message,
      "appointment_reminder",
      MY_SERVICES_ROUTE,
    );

    return await notification.save();
  } catch (error) {
    console.error("sendAppointmentReminder error:", error.message);
    return null;
  }
};

export { sendAppointmentReminder, MY_SERVICES_ROUTE };
