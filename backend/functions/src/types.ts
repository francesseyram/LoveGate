import { Timestamp } from "firebase-admin/firestore";
import { buildTicketRef } from "./search";

export type EventStatus = "draft" | "published";
export type RegistrationStatus = "going" | "checked_in";

/**
 * Stands in for a staff uid on registrations that late-arrival mode checked in
 * by itself. A real uid would claim a volunteer scanned them, which nobody did.
 */
export const AUTO_CHECKIN_ACTOR = "auto:late-arrival";

export interface EventDoc {
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: Timestamp;
  location?: string;
  /** Map link for the venue, shown wherever the location is. */
  locationUrl?: string;
  status: EventStatus;
  reminderSentAt?: Timestamp | null;
  /**
   * Late-arrival mode. While true, `registerForEvent` writes new registrations
   * straight in as `checked_in` — see registration.ts. Absent on every event
   * created before the flag existed, so reads must treat undefined as off.
   */
  autoCheckIn?: boolean;
  autoCheckInSince?: Timestamp | null;
  autoCheckInSetBy?: string | null;
}

export interface RegistrationDoc {
  eventId: string;
  name: string;
  nameLower: string;
  /** Every prefix of every name token (+ ticket ref) — see search.ts. */
  searchPrefixes: string[];
  /** As the attendee typed it, for display and for calling them. */
  phone: string;
  /** Canonical form used for duplicate detection — see phone.ts. */
  phoneKey: string;
  email: string;
  /** No longer collected at registration; empty on anything registered since. */
  dob: string;
  school: string;
  level: string;
  whatsapp: string;
  /**
   * Who invited them, as they typed it. Optional at the form, and absent
   * entirely on anything registered before the field existed, so every read
   * has to tolerate undefined rather than assume an empty string.
   */
  invitedBy?: string;
  qrValue: string;
  status: RegistrationStatus;
  registeredAt: Timestamp;
  checkedInAt: Timestamp | null;
  /**
   * Which staff account performed the check-in, or `AUTO_CHECKIN_ACTOR` when
   * nobody did and late-arrival mode checked them in at registration.
   */
  checkedInBy: string | null;
  /**
   * When a staff member last reverted this person's check-in.
   *
   * Exists so a queued offline scan cannot resurrect a revert. Devices flush
   * their queue whenever they reconnect, and a scan recorded before the revert
   * can reach the server after it — from another phone entirely, which no
   * amount of client-side coordination can prevent. `syncCheckIns` compares
   * against this and drops anything the revert already answered for.
   */
  revertedAt?: Timestamp | null;
  /** Set only after a confirmed reminder send — the per-person idempotency key. */
  remindedAt?: Timestamp | null;
}

/** Wire-format sent to the client: Firestore Timestamps become ISO strings. */
export interface EventDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: string;
  location?: string;
  locationUrl?: string;
  status: EventStatus;
}

export interface RegistrationDTO {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  school: string;
  level: string;
  whatsapp: string;
  invitedBy: string;
  qrValue: string;
  status: RegistrationStatus;
  registeredAt: string;
  checkedInAt: string | null;
}

/**
 * What staff tooling is allowed to see. The check-in desk needs to identify a
 * person and act on them — it does not need their date of birth, phone number,
 * school, or ticket QR payload, so none of that crosses the wire. Keeps a
 * compromised volunteer login from being a dump of the attendee database.
 */
export interface RegistrationSummaryDTO {
  id: string;
  eventId: string;
  name: string;
  email: string;
  ticketRef: string;
  status: RegistrationStatus;
  checkedInAt: string | null;
}

export function registrationToSummary(id: string, doc: RegistrationDoc): RegistrationSummaryDTO {
  return {
    id,
    eventId: doc.eventId,
    name: doc.name,
    email: doc.email,
    ticketRef: buildTicketRef(id),
    status: doc.status,
    checkedInAt: doc.checkedInAt ? doc.checkedInAt.toDate().toISOString() : null,
  };
}

export function eventToDTO(id: string, doc: EventDoc): EventDTO {
  return {
    id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    coverPhotoUrl: doc.coverPhotoUrl,
    startsAt: doc.startsAt.toDate().toISOString(),
    location: doc.location,
    locationUrl: doc.locationUrl,
    status: doc.status,
  };
}

export function registrationToDTO(id: string, doc: RegistrationDoc): RegistrationDTO {
  return {
    id,
    eventId: doc.eventId,
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    dob: doc.dob,
    school: doc.school,
    level: doc.level,
    whatsapp: doc.whatsapp,
    invitedBy: doc.invitedBy ?? "",
    qrValue: doc.qrValue,
    status: doc.status,
    registeredAt: doc.registeredAt.toDate().toISOString(),
    checkedInAt: doc.checkedInAt ? doc.checkedInAt.toDate().toISOString() : null,
  };
}
