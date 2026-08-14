import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";
import { EventDoc, eventToDTO } from "./types";

export const getPublishedEvents = onCall(async () => {
  const snap = await db.collection("events").where("status", "==", "published").get();
  return {
    events: snap.docs.map((doc) => eventToDTO(doc.id, doc.data() as EventDoc)),
  };
});

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
