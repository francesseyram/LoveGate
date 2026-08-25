import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RESEND_API_KEY } from "./secrets";
import { sendThankYouEmail } from "./email";
import { EventDoc, RegistrationDoc } from "./types";

/**
 * The thank-you blast, sent by hand once an event is over.
 *
 * Deliberately separate from reminders.ts rather than folded into it. A
 * reminder goes to people who have not arrived yet (`status == "going"`) and
 * carries their ticket; this goes to everyone who ever registered, ticket
 * spent or never used, and carries no ticket at all. The two audiences and the
 * two idempotency keys are different, so sharing a handler would mean a flag
 * deciding which of everything to do. The batching loop below is the same
 * shape as the one in reminders.ts on purpose — same rate limit, same reason.
 */

/** Resend allows ~10 requests/second; half of that leaves headroom. */
const SEND_CONCURRENCY = 5;

/** Generous ceiling: 1000 registrants at this concurrency finishes well inside it. */
const THANK_YOU_TIMEOUT_SECONDS = 540;

/** Firestore's hard cap on writes in one batch. */
const BATCH_LIMIT = 500;

function requireStaff(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
  return request.auth.uid;
}

/**
 * Everyone registered for the event who can actually be emailed.
 *
 * The email filter is not defensive padding. Self check-in raises a
 * registration from a `member_db` record, and roughly a sixth of that roster
 * has no email address on file — those rows are stored with `email: ""`.
 * Reminders never meet them (they are written straight in as `checked_in`),
 * but a blast to *everyone registered* walks right into them, and Resend
 * rejects an empty recipient, so without this every one of them would be
 * counted as a failed send.
 */
async function recipientsFor(eventId: string) {
  const snap = await db.collection("registrations").where("eventId", "==", eventId).get();
  return snap.docs.filter((doc) => (doc.data() as RegistrationDoc).email?.trim());
}

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
}

async function sendThankYouForEvent(eventId: string, event: EventDoc): Promise<SendResult> {
  const recipients = await recipientsFor(eventId);

  // `thankedAt` per registration is the idempotency key, matching how
  // reminders guard themselves: a run that dies halfway can be retried
  // without re-emailing everyone it already reached.
  const pending = recipients.filter((doc) => !(doc.data() as RegistrationDoc).thankedAt);
  const skipped = recipients.length - pending.length;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += SEND_CONCURRENCY) {
    const batch = pending.slice(i, i + SEND_CONCURRENCY);

    await Promise.all(
      batch.map(async (doc) => {
        const registration = doc.data() as RegistrationDoc;
        try {
          await sendThankYouEmail({
            to: registration.email,
            attendeeName: registration.name,
            event,
          });
          // Marked only after a confirmed send, so a failure is retried next
          // run rather than silently skipped.
          await doc.ref.update({ thankedAt: Timestamp.now() });
          sent++;
        } catch (err) {
          failed++;
          logger.error("Failed to send thank-you email", {
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

/** Who a blast would reach right now — shown before staff commit to sending. */
export const getThankYouRecipientCount = onCall<{ eventId: string }>(async (request) => {
  requireStaff(request);
  const eventId = request.data?.eventId;
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }

  const snap = await db.collection("registrations").where("eventId", "==", eventId).get();
  const contactable = snap.docs.filter((doc) => (doc.data() as RegistrationDoc).email?.trim());
  const alreadyThanked = contactable.filter(
    (doc) => (doc.data() as RegistrationDoc).thankedAt
  ).length;

  return {
    total: contactable.length,
    /** Registered but unreachable — self check-ins raised from a member with no email. */
    noEmail: snap.size - contactable.length,
    alreadyThanked,
    willReceive: contactable.length - alreadyThanked,
  };
});

interface SendEventThankYouInput {
  eventId: string;
  /** Send again to people who already got one. */
  resend?: boolean;
}

export const sendEventThankYou = onCall<SendEventThankYouInput>(
  {
    secrets: [RESEND_API_KEY],
    timeoutSeconds: THANK_YOU_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (request) => {
    const uid = requireStaff(request);
    const { eventId, resend } = request.data ?? ({} as SendEventThankYouInput);
    if (!eventId) {
      throw new HttpsError("invalid-argument", "eventId is required");
    }

    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Event not found");
    }
    const event = eventSnap.data() as EventDoc;

    // An explicit re-send clears the per-person guard first. Chunked because
    // a Firestore batch caps at 500 writes and this one covers every
    // registration for the event, not just the ones yet to arrive.
    if (resend) {
      const recipients = await recipientsFor(eventId);
      for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        recipients.slice(i, i + BATCH_LIMIT).forEach((doc) => {
          batch.update(doc.ref, { thankedAt: null });
        });
        await batch.commit();
      }
    }

    const result = await sendThankYouForEvent(eventId, event);
    logger.info("Thank-you blast", { eventId, by: uid, ...result });
    return result;
  }
);
