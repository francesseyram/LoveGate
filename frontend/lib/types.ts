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
  status: EventStatus;
}

export interface Registration {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email: string;
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

export interface CheckInResult {
  outcome: "checked_in" | "already_checked_in";
  registration: Registration;
}
