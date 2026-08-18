import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions } from "./firebaseClient";
import type {
  EventSummary,
  RegistrationSummary,
  RegisterForEventResult,
  CheckInResult,
} from "./types";
import type { RosterEntry } from "./offlineStore";

export function getCallableErrorMessage(err: unknown): string {
  if (err instanceof FunctionsError) {
    return err.message;
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
}): Promise<{ applied: string[]; alreadyCheckedIn: string[]; notFound: string[] }> {
  const call = httpsCallable<
    typeof input,
    { applied: string[]; alreadyCheckedIn: string[]; notFound: string[] }
  >(functions, "syncCheckIns");
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
