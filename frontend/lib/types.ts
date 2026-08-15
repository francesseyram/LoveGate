export type EventStatus = "draft" | "published";
export type RegistrationStatus = "going" | "checked_in";

export interface EventSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: string;
  location?: string;
  /** Map link for the venue, shown wherever the location is. */
  locationUrl?: string;
  status: EventStatus;
}

export interface Registration {
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

export interface RegisterForEventResult {
  alreadyRegistered: boolean;
  registration: Registration;
  qrImage: string;
}

/**
 * What staff tooling receives. Intentionally narrower than `Registration` —
 * the check-in desk never sees DOB, phone, school or the QR payload.
 */
export interface RegistrationSummary {
  id: string;
  eventId: string;
  name: string;
  email: string;
  ticketRef: string;
  status: RegistrationStatus;
  checkedInAt: string | null;
}

export interface CheckInResult {
  outcome: "checked_in" | "already_checked_in";
  registration: RegistrationSummary;
}
