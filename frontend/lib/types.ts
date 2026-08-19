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
  /** No longer collected at registration; empty on anything registered since. */
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

/* -------------------------------------------------------------------------
   Admin dashboard
   Mirrors backend/functions/src/dashboard.ts + analytics.ts. The buckets are
   computed server-side so drawing a bar never requires shipping the whole
   attendee record to the browser.
   ---------------------------------------------------------------------- */

export interface DayBucket {
  /** yyyy-mm-dd in Accra time. */
  date: string;
  count: number;
}

export interface HourBucket {
  /** Hour of day in Accra time, 0–23. */
  hour: number;
  count: number;
}

export interface CategoryBucket {
  label: string;
  count: number;
}

/** A roster row for the dashboard table: the staff summary plus signup time. */
export interface DashboardAttendee extends RegistrationSummary {
  registeredAt: string;
  invitedBy: string;
  /** Dashboard-only — deliberately absent from the check-in desk's payload. */
  phone: string;
}

export interface Dashboard {
  totals: {
    registered: number;
    checkedIn: number;
    yetToArrive: number;
    registeredToday: number;
    checkedInToday: number;
  };
  registrationsByDay: DayBucket[];
  checkInsByHour: HourBucket[];
  schools: CategoryBucket[];
  levels: CategoryBucket[];
  inviters: CategoryBucket[];
  attendees: DashboardAttendee[];
  generatedAt: string;
}
