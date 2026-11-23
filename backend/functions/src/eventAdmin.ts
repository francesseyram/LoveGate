import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { requireStaff } from "./checkin";
import { parseEventInput } from "./eventInput";
import type { EventInput } from "./eventInput";
import { EventDoc, eventToDTO } from "./types";

/**
 * The staff event editor at /admin/events: creating events and changing how
 * they look, which used to take a seed script run from a laptop.
 *
 * There is deliberately no delete. An event with registrations is a record of
 * who came, and a draft that's no longer wanted can simply stay a draft.
 */

/**
 * Every event, drafts included, newest first: the editor's list.
 * `getStaffEvents` stays published-only because the door and dashboard pickers
 * shouldn't offer an event nobody can register for yet.
 *
 * Ordering on one field needs no composite index.
 */
export const getAllEvents = onCall(async (request) => {
  requireStaff(request);
  const snap = await db.collection("events").orderBy("startsAt", "desc").get();
  return { events: snap.docs.map((doc) => eventToDTO(doc.id, doc.data() as EventDoc)) };
});

/** Creates an event when `id` is absent, otherwise replaces the editable fields of that one. */
export const saveEvent = onCall<{ id?: string; event: EventInput }>(async (request) => {
  const staffUid = requireStaff(request);
  const { id, event } = request.data ?? {};

  const parsed = parseEventInput(event);
  if (!parsed.ok) {
    throw new HttpsError("invalid-argument", parsed.message);
  }
  const { fields, cleared } = parsed;

  const saved = await db.runTransaction(async (tx) => {
    const ref = id ? db.collection("events").doc(id) : db.collection("events").doc();
    const [existingSnap, sameSlug, companion] = await Promise.all([
      id ? tx.get(ref) : Promise.resolve(null),
      tx.get(db.collection("events").where("slug", "==", fields.slug).limit(2)),
      fields.companionSlug
        ? tx.get(db.collection("events").where("slug", "==", fields.companionSlug).limit(1))
        : Promise.resolve(null),
    ]);

    if (id && !existingSnap?.exists) {
      throw new HttpsError("not-found", "That event no longer exists.");
    }
    const existing = existingSnap?.exists ? (existingSnap.data() as EventDoc) : null;

    if (sameSlug.docs.some((doc) => doc.id !== ref.id)) {
      throw new HttpsError("already-exists", `Another event already uses the link /events/${fields.slug}.`);
    }
    // Once it's out, the link is on flyers and in people's WhatsApp chats.
    if (existing && existing.status === "published" && existing.slug !== fields.slug) {
      throw new HttpsError(
        "failed-precondition",
        "A published event's link can't change: people already have it. Set it back to draft first."
      );
    }
    if (companion && companion.empty) {
      throw new HttpsError("invalid-argument", `There's no event at /events/${fields.companionSlug}.`);
    }

    const deletes = Object.fromEntries(cleared.map((key) => [key, FieldValue.delete()]));
    const now = Timestamp.now();

    if (existing) {
      // Moving the date re-arms the day-before reminder, which would otherwise
      // never fire for the new date if it had already gone out for the old one.
      const moved = existing.startsAt.toMillis() !== fields.startsAt.toMillis();
      tx.update(ref, {
        ...fields,
        ...deletes,
        ...(moved ? { reminderSentAt: null } : {}),
        updatedAt: now,
        updatedBy: staffUid,
      });
      const merged: EventDoc = { ...existing, ...fields };
      for (const key of cleared) delete merged[key];
      return { id: ref.id, doc: merged };
    }

    tx.create(ref, {
      ...fields,
      reminderSentAt: null,
      createdAt: now,
      createdBy: staffUid,
    });
    return { id: ref.id, doc: fields as EventDoc };
  });

  logger.info(id ? "Updated event" : "Created event", {
    eventId: saved.id,
    slug: fields.slug,
    status: fields.status,
    by: staffUid,
  });

  return { event: eventToDTO(saved.id, saved.doc) };
});
