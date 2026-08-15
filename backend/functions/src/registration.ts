import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RESEND_API_KEY } from "./secrets";
import { normalizePhone } from "./phone";
import { makeQrValue, generateQrPngBuffer, generateQrDataUrl } from "./qr";
import { sendConfirmationEmail } from "./email";
import { EventDoc, RegistrationDoc, registrationToDTO } from "./types";

interface RegisterInput {
  eventId: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  school: string;
  level: string;
  whatsapp?: string;
}

export const registerForEvent = onCall<RegisterInput>(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    const { eventId, name, phone, email, dob, school, level, whatsapp } =
      request.data ?? ({} as RegisterInput);

    if (!eventId || typeof eventId !== "string") {
      throw new HttpsError("invalid-argument", "eventId is required");
    }
    const trimmedName = (name ?? "").trim();
    const trimmedEmail = (email ?? "").trim();
    const trimmedDob = (dob ?? "").trim();
    const trimmedSchool = (school ?? "").trim();
    const trimmedLevel = (level ?? "").trim();
    if (!trimmedName) {
      throw new HttpsError("invalid-argument", "name is required");
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new HttpsError("invalid-argument", "a valid email is required");
    }
    const normalizedPhone = normalizePhone(phone ?? "");
    if (normalizedPhone.length < 7) {
      throw new HttpsError("invalid-argument", "a valid phone number is required");
    }
    if (!trimmedDob) {
      throw new HttpsError("invalid-argument", "date of birth is required");
    }
    if (!trimmedSchool) {
      throw new HttpsError("invalid-argument", "school is required");
    }
    if (!trimmedLevel) {
      throw new HttpsError("invalid-argument", "level is required");
    }
    const normalizedWhatsapp = whatsapp?.trim() ? normalizePhone(whatsapp) : normalizedPhone;

    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Event not found");
    }
    const event = eventSnap.data() as EventDoc;
    if (event.status !== "published") {
      throw new HttpsError("failed-precondition", "This event is not open for registration");
    }

    const existingSnap = await db
      .collection("registrations")
      .where("eventId", "==", eventId)
      .where("phone", "==", normalizedPhone)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const existing = existingDoc.data() as RegistrationDoc;
      const qrImage = await generateQrDataUrl(existing.qrValue);
      return {
        alreadyRegistered: true,
        registration: registrationToDTO(existingDoc.id, existing),
        qrImage,
      };
    }

    const docRef = db.collection("registrations").doc();
    const qrValue = makeQrValue(eventId, docRef.id);
    const registration: RegistrationDoc = {
      eventId,
      name: trimmedName,
      nameLower: trimmedName.toLowerCase(),
      phone: normalizedPhone,
      email: trimmedEmail,
      dob: trimmedDob,
      school: trimmedSchool,
      level: trimmedLevel,
      whatsapp: normalizedWhatsapp,
      qrValue,
      status: "going",
      registeredAt: Timestamp.now(),
      checkedInAt: null,
    };

    await docRef.set(registration);

    const qrPng = await generateQrPngBuffer(qrValue);
    const qrImage = await generateQrDataUrl(qrValue);

    try {
      await sendConfirmationEmail({
        to: trimmedEmail,
        attendeeName: trimmedName,
        event,
        qrPng,
      });
    } catch (err) {
      logger.error("Failed to send confirmation email", {
        eventId,
        registrationId: docRef.id,
        err,
      });
    }

    return {
      alreadyRegistered: false,
      registration: registrationToDTO(docRef.id, registration),
      qrImage,
    };
  }
);
