import { Timestamp } from "firebase-admin/firestore";

export type EventStatus = "draft" | "published";
export type RegistrationStatus = "going" | "checked_in";

export interface EventDoc {
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: Timestamp;
  location?: string;
  status: EventStatus;
  reminderSentAt?: Timestamp | null;
}

export interface RegistrationDoc {
  eventId: string;
  name: string;
  nameLower: string;
  phone: string;
  email: string;
  dob: string;
  school: string;
  level: string;
  whatsapp: string;
  qrValue: string;
  status: RegistrationStatus;
  registeredAt: Timestamp;
  checkedInAt: Timestamp | null;
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

export function eventToDTO(id: string, doc: EventDoc): EventDTO {
  return {
    id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    coverPhotoUrl: doc.coverPhotoUrl,
    startsAt: doc.startsAt.toDate().toISOString(),
    location: doc.location,
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
