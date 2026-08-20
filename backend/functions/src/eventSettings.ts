import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { requireStaff } from "./checkin";
import { EventDoc } from "./types";

/**
 * Per-event operational switches — things staff flip during an event rather
 * than set when creating it.
 *
 * Kept out of EventDTO on purpose. That payload is public (getEvent and
 * getPublishedEvents are unauthenticated), and how the door is being run is
 * nobody's business but the door's.
 */
export interface EventSettingsDTO {
  eventId: string;
  /** Late-arrival mode — see registration.ts. */
  autoCheckIn: boolean;
  /** When it was last switched on, so the UI can say how long it has been running. */
  autoCheckInSince: string | null;
}

function toSettings(eventId: string, event: EventDoc): EventSettingsDTO {
  const autoCheckIn = event.autoCheckIn === true;
  return {
    eventId,
    autoCheckIn,
    // Meaningless once the switch is off, and showing a stale "since" next to
    // an off switch reads as if it were still running.
    autoCheckInSince:
      autoCheckIn && event.autoCheckInSince
        ? event.autoCheckInSince.toDate().toISOString()
        : null,
  };
}

async function loadEvent(eventId: string) {
  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required");
  }
  const docRef = db.collection("events").doc(eventId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Event not found");
  }
  return { docRef, event: snap.data() as EventDoc };
}

export const getEventSettings = onCall<{ eventId: string }>(async (request) => {
  requireStaff(request);
  const eventId = request.data?.eventId ?? "";
  const { event } = await loadEvent(eventId);
  return toSettings(eventId, event);
});

/**
 * Turns late-arrival mode on or off for one event.
 *
 * `autoCheckInSince` is rewritten on every switch-on rather than kept from the
 * first, so the dashboard reports the current run and not the first time
 * anyone ever tried the switch.
 */
export const setEventAutoCheckIn = onCall<{ eventId: string; enabled: boolean }>(
  async (request) => {
    const staffUid = requireStaff(request);
    const { eventId, enabled } = request.data ?? ({} as { eventId: string; enabled: boolean });
    if (typeof enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "enabled must be a boolean");
    }

    const { docRef, event } = await loadEvent(eventId ?? "");
    const autoCheckInSince = enabled ? Timestamp.now() : null;

    await docRef.update({
      autoCheckIn: enabled,
      autoCheckInSince,
      autoCheckInSetBy: enabled ? staffUid : null,
    });

    // Every registration made while this is on is a check-in nobody witnessed,
    // so who opened that window is worth a log line.
    logger.info("Set late-arrival auto check-in", {
      eventId,
      eventName: event.name,
      enabled,
      setBy: staffUid,
    });

    return toSettings(eventId, { ...event, autoCheckIn: enabled, autoCheckInSince });
  }
);
