import { Timestamp } from "firebase-admin/firestore";
import { buildTicketRef } from "./search";

export type EventStatus = "draft" | "published";
export type RegistrationStatus = "going" | "checked_in";

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
  qrValue: string;
  status: RegistrationStatus;
  registeredAt: Timestamp;
  checkedInAt: Timestamp | null;
  /** Which staff account performed the check-in. */
  checkedInBy: string | null;
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
    qrValue: doc.qrValue,
    status: doc.status,
    registeredAt: doc.registeredAt.toDate().toISOString(),
    checkedInAt: doc.checkedInAt ? doc.checkedInAt.toDate().toISOString() : null,
  };
}
