import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RESEND_API_KEY } from "./secrets";
import { generateQrPngBuffer } from "./qr";
import { sendReminderEmail } from "./email";
import { EventDoc, RegistrationDoc } from "./types";

async function sendRemindersForEvent(eventId: string, event: EventDoc): Promise<number> {
  const regsSnap = await db
    .collection("registrations")
    .where("eventId", "==", eventId)
    .where("status", "==", "going")
    .get();

  let sent = 0;
  for (const doc of regsSnap.docs) {
    const registration = doc.data() as RegistrationDoc;
    try {
      const qrPng = await generateQrPngBuffer(registration.qrValue);
      await sendReminderEmail({
        to: registration.email,
        attendeeName: registration.name,
        event,
        qrPng,
      });
      sent++;
    } catch (err) {
      logger.error("Failed to send reminder email", { eventId, registrationId: doc.id, err });
    }
  }
  return sent;
}

// Runs hourly; catches any published event starting 23-25h from now that
// hasn't had its reminder sent yet, so a run that's slightly early/late
// against a given event's exact start time still catches it once.
export const sendUpcomingReminders = onSchedule(
  { schedule: "every 60 minutes", secrets: [RESEND_API_KEY] },
  async () => {
    const now = Timestamp.now();
    const windowStart = Timestamp.fromMillis(now.toMillis() + 23 * 60 * 60 * 1000);
    const windowEnd = Timestamp.fromMillis(now.toMillis() + 25 * 60 * 60 * 1000);

    const eventsSnap = await db
      .collection("events")
      .where("status", "==", "published")
      .where("startsAt", ">=", windowStart)
      .where("startsAt", "<=", windowEnd)
      .get();

    for (const eventDoc of eventsSnap.docs) {
      const event = eventDoc.data() as EventDoc;
      if (event.reminderSentAt) continue;

      const sent = await sendRemindersForEvent(eventDoc.id, event);
      await eventDoc.ref.update({ reminderSentAt: Timestamp.now() });
      logger.info(`Sent ${sent} reminder emails for event ${eventDoc.id}`);
    }
  }
);

interface TriggerManualReminderInput {
  eventId: string;
}

export const triggerManualReminder = onCall<TriggerManualReminderInput>(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Staff sign-in required");
    }
    const { eventId } = request.data ?? ({} as TriggerManualReminderInput);
    if (!eventId) {
      throw new HttpsError("invalid-argument", "eventId is required");
    }

    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Event not found");
    }
    const event = eventSnap.data() as EventDoc;

    const sent = await sendRemindersForEvent(eventId, event);
    return { sent };
  }
);
