import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { isEventCurrent } from "./eventWindow";
import { buildSearchPrefixes, buildTicketRef, registrationDocId } from "./search";
import { makeQrValue } from "./qr";
import { EventDoc, RegistrationDoc } from "./types";

/**
 * Self check-in, for the part of the night when nobody is on the door.
 *
 * This is the only PUBLIC surface that reads people's records, so it is
 * deliberately mean about what it will do:
 *
 *   - a query shorter than MIN_QUERY is refused outright, so "a" cannot walk
 *     the whole member list;
 *   - at most MAX_RESULTS rows come back, so it cannot be paged through in
 *     bulk either;
 *   - each row carries a name, a campus and a *masked* phone and nothing else.
 *     Email, date of birth, hostel and level never leave the server.
 *
 * Those three limits cost a real attendee nothing — they are already typing
 * their own name and looking for one row.
 */
const MIN_QUERY = 3;
const MAX_RESULTS = 8;

/** "0553766929" -> "0•• ••• 6929": enough to recognise yourself, useless to a stranger. */
export function maskPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `${digits.slice(0, 1)}•• ••• ${digits.slice(-4)}`;
}

export interface SelfCheckinMatch {
  /** Opaque to the client; which collection it came from is our business. */
  key: string;
  name: string;
  campus: string;
  maskedPhone: string;
  alreadyCheckedIn: boolean;
}

interface Candidate {
  memberId?: string;
  registrationId?: string;
  name: string;
  campus: string;
  phone: string;
  phoneKey: string;
  alreadyCheckedIn: boolean;
}

/**
 * Collapses the same human appearing in both collections into one row.
 *
 * phoneKey is the join: both collections already store the identical canonical
 * `233…` form. People without one (50-odd member records) can't be matched
 * that way, so they stay separate rather than being merged on name — two
 * different students really do share a name here, and merging them would check
 * in the wrong person.
 *
 * A registration wins the merge because it is event-specific and carries the
 * check-in state; the member record only contributes a campus.
 */
function mergeCandidates(members: Candidate[], registrations: Candidate[]): Candidate[] {
  const byPhone = new Map<string, Candidate>();
  const unmatched: Candidate[] = [];

  for (const registration of registrations) {
    if (registration.phoneKey) byPhone.set(registration.phoneKey, registration);
    else unmatched.push(registration);
  }

  for (const member of members) {
    const existing = member.phoneKey ? byPhone.get(member.phoneKey) : undefined;
    if (existing) {
      // Same person: keep the registration, borrow the campus the member
      // record knows and the registration doesn't.
      existing.campus = existing.campus || member.campus;
      existing.memberId = member.memberId;
      continue;
    }
    if (member.phoneKey) byPhone.set(member.phoneKey, member);
    else unmatched.push(member);
  }

  return [...byPhone.values(), ...unmatched];
}

export const searchSelfCheckin = onCall<{ eventId: string; query: string }>(async (request) => {
  const { eventId, query } = request.data ?? { eventId: "", query: "" };
  if (!eventId || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "eventId and query are required");
  }

  const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q.length < MIN_QUERY) {
    return { matches: [], needsMoreTyping: true };
  }

  const [registrationSnap, memberSnap] = await Promise.all([
    db
      .collection("registrations")
      .where("eventId", "==", eventId)
      .where("searchPrefixes", "array-contains", q)
      .limit(20)
      .get(),
    db
      .collection("member_db")
      .where("searchPrefixes", "array-contains", q)
      .limit(20)
      .get(),
  ]);

  const registrations: Candidate[] = registrationSnap.docs.map((doc) => {
    const data = doc.data() as RegistrationDoc;
    return {
      registrationId: doc.id,
      name: data.name,
      campus: data.school ?? "",
      phone: data.phone ?? "",
      phoneKey: data.phoneKey ?? "",
      alreadyCheckedIn: data.status === "checked_in",
    };
  });

  const members: Candidate[] = memberSnap.docs.map((doc) => {
    const data = doc.data() as {
      fullName?: string;
      campus?: string;
      phone?: string;
      phoneKey?: string;
    };
    return {
      memberId: doc.id,
      name: data.fullName ?? "",
      campus: data.campus ?? "",
      phone: data.phone ?? "",
      phoneKey: data.phoneKey ?? "",
      alreadyCheckedIn: false,
    };
  });

  const merged = mergeCandidates(members, registrations)
    .filter((candidate) => candidate.name)
    // People not yet in the room first: the whole point of the page.
    .sort((a, b) => Number(a.alreadyCheckedIn) - Number(b.alreadyCheckedIn))
    .slice(0, MAX_RESULTS);

  const matches: SelfCheckinMatch[] = merged.map((candidate) => ({
    key: candidate.registrationId
      ? `r:${candidate.registrationId}`
      : `m:${candidate.memberId}`,
    name: candidate.name,
    campus: candidate.campus,
    maskedPhone: maskPhone(candidate.phone),
    alreadyCheckedIn: candidate.alreadyCheckedIn,
  }));

  return { matches, needsMoreTyping: false };
});

/**
 * Marks one person present.
 *
 * A member who never registered gets a registration written for them here
 * rather than being recorded somewhere separate. The document id is derived
 * from eventId + phoneKey exactly as it is at registration, so the row they
 * land on is the same one they would already have had — which keeps the
 * dashboard, the room count and the export working off a single collection
 * instead of two that can disagree.
 */
export const selfCheckIn = onCall<{ eventId: string; key: string }>(async (request) => {
  const { eventId, key } = request.data ?? { eventId: "", key: "" };
  if (!eventId || !key) {
    throw new HttpsError("invalid-argument", "eventId and key are required");
  }

  const eventSnap = await db.collection("events").doc(eventId).get();
  if (!eventSnap.exists) {
    throw new HttpsError("not-found", "Event not found");
  }
  const event = eventSnap.data() as EventDoc;
  if (event.status !== "published" || !isEventCurrent(event.startsAt)) {
    throw new HttpsError("failed-precondition", "Check-in for this event is closed");
  }

  const [kind, id] = [key.slice(0, 1), key.slice(2)];
  const now = Timestamp.now();

  if (kind === "r") {
    const docRef = db.collection("registrations").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Registration not found");

    const registration = snap.data() as RegistrationDoc;
    if (registration.eventId !== eventId) {
      throw new HttpsError("not-found", "That ticket is not for this event");
    }
    if (registration.status === "checked_in") {
      return { outcome: "already_checked_in" as const, name: registration.name };
    }

    await docRef.update({ status: "checked_in", checkedInAt: now, checkedInBy: "self" });
    return { outcome: "checked_in" as const, name: registration.name };
  }

  if (kind !== "m") {
    throw new HttpsError("invalid-argument", "Unrecognised selection");
  }

  const memberSnap = await db.collection("member_db").doc(id).get();
  if (!memberSnap.exists) throw new HttpsError("not-found", "Member not found");

  const member = memberSnap.data() as {
    fullName?: string;
    nameLower?: string;
    searchPrefixes?: string[];
    phone?: string;
    phoneKey?: string;
    whatsapp?: string;
    email?: string;
    campus?: string;
    level?: string;
  };

  const name = member.fullName ?? "";
  const phoneKey = member.phoneKey ?? "";
  // Members without a phone can't get the deterministic id, so they're keyed
  // off the member id instead — still stable, so a double tap can't create two.
  const docRef = db
    .collection("registrations")
    .doc(phoneKey ? registrationDocId(eventId, phoneKey) : `${eventId}_m_${id}`);

  const existing = await docRef.get();
  if (existing.exists) {
    const registration = existing.data() as RegistrationDoc;
    if (registration.status === "checked_in") {
      return { outcome: "already_checked_in" as const, name: registration.name };
    }
    await docRef.update({ status: "checked_in", checkedInAt: now, checkedInBy: "self" });
    return { outcome: "checked_in" as const, name: registration.name };
  }

  const registration: RegistrationDoc = {
    eventId,
    name,
    nameLower: name.toLowerCase(),
    searchPrefixes:
      member.searchPrefixes?.length
        ? member.searchPrefixes
        : buildSearchPrefixes(name, buildTicketRef(docRef.id)),
    phone: member.phone ?? "",
    phoneKey,
    email: member.email ?? "",
    dob: "",
    school: member.campus ?? "",
    level: member.level ?? "",
    whatsapp: member.whatsapp || member.phone || "",
    qrValue: makeQrValue(docRef.id),
    status: "checked_in",
    registeredAt: now,
    checkedInAt: now,
    checkedInBy: "self",
    // Distinguishes "walked in and self-checked-in" from "registered in
    // advance", which otherwise look identical in the roster.
    source: "self_checkin",
    memberId: id,
  };

  await docRef.create(registration);
  logger.info("Self check-in created registration from member", {
    eventId,
    memberId: id,
    registrationId: docRef.id,
  });

  return { outcome: "checked_in" as const, name };
});
