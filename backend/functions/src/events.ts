import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";
import { eventCutoff } from "./eventWindow";
import { EventDoc, eventToDTO } from "./types";

/**
 * Events still worth showing: published, and not yet past the grace window.
 * Without the date filter every event ever run stays on the homepage tagged
 * "Registration open" and piles up in the staff event picker forever.
 */
export const getPublishedEvents = onCall(async () => {
  const snap = await db
    .collection("events")
    .where("status", "==", "published")
    .where("startsAt", ">=", eventCutoff())
    .orderBy("startsAt", "asc")
    .get();

  return {
    events: snap.docs.map((doc) => eventToDTO(doc.id, doc.data() as EventDoc)),
  };
});

/**
 * Fetched by slug for an event's own page. Deliberately NOT date-filtered —
 * a direct link to a finished event should still render (with registration
 * closed) rather than 404.
 */
export const getEvent = onCall<{ slug: string }>(async (request) => {
  const slug = request.data?.slug;
  if (!slug || typeof slug !== "string") {
    throw new HttpsError("invalid-argument", "slug is required");
  }

  const snap = await db.collection("events").where("slug", "==", slug).limit(1).get();
  if (snap.empty) {
    throw new HttpsError("not-found", "No event with that slug");
  }

  const doc = snap.docs[0];
  return { event: eventToDTO(doc.id, doc.data() as EventDoc) };
});
