import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";
import { eventCutoff } from "./eventWindow";
import { EventDoc, eventToDTO } from "./types";

/** Nobody scrolls further back than this, and it bounds an unbounded read. */
const PAST_EVENTS_LIMIT = 24;

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

/**
 * The archive: published events that are far enough past to have finished.
 *
 * The mirror image of `getPublishedEvents` across the same cutoff, so an event
 * is in exactly one of the two lists at any moment and can never be advertised
 * as open and filed as finished at the same time. Newest first — the thing
 * someone came back to look at is almost always the one that just happened.
 *
 * Unauthenticated, like the rest of this file: it is the same information the
 * event's own page has always shown to anyone with the link.
 *
 * Needs its own events(status ASC, startsAt DESC) composite index — Firestore
 * does NOT reverse-scan the ascending twin that `getPublishedEvents` uses, and
 * without it every call fails with FAILED_PRECONDITION. The Firestore emulator
 * does not enforce index requirements, so this only ever shows up in a
 * deployed environment: don't take a green local run as proof.
 */
export const getPastEvents = onCall(async () => {
  const snap = await db
    .collection("events")
    .where("status", "==", "published")
    .where("startsAt", "<", eventCutoff())
    .orderBy("startsAt", "desc")
    .limit(PAST_EVENTS_LIMIT)
    .get();

  return {
    events: snap.docs.map((doc) => eventToDTO(doc.id, doc.data() as EventDoc)),
  };
});

/**
 * Every published event, past ones included, for the staff event picker.
 *
 * The tools used to run off `getPublishedEvents`, which retires an event 12
 * hours after it starts — so the morning after a gathering its dashboard
 * became unreachable, taking the turnout numbers with it exactly when someone
 * wanted to look at them. Staff need the whole history; the public list stays
 * as it is.
 *
 * Staff-only because it is the one listing that ignores the date filter the
 * public pages rely on to stop finished events advertising themselves.
 *
 * Shares the events(status ASC, startsAt DESC) index with `getPastEvents`.
 */
export const getStaffEvents = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Staff sign-in required");
  }

  const snap = await db
    .collection("events")
    .where("status", "==", "published")
    .orderBy("startsAt", "desc")
    .get();

  return {
    events: snap.docs.map((doc) => eventToDTO(doc.id, doc.data() as EventDoc)),
  };
});
