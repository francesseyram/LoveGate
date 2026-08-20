import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { RegistrationDoc, registrationToSummary } from "./types";

export function requireStaff(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
  return request.auth.uid;
}

async function markCheckedIn(
  docRef: FirebaseFirestore.DocumentReference,
  doc: RegistrationDoc,
  staffUid: string
) {
  if (doc.status === "checked_in") {
    return {
      outcome: "already_checked_in" as const,
      registration: registrationToSummary(docRef.id, doc),
    };
  }

  const checkedInAt = Timestamp.now();
  // Clearing revertedAt matters: this is a live scan, so it necessarily happened
  // after any earlier revert, and leaving the marker would have syncCheckIns
  // discard this person's next queued scan.
  await docRef.update({
    status: "checked_in",
    checkedInAt,
    checkedInBy: staffUid,
    revertedAt: null,
  });

  return {
    outcome: "checked_in" as const,
    registration: registrationToSummary(docRef.id, { ...doc, status: "checked_in", checkedInAt }),
  };
}

interface CheckInByQrInput {
  eventId: string;
  qrValue: string;
}

export const checkInByQr = onCall<CheckInByQrInput>(async (request) => {
  const staffUid = requireStaff(request);
  const { eventId, qrValue } = request.data ?? ({} as CheckInByQrInput);
  if (!eventId || !qrValue) {
    throw new HttpsError("invalid-argument", "eventId and qrValue are required");
  }

  const snap = await db.collection("registrations").where("qrValue", "==", qrValue).limit(1).get();
  if (snap.empty) {
    throw new HttpsError("not-found", "No ticket found for this QR code");
  }

  const doc = snap.docs[0];
  const registration = doc.data() as RegistrationDoc;
  if (registration.eventId !== eventId) {
    throw new HttpsError("not-found", "This ticket is not for the selected event");
  }

  return markCheckedIn(doc.ref, registration, staffUid);
});

interface CheckInByIdInput {
  eventId: string;
  registrationId: string;
}

export const checkInByRegistrationId = onCall<CheckInByIdInput>(async (request) => {
  const staffUid = requireStaff(request);
  const { eventId, registrationId } = request.data ?? ({} as CheckInByIdInput);
  if (!eventId || !registrationId) {
    throw new HttpsError("invalid-argument", "eventId and registrationId are required");
  }

  const docRef = db.collection("registrations").doc(registrationId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Registration not found");
  }

  const registration = snap.data() as RegistrationDoc;
  if (registration.eventId !== eventId) {
    throw new HttpsError("not-found", "This registration is not for the selected event");
  }

  return markCheckedIn(docRef, registration, staffUid);
});

interface UndoCheckInInput {
  eventId: string;
  registrationId: string;
}

/**
 * Puts someone back to "not arrived".
 *
 * Check-ins get made in error constantly at a real door — a volunteer taps the
 * row above the one they meant, two people share a name, someone scans a
 * friend's screenshot, or late-arrival mode admits a person who registered from
 * home. Without this the only fix was deleting the registration, which throws
 * away a real attendee's ticket to correct a one-tap mistake.
 *
 * The arrival time is cleared rather than kept: `checkedInAt` is what the
 * arrivals-by-hour chart plots, and a reverted check-in was never an arrival.
 */
export const undoCheckIn = onCall<UndoCheckInInput>(async (request) => {
  const staffUid = requireStaff(request);
  const { eventId, registrationId } = request.data ?? ({} as UndoCheckInInput);
  if (!eventId || !registrationId) {
    throw new HttpsError("invalid-argument", "eventId and registrationId are required");
  }

  const docRef = db.collection("registrations").doc(registrationId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Registration not found");
  }

  const registration = snap.data() as RegistrationDoc;
  if (registration.eventId !== eventId) {
    throw new HttpsError("not-found", "This registration is not for the selected event");
  }

  const revertedAt = Timestamp.now();

  // Not an error. Two staff phones can undo the same row, and a queued offline
  // check-in can land after an undo — both should settle, not throw.
  //
  // The marker is written even here, where the row already reads "going". The
  // server may simply not have heard the scan yet: it can still be sitting in
  // a queue on a phone that has been offline since the door opened. Returning
  // without stamping would leave that scan free to land later and undo the
  // undo, which is the exact case this marker exists for.
  if (registration.status !== "checked_in") {
    await docRef.update({ revertedAt });
    return {
      outcome: "not_checked_in" as const,
      registration: registrationToSummary(docRef.id, registration),
    };
  }

  await docRef.update({ status: "going", checkedInAt: null, checkedInBy: null, revertedAt });

  logger.info("Reverted check-in", {
    eventId,
    registrationId,
    name: registration.name,
    wasCheckedInBy: registration.checkedInBy,
    revertedBy: staffUid,
  });

  return {
    outcome: "reverted" as const,
    registration: registrationToSummary(docRef.id, {
      ...registration,
      status: "going",
      checkedInAt: null,
      checkedInBy: null,
    }),
  };
});

interface SearchInput {
  eventId: string;
  query: string;
}

export const searchRegistrations = onCall<SearchInput>(async (request) => {
  requireStaff(request);
  const { eventId, query } = request.data ?? ({} as SearchInput);
  if (!eventId || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "eventId and query are required");
  }

  // Strip punctuation so a typed ticket ref like "LG-4F9K2A" also matches.
  const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!q) {
    return { registrations: [] };
  }

  // array-contains against pre-computed prefixes matches ANY word in the name
  // (surname included) — a range query on nameLower only ever matched from the
  // start of the full string, so "owusu" could never find "Ama Owusu".
  const snap = await db
    .collection("registrations")
    .where("eventId", "==", eventId)
    .where("searchPrefixes", "array-contains", q)
    .limit(20)
    .get();

  return {
    registrations: snap.docs.map((doc) => registrationToSummary(doc.id, doc.data() as RegistrationDoc)),
  };
});
