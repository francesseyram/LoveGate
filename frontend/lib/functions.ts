import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions } from "./firebaseClient";
import type {
  Dashboard,
  EventSettings,
  EventSummary,
  RegistrationSummary,
  RegisterForEventResult,
  CheckInResult,
  UndoCheckInResult,
} from "./types";
import type { RosterEntry } from "./offlineStore";

/**
 * Codes whose own message is a bare machine string, mapped to something a
 * volunteer holding a phone can act on.
 *
 * Everything else keeps the server's wording on purpose — `registerForEvent`
 * and the check-in handlers write real sentences for the person reading them
 * ("a valid phone number is required"), and those must survive untouched.
 *
 * `internal` is here because a callable that has not been deployed 404s, and
 * the SDK reports that as `internal` with the message "internal" — identical
 * to a genuine crash and useless to whoever is standing at the door.
 */
const OPAQUE_ERRORS: Record<string, string> = {
  "functions/internal": "The server couldn't handle that. It may need updating — tell a lead.",
  "functions/not-found": "The server couldn't handle that. It may need updating — tell a lead.",
  "functions/unavailable": "Can't reach the server. Check your connection and try again.",
  "functions/deadline-exceeded": "The server took too long to answer. Try again.",
  "functions/cancelled": "That request stopped before it finished. Try again.",
};

export function getCallableErrorMessage(err: unknown): string {
  if (err instanceof FunctionsError) {
    return OPAQUE_ERRORS[err.code] ?? err.message;
  }
  return "Something went wrong. Please try again.";
}

export async function getPublishedEvents(): Promise<EventSummary[]> {
  const call = httpsCallable<void, { events: EventSummary[] }>(functions, "getPublishedEvents");
  const { data } = await call();
  return data.events;
}

export async function getEvent(slug: string): Promise<EventSummary> {
  const call = httpsCallable<{ slug: string }, { event: EventSummary }>(functions, "getEvent");
  const { data } = await call({ slug });
  return data.event;
}

export async function registerForEvent(input: {
  eventId: string;
  name: string;
  phone: string;
  email: string;
  school: string;
  level: string;
  whatsapp?: string;
  invitedBy?: string;
}): Promise<RegisterForEventResult> {
  const call = httpsCallable<typeof input, RegisterForEventResult>(functions, "registerForEvent");
  const { data } = await call(input);
  return data;
}

export async function searchRegistrations(input: {
  eventId: string;
  query: string;
}): Promise<RegistrationSummary[]> {
  const call = httpsCallable<typeof input, { registrations: RegistrationSummary[] }>(
    functions,
    "searchRegistrations"
  );
  const { data } = await call(input);
  return data.registrations;
}

export async function checkInByQr(input: {
  eventId: string;
  qrValue: string;
}): Promise<CheckInResult> {
  const call = httpsCallable<typeof input, CheckInResult>(functions, "checkInByQr");
  const { data } = await call(input);
  return data;
}

export async function checkInByRegistrationId(input: {
  eventId: string;
  registrationId: string;
}): Promise<CheckInResult> {
  const call = httpsCallable<typeof input, CheckInResult>(functions, "checkInByRegistrationId");
  const { data } = await call(input);
  return data;
}

export async function undoCheckIn(input: {
  eventId: string;
  registrationId: string;
}): Promise<UndoCheckInResult> {
  const call = httpsCallable<typeof input, UndoCheckInResult>(functions, "undoCheckIn");
  const { data } = await call(input);
  return data;
}

export async function getEventSettings(input: { eventId: string }): Promise<EventSettings> {
  const call = httpsCallable<typeof input, EventSettings>(functions, "getEventSettings");
  const { data } = await call(input);
  return data;
}

export async function setEventAutoCheckIn(input: {
  eventId: string;
  enabled: boolean;
}): Promise<EventSettings> {
  const call = httpsCallable<typeof input, EventSettings>(functions, "setEventAutoCheckIn");
  const { data } = await call(input);
  return data;
}

export async function getEventRoster(input: {
  eventId: string;
}): Promise<{ roster: RosterEntry[]; fetchedAt: string }> {
  const call = httpsCallable<typeof input, { roster: RosterEntry[]; fetchedAt: string }>(
    functions,
    "getEventRoster"
  );
  const { data } = await call(input);
  return data;
}

export async function getEventStats(input: {
  eventId: string;
}): Promise<{ registered: number; checkedIn: number; yetToArrive: number }> {
  const call = httpsCallable<
    typeof input,
    { registered: number; checkedIn: number; yetToArrive: number }
  >(functions, "getEventStats");
  const { data } = await call(input);
  return data;
}

export async function syncCheckIns(input: {
  eventId: string;
  checkIns: Array<{ registrationId: string; checkedInAt: string }>;
}): Promise<{
  applied: string[];
  alreadyCheckedIn: string[];
  notFound: string[];
  /** Dropped because a staff member had already reverted that check-in. Absent
   *  from a backend deployed before the revert guard existed. */
  reverted?: string[];
}> {
  const call = httpsCallable<
    typeof input,
    { applied: string[]; alreadyCheckedIn: string[]; notFound: string[]; reverted?: string[] }
  >(functions, "syncCheckIns");
  const { data } = await call(input);
  return data;
}

export async function getEventDashboard(input: { eventId: string }): Promise<Dashboard> {
  const call = httpsCallable<typeof input, Dashboard>(functions, "getEventDashboard");
  const { data } = await call(input);
  return data;
}

export async function deleteRegistration(input: {
  eventId: string;
  registrationId: string;
}): Promise<{ deleted: boolean; registrationId: string }> {
  const call = httpsCallable<typeof input, { deleted: boolean; registrationId: string }>(
    functions,
    "deleteRegistration"
  );
  const { data } = await call(input);
  return data;
}

export interface ReminderResult {
  sent: number;
  skipped: number;
  failed: number;
}

export async function getReminderRecipientCount(input: {
  eventId: string;
}): Promise<{ total: number; alreadyReminded: number; willReceive: number }> {
  const call = httpsCallable<
    typeof input,
    { total: number; alreadyReminded: number; willReceive: number }
  >(functions, "getReminderRecipientCount");
  const { data } = await call(input);
  return data;
}

export async function triggerManualReminder(input: {
  eventId: string;
  resend?: boolean;
}): Promise<ReminderResult> {
  const call = httpsCallable<typeof input, ReminderResult>(functions, "triggerManualReminder");
  const { data } = await call(input);
  return data;
}
