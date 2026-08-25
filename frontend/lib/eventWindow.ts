import type { EventSummary } from "@/lib/types";

/**
 * Mirrors backend/functions/src/eventWindow.ts. Kept in step by hand, like the
 * DTO types — if the backend's grace window moves and this doesn't, the staff
 * picker will file an event as finished while `getPublishedEvents` still
 * offers it to the public, or the other way round.
 *
 * Note this is NOT the 6-hour figure the homepage uses to decide whether an
 * event is "still on". That one is about a room that's probably still full;
 * this one is about the server's own definition of which list an event belongs
 * in, and the two are allowed to differ.
 */
export const EVENT_GRACE_HOURS = 12;

export function isEventPast(startsAt: string, now: number = Date.now()): boolean {
  return new Date(startsAt).getTime() < now - EVENT_GRACE_HOURS * 60 * 60 * 1000;
}

export interface SplitEvents {
  current: EventSummary[];
  past: EventSummary[];
}

/** Current events soonest-first, past ones newest-first. */
export function splitByWindow(events: EventSummary[], now: number = Date.now()): SplitEvents {
  const current: EventSummary[] = [];
  const past: EventSummary[] = [];
  for (const event of events) {
    (isEventPast(event.startsAt, now) ? past : current).push(event);
  }
  const at = (event: EventSummary) => new Date(event.startsAt).getTime();
  current.sort((a, b) => at(a) - at(b));
  past.sort((a, b) => at(b) - at(a));
  return { current, past };
}

/**
 * Order for the staff event picker: whatever is running or coming up first,
 * then the archive behind it. `getStaffEvents` returns newest-first, which puts
 * last week's finished event above tomorrow's — so the picker would open on the
 * wrong one every time.
 *
 * Note the result is two runs pointing in opposite directions: the current
 * events climb into the future, then the finished ones fall away into the past.
 * That is right for a menu you read top to bottom, but it means the list has no
 * single ordering to walk — see `mostRecentlyStarted`.
 */
export function sortStaffEvents(events: EventSummary[], now: number = Date.now()): EventSummary[] {
  const { current, past } = splitByWindow(events, now);
  return [...current, ...past];
}

/**
 * The event that began most recently: the latest `startsAt` at or before now,
 * or undefined if nothing has run yet.
 *
 * Worked out from the dates rather than from a position in `sortStaffEvents`'
 * output, because that list turns around in the middle. Taking the last
 * matching entry from the end of it finds the *oldest* finished event, not the
 * newest — which is only ever visible once there is more than one event in the
 * archive, so it survives exactly as long as it takes to run a second
 * gathering.
 */
export function mostRecentlyStarted(
  events: EventSummary[],
  now: number = Date.now()
): EventSummary | undefined {
  return events.reduce<EventSummary | undefined>((latest, event) => {
    const startsAt = new Date(event.startsAt).getTime();
    if (startsAt > now) return latest;
    return !latest || startsAt > new Date(latest.startsAt).getTime() ? event : latest;
  }, undefined);
}
