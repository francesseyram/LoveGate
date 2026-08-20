import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { isSupersededByRevert } from "./revertGuard";
import { RegistrationDoc, RegistrationSummaryDTO, registrationToSummary } from "./types";

function requireStaff(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
  return request.auth.uid;
}

interface RosterEntry extends RegistrationSummaryDTO {
  /** Needed so a scan can be resolved without a round trip. */
  qrValue: string;
}

/**
 * The whole attendee list for one event, so the door can keep working when the
 * venue's network doesn't. A hall full of phones on congested campus wifi is
 * the normal case, and a scanner that needs a round trip per person is one
 * dropped connection away from useless.
 *
 * qrValue is included here (unlike the search DTO) because verifying a scan
 * locally is the entire point — but this is staff-only and is never sent to
 * an attendee.
 */
export const getEventRoster = onCall<{ eventId: string }>(async (request) => {
  requireStaff(request);
  const eventId = request.data?.eventId;
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }

  const snap = await db.collection("registrations").where("eventId", "==", eventId).get();

  const roster: RosterEntry[] = snap.docs.map((doc) => {
    const data = doc.data() as RegistrationDoc;
    return { ...registrationToSummary(doc.id, data), qrValue: data.qrValue };
  });

  return { roster, fetchedAt: Timestamp.now().toDate().toISOString() };
});

/**
 * Registered vs actually in the room. Uses count() aggregation so it stays a
 * cheap constant-cost query rather than reading every attendee document.
 */
export const getEventStats = onCall<{ eventId: string }>(async (request) => {
  requireStaff(request);
  const eventId = request.data?.eventId;
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }

  const base = db.collection("registrations").where("eventId", "==", eventId);
  const [totalSnap, checkedInSnap] = await Promise.all([
    base.count().get(),
    base.where("status", "==", "checked_in").count().get(),
  ]);

  const registered = totalSnap.data().count;
  const checkedIn = checkedInSnap.data().count;

  return { registered, checkedIn, yetToArrive: registered - checkedIn };
});

interface QueuedCheckIn {
  registrationId: string;
  /** When the person actually walked in, not when the network came back. */
  checkedInAt: string;
}

/**
 * Flushes check-ins recorded while offline. Idempotent per registration: a
 * row already marked checked_in is reported back rather than overwritten, so
 * re-sending a queue (a retry, two staff phones holding the same scan) can't
 * corrupt the count or clobber the original arrival time.
 */
export const syncCheckIns = onCall<{ eventId: string; checkIns: QueuedCheckIn[] }>(
  async (request) => {
    const staffUid = requireStaff(request);
    const { eventId, checkIns } = request.data ?? { eventId: "", checkIns: [] };

    if (!eventId || !Array.isArray(checkIns)) {
      throw new HttpsError("invalid-argument", "eventId and checkIns[] are required");
    }
    if (checkIns.length > 500) {
      throw new HttpsError("invalid-argument", "Too many check-ins in one batch (max 500)");
    }

    const applied: string[] = [];
    const alreadyCheckedIn: string[] = [];
    const notFound: string[] = [];
    const reverted: string[] = [];

    for (const entry of checkIns) {
      const docRef = db.collection("registrations").doc(entry.registrationId);
      const snap = await docRef.get();

      if (!snap.exists) {
        notFound.push(entry.registrationId);
        continue;
      }
      const registration = snap.data() as RegistrationDoc;
      if (registration.eventId !== eventId) {
        notFound.push(entry.registrationId);
        continue;
      }
      if (registration.status === "checked_in") {
        alreadyCheckedIn.push(entry.registrationId);
        continue;
      }

      const checkedInAt = entry.checkedInAt
        ? Timestamp.fromDate(new Date(entry.checkedInAt))
        : Timestamp.now();

      // A staff member has since undone a check-in for this person. Anything
      // scanned before that decision is what they were undoing, so honour it
      // rather than writing them back into the room. A genuine re-scan carries
      // a later timestamp and still applies.
      if (isSupersededByRevert(checkedInAt, registration.revertedAt)) {
        reverted.push(entry.registrationId);
        continue;
      }

      await docRef.update({
        status: "checked_in",
        checkedInAt,
        checkedInBy: staffUid,
        revertedAt: null,
      });
      applied.push(entry.registrationId);
    }

    logger.info("Synced offline check-ins", {
      eventId,
      applied: applied.length,
      alreadyCheckedIn: alreadyCheckedIn.length,
      notFound: notFound.length,
      reverted: reverted.length,
    });

    return { applied, alreadyCheckedIn, notFound, reverted };
  }
);
