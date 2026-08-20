import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { RESEND_API_KEY } from "./secrets";
import { normalizePhone, toPhoneKey } from "./phone";
import { isEventCurrent } from "./eventWindow";
import { buildSearchPrefixes, buildTicketRef, registrationDocId } from "./search";
import { makeQrValue, generateQrPngBuffer, generateQrDataUrl } from "./qr";
import { sendConfirmationEmail } from "./email";
import { AUTO_CHECKIN_ACTOR, EventDoc, RegistrationDoc, registrationToDTO } from "./types";

interface RegisterInput {
  eventId: string;
  name: string;
  phone: string;
  email: string;
  dob?: string;
  school: string;
  level: string;
  whatsapp?: string;
  invitedBy?: string;
}

export const registerForEvent = onCall<RegisterInput>(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    const { eventId, name, phone, email, dob, school, level, whatsapp, invitedBy } =
      request.data ?? ({} as RegisterInput);

    if (!eventId || typeof eventId !== "string") {
      throw new HttpsError("invalid-argument", "eventId is required");
    }
    const trimmedName = (name ?? "").trim();
    const trimmedEmail = (email ?? "").trim();
    // No longer collected. Still accepted and stored so a browser running a
    // cached copy of the old form does not have its submission dropped, and
    // so existing registrations keep a consistent document shape.
    const trimmedDob = (dob ?? "").trim();
    const trimmedSchool = (school ?? "").trim();
    const trimmedLevel = (level ?? "").trim();
    // Free text and optional, so it is only ever trimmed and capped. Capping
    // matters because nothing downstream validates it and it is written
    // straight to the document.
    const trimmedInvitedBy = (invitedBy ?? "").trim().slice(0, 120);
    if (!trimmedName) {
      throw new HttpsError("invalid-argument", "name is required");
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new HttpsError("invalid-argument", "a valid email is required");
    }
    // Keep this threshold in sync with the client-side check in
    // frontend/components/RegistrationForm.tsx.
    const normalizedPhone = normalizePhone(phone ?? "");
    if (normalizedPhone.length < 9) {
      throw new HttpsError("invalid-argument", "a valid phone number is required");
    }
    if (!trimmedSchool) {
      throw new HttpsError("invalid-argument", "school is required");
    }
    if (!trimmedLevel) {
      throw new HttpsError("invalid-argument", "level is required");
    }
    const phoneKey = toPhoneKey(phone ?? "");
    const normalizedWhatsapp = whatsapp?.trim() ? toPhoneKey(whatsapp) : phoneKey;

    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Event not found");
    }
    const event = eventSnap.data() as EventDoc;
    if (event.status !== "published") {
      throw new HttpsError("failed-precondition", "This event is not open for registration");
    }
    // Without this, a stale shared link keeps issuing tickets to an event that
    // already happened.
    if (!isEventCurrent(event.startsAt)) {
      throw new HttpsError("failed-precondition", "Registration for this event has closed");
    }

    // Late-arrival mode. Once the doors are open, staff flip this on and anyone
    // still registering is standing in front of them — issuing a ticket they
    // then have to queue up and scan is a queue for nothing. Applies to new
    // registrations only: someone re-opening the form from home to find their
    // ticket again hits the alreadyRegistered path below and is not in the room.
    const autoCheckIn = event.autoCheckIn === true;
    const registeredAt = Timestamp.now();

    // Deterministic id keyed on the phone, so a duplicate submit collides in
    // the database instead of racing a read-then-write check.
    const docRef = db.collection("registrations").doc(registrationDocId(eventId, phoneKey));
    const qrValue = makeQrValue(docRef.id);
    const registration: RegistrationDoc = {
      eventId,
      name: trimmedName,
      nameLower: trimmedName.toLowerCase(),
      searchPrefixes: buildSearchPrefixes(trimmedName, buildTicketRef(docRef.id)),
      phone: normalizedPhone,
      phoneKey,
      email: trimmedEmail,
      dob: trimmedDob,
      school: trimmedSchool,
      level: trimmedLevel,
      whatsapp: normalizedWhatsapp,
      invitedBy: trimmedInvitedBy,
      qrValue,
      status: autoCheckIn ? "checked_in" : "going",
      registeredAt,
      checkedInAt: autoCheckIn ? registeredAt : null,
      checkedInBy: autoCheckIn ? AUTO_CHECKIN_ACTOR : null,
    };

    try {
      await docRef.create(registration);
    } catch (err) {
      // ALREADY_EXISTS — this phone already has a ticket for this event.
      if ((err as { code?: number }).code === 6) {
        const existingDoc = await docRef.get();
        const existing = existingDoc.data() as RegistrationDoc;
        return {
          alreadyRegistered: true,
          registration: registrationToDTO(existingDoc.id, existing),
          qrImage: await generateQrDataUrl(existing.qrValue),
        };
      }
      throw err;
    }

    const qrPng = await generateQrPngBuffer(qrValue);
    const qrImage = await generateQrDataUrl(qrValue);

    try {
      await sendConfirmationEmail({
        to: trimmedEmail,
        attendeeName: trimmedName,
        event,
        qrPng,
        ticketRef: buildTicketRef(docRef.id),
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
