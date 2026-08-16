import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RESEND_API_KEY } from "./secrets";
import { generateQrPngBuffer } from "./qr";
import { sendReminderEmail } from "./email";
import { buildTicketRef } from "./search";
import { EventDoc, RegistrationDoc } from "./types";

/**
 * Resend allows ~10 requests/second. Staying meaningfully under that keeps the
 * whole blast off the rate limiter while still being ~5x faster than the
 * one-at-a-time loop this replaces.
 */
const SEND_CONCURRENCY = 5;

/** Generous ceiling: 1000 registrants at this concurrency finishes well inside it. */
const REMINDER_TIMEOUT_SECONDS = 540;

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
}

async function sendRemindersForEvent(eventId: string, event: EventDoc): Promise<SendResult> {
  const regsSnap = await db
    .collection("registrations")
    .where("eventId", "==", eventId)
    .where("status", "==", "going")
    .get();

  // `remindedAt` per registration is the idempotency key. The old single
  // `events.reminderSentAt` flag meant a run that died halfway re-emailed
  // everyone who had already received one when it was retried.
  const pending = regsSnap.docs.filter((doc) => !(doc.data() as RegistrationDoc).remindedAt);
  const skipped = regsSnap.size - pending.length;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += SEND_CONCURRENCY) {
    const batch = pending.slice(i, i + SEND_CONCURRENCY);

    await Promise.all(
      batch.map(async (doc) => {
        const registration = doc.data() as RegistrationDoc;
        try {
          const qrPng = await generateQrPngBuffer(registration.qrValue);
          await sendReminderEmail({
            to: registration.email,
            attendeeName: registration.name,
            event,
            qrPng,
            ticketRef: buildTicketRef(doc.id),
          });
          // Marked only after a confirmed send, so a failure is retried rather
          // than silently skipped next time.
          await doc.ref.update({ remindedAt: Timestamp.now() });
          sent++;
        } catch (err) {
          failed++;
          logger.error("Failed to send reminder email", {
            eventId,
            registrationId: doc.id,
            err,
          });
        }
      })
    );
  }

  return { sent, skipped, failed };
}

// Runs hourly; catches any published event starting 23-25h from now that
// hasn't had its reminder sent yet, so a run that's slightly early/late
// against a given event's exact start time still catches it once.
export const sendUpcomingReminders = onSchedule(
  {
    schedule: "every 60 minutes",
    secrets: [RESEND_API_KEY],
    timeoutSeconds: REMINDER_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
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
      const result = await sendRemindersForEvent(eventDoc.id, event);
      await eventDoc.ref.update({ reminderSentAt: Timestamp.now() });
      logger.info(`Reminders for event ${eventDoc.id}`, result);
    }
  }
);

/** Who would receive a manual blast right now — shown before staff commit to sending. */
export const getReminderRecipientCount = onCall<{ eventId: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
  const eventId = request.data?.eventId;
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }

  const snap = await db
    .collection("registrations")
    .where("eventId", "==", eventId)
    .where("status", "==", "going")
    .get();

  const alreadyReminded = snap.docs.filter(
    (doc) => (doc.data() as RegistrationDoc).remindedAt
  ).length;

  return {
    total: snap.size,
    alreadyReminded,
    willReceive: snap.size - alreadyReminded,
  };
});

interface TriggerManualReminderInput {
  eventId: string;
  /** Re-send to people who already got one (e.g. venue changed). */
  resend?: boolean;
}

export const triggerManualReminder = onCall<TriggerManualReminderInput>(
  {
    secrets: [RESEND_API_KEY],
    timeoutSeconds: REMINDER_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Staff sign-in required");
    }
    const { eventId, resend } = request.data ?? ({} as TriggerManualReminderInput);
    if (!eventId) {
      throw new HttpsError("invalid-argument", "eventId is required");
    }

    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Event not found");
    }
    const event = eventSnap.data() as EventDoc;

    // An explicit re-send clears the per-person guard first.
    if (resend) {
      const regsSnap = await db
        .collection("registrations")
        .where("eventId", "==", eventId)
        .where("status", "==", "going")
        .get();
      const batch = db.batch();
      regsSnap.docs.forEach((doc) => batch.update(doc.ref, { remindedAt: null }));
      await batch.commit();
    }

    const result = await sendRemindersForEvent(eventId, event);
    logger.info("Manual reminder blast", { eventId, by: request.auth.uid, ...result });
    return result;
  }
);
