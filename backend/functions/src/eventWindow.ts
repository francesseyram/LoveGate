import { Timestamp } from "firebase-admin/firestore";

/**
 * How long after `startsAt` an event stays "current".
 *
 * Events must NOT disappear the moment they start — the check-in desk is busiest
 * after the advertised start time, and a filter of `startsAt >= now` would drop
 * the event out of the staff picker mid-queue. A generous window keeps it
 * listed all evening and retires it the next morning.
 */
export const EVENT_GRACE_HOURS = 12;

export function eventCutoff(now: Timestamp = Timestamp.now()): Timestamp {
  return Timestamp.fromMillis(now.toMillis() - EVENT_GRACE_HOURS * 60 * 60 * 1000);
}

/** False once the event is far enough past that it should stop being offered. */
export function isEventCurrent(startsAt: Timestamp, now: Timestamp = Timestamp.now()): boolean {
  return startsAt.toMillis() >= eventCutoff(now).toMillis();
}
