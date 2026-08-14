import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RegistrationDoc, registrationToDTO } from "./types";

function requireStaff(request: CallableRequest<unknown>): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }
}

async function markCheckedIn(docRef: FirebaseFirestore.DocumentReference, doc: RegistrationDoc) {
  if (doc.status === "checked_in") {
    return {
      outcome: "already_checked_in" as const,
      registration: registrationToDTO(docRef.id, doc),
    };
  }

  const checkedInAt = Timestamp.now();
  await docRef.update({ status: "checked_in", checkedInAt });

  return {
    outcome: "checked_in" as const,
    registration: registrationToDTO(docRef.id, { ...doc, status: "checked_in", checkedInAt }),
  };
}

interface CheckInByQrInput {
  eventId: string;
  qrValue: string;
}

export const checkInByQr = onCall<CheckInByQrInput>(async (request) => {
  requireStaff(request);
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

  return markCheckedIn(doc.ref, registration);
});

interface CheckInByIdInput {
  eventId: string;
  registrationId: string;
}

export const checkInByRegistrationId = onCall<CheckInByIdInput>(async (request) => {
  requireStaff(request);
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

  return markCheckedIn(docRef, registration);
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

  const q = query.trim().toLowerCase();
  if (!q) {
    return { registrations: [] };
  }

  const snap = await db
    .collection("registrations")
    .where("eventId", "==", eventId)
    .where("nameLower", ">=", q)
    .where("nameLower", "<=", q + "")
    .limit(20)
    .get();

  return {
    registrations: snap.docs.map((doc) => registrationToDTO(doc.id, doc.data() as RegistrationDoc)),
  };
});
