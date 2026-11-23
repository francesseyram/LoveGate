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
  /**
   * The gatherings one registration covers — at least one. Optional on the
   * type only because a backend deployed before sessions existed doesn't send
   * it; read it through `eventSessions` in lib/eventShape.ts, never directly.
   */
  sessions?: EventSession[];
  /** When the last session starts. Same caveat: read through `eventEndsAt`. */
  endsAt?: string;
  chapter?: Chapter;
  /** Preset for the shared event page — see events/themes.ts. */
  theme?: string;
  /** "#rrggbb" highlight for the event page and staff tools; absent = house gold. See lib/accent.ts. */
  accent?: string;
  tagline?: string;
  /**
   * Slug of a sister event this one's form offers to register for too, with
   * one shared ticket (Fire Night ↔ Sunday Service).
   */
  companionSlug?: string;
  /** Google Maps search for the venue (ideally a plus code); drives the page's map. */
  mapQuery?: string;
  /** Pre-filled into the registration form's School field, still editable. */
  schoolDefault?: string;
}

export interface EventSession {
  name: string;
  startsAt: string;
  location?: string;
  locationUrl?: string;
}

export type Chapter = "global" | "knust";

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
  /** Present when the companion event was ticked on the form. */
  companion?: {
    eventId: string;
    alreadyRegistered: boolean;
    /** True when the one ticket above also gets them into the companion event. */
    sharesTicket: boolean;
  };
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

export interface UndoCheckInResult {
  /** `not_checked_in` when they were already back to "not arrived" — not an error. */
  outcome: "reverted" | "not_checked_in";
  registration: RegistrationSummary;
}

/**
 * Per-event operational switches. Mirrors backend/functions/src/eventSettings.ts.
 * Staff-only, and deliberately not part of `EventSummary` — that one is public.
 */
export interface EventSettings {
  eventId: string;
  /** Late-arrival mode: new registrations land already checked in. */
  autoCheckIn: boolean;
  autoCheckInSince: string | null;
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

/** One row on the public self check-in page. Deliberately narrow — see backend/src/selfCheckin.ts. */
export interface SelfCheckinMatch {
  key: string;
  name: string;
  campus: string;
  maskedPhone: string;
  alreadyCheckedIn: boolean;
}

/** What the staff event editor sends to `saveEvent`. Mirrors backend `EventInput`. */
export interface EventInput {
  name: string;
  slug: string;
  description: string;
  tagline: string;
  coverPhotoUrl: string;
  chapter: Chapter;
  theme: string;
  accent: string;
  status: EventStatus;
  companionSlug: string;
  mapQuery: string;
  schoolDefault: string;
  /** One for an ordinary event; with several, each needs its own name. */
  sessions: Array<{ name: string; startsAt: string; location: string; locationUrl: string }>;
}
