import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RegistrationDoc, registrationToSummary } from "./types";

function requireStaff(request: CallableRequest<unknown>): string {
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
  await docRef.update({ status: "checked_in", checkedInAt, checkedInBy: staffUid });

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
