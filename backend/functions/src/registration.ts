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
import { AUTO_CHECKIN_ACTOR, EventDoc, RegistrationDoc, registrationToDTO, ticketRefOf } from "./types";
import { eventSessions } from "./eventShape";

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
  /** The event's companion (see EventDoc.companionSlug), ticked to register for it too. */
  alsoEventId?: string;
}

export const registerForEvent = onCall<RegisterInput>(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    const { eventId, name, phone, email, dob, school, level, whatsapp, invitedBy, alsoEventId } =
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

    const event = await loadOpenEvent(eventId, "This event");

    // The optional second event, ticked on the form. Only ever the companion
    // this event names, so the form can't be used to sign people up elsewhere.
    let companion: { id: string; doc: EventDoc } | null = null;
    if (alsoEventId) {
      if (typeof alsoEventId !== "string" || alsoEventId === eventId) {
        throw new HttpsError("invalid-argument", "alsoEventId is invalid");
      }
      const doc = await loadOpenEvent(alsoEventId, "The other event");
      if (!event.companionSlug || doc.slug !== event.companionSlug) {
        throw new HttpsError("invalid-argument", "These events can't be registered for together");
      }
      companion = { id: alsoEventId, doc };
    }

    // Late-arrival mode. Once the doors are open, staff flip this on and anyone
    // still registering is standing in front of them — issuing a ticket they
    // then have to queue up and scan is a queue for nothing. Applies to new
    // registrations only: someone re-opening the form from home to find their
    // ticket again hits the alreadyRegistered path below and is not in the room.
    // Never applied to the companion: registering for Sunday from the Friday
    // door is not arriving on Sunday.
    const autoCheckIn = event.autoCheckIn === true;
    const registeredAt = Timestamp.now();

    const person = {
      name: trimmedName,
      nameLower: trimmedName.toLowerCase(),
      phone: normalizedPhone,
      phoneKey,
      email: trimmedEmail,
      dob: trimmedDob,
      school: trimmedSchool,
      level: trimmedLevel,
      whatsapp: normalizedWhatsapp,
      invitedBy: trimmedInvitedBy,
      registeredAt,
    };

    // Deterministic ids keyed on the phone, so each event holds at most one
    // registration per person: a duplicate submit, or ticking the companion a
    // second time, lands on the same document instead of a new one.
    const registrations = db.collection("registrations");
    const primaryRef = registrations.doc(registrationDocId(eventId, phoneKey));
    const companionRef = companion ? registrations.doc(registrationDocId(companion.id, phoneKey)) : null;

    const outcome = await db.runTransaction(async (tx) => {
      const [primarySnap, companionSnap] = await Promise.all([
        tx.get(primaryRef),
        companionRef ? tx.get(companionRef) : Promise.resolve(null),
      ]);
      const primaryExisting = primarySnap.exists ? (primarySnap.data() as RegistrationDoc) : null;
      const companionExisting = companionSnap?.exists ? (companionSnap.data() as RegistrationDoc) : null;

      // One ticket for both. Whichever registration already exists keeps its
      // QR — it may already be in their inbox — and the new one reuses it.
      const ticket = primaryExisting
        ? { qrValue: primaryExisting.qrValue, ticketOf: primaryExisting.ticketOf ?? primaryRef.id }
        : companionExisting && companionRef
          ? { qrValue: companionExisting.qrValue, ticketOf: companionExisting.ticketOf ?? companionRef.id }
          : { qrValue: makeQrValue(primaryRef.id), ticketOf: primaryRef.id };

      const build = (forEventId: string, id: string, checkIn: boolean): RegistrationDoc => ({
        eventId: forEventId,
        ...person,
        searchPrefixes: buildSearchPrefixes(trimmedName, buildTicketRef(ticket.ticketOf)),
        qrValue: ticket.qrValue,
        ...(ticket.ticketOf !== id ? { ticketOf: ticket.ticketOf } : {}),
        status: checkIn ? "checked_in" : "going",
        checkedInAt: checkIn ? registeredAt : null,
        checkedInBy: checkIn ? AUTO_CHECKIN_ACTOR : null,
      });

      const primary = primaryExisting ?? build(eventId, primaryRef.id, autoCheckIn);
      if (!primaryExisting) tx.create(primaryRef, primary);

      let companionDoc = companionExisting;
      if (companion && companionRef && !companionExisting) {
        companionDoc = build(companion.id, companionRef.id, false);
        tx.create(companionRef, companionDoc);
      }

      return {
        primary,
        primaryCreated: !primaryExisting,
        companionDoc,
        companionCreated: Boolean(companion && !companionExisting),
      };
    });

    const { primary, primaryCreated, companionDoc, companionCreated } = outcome;
    // False only when both registrations predate this call with different
    // tickets (they registered for each separately) — then they keep two.
    const sharesTicket = Boolean(companionDoc && companionDoc.qrValue === primary.qrValue);
    const qrImage = await generateQrDataUrl(primary.qrValue);

    // A new registration on either side gets the confirmation; re-opening the
    // form to find a ticket again doesn't re-send it. When the ticket covers
    // both events, so does the email.
    if (primaryCreated || companionCreated) {
      const emailEvent: EventDoc =
        companion && sharesTicket
          ? {
              ...event,
              name: `${event.name} & ${companion.doc.name}`,
              sessions: [...eventSessions(event), ...eventSessions(companion.doc)],
            }
          : event;
      try {
        await sendConfirmationEmail({
          to: trimmedEmail,
          attendeeName: trimmedName,
          event: emailEvent,
          qrPng: await generateQrPngBuffer(primary.qrValue),
          ticketRef: ticketRefOf(primaryRef.id, primary),
        });
      } catch (err) {
        logger.error("Failed to send confirmation email", {
          eventId,
          registrationId: primaryRef.id,
          err,
        });
      }
    }

    return {
      alreadyRegistered: !primaryCreated,
      registration: registrationToDTO(primaryRef.id, primary),
      qrImage,
      ...(companion && companionDoc && companionRef
        ? {
            companion: {
              eventId: companion.id,
              alreadyRegistered: !companionCreated,
              sharesTicket,
            },
          }
        : {}),
    };
  }
);

/** The event, if it can take registrations right now; otherwise a sentence saying why not. */
async function loadOpenEvent(id: string, label: string): Promise<EventDoc> {
  const snap = await db.collection("events").doc(id).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Event not found");
  }
  const event = snap.data() as EventDoc;
  if (event.status !== "published") {
    throw new HttpsError("failed-precondition", `${label} is not open for registration`);
  }
  // Without this, a stale shared link keeps issuing tickets to an event that
  // already happened.
  if (!isEventCurrent(event)) {
    throw new HttpsError("failed-precondition", `Registration for ${label.toLowerCase()} has closed`);
  }
  return event;
}
