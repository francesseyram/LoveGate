import { Timestamp } from "firebase-admin/firestore";

/**
 * Everything that lets an event be described by its Firestore doc alone, so a
 * new event is a new doc rather than a new page in the codebase.
 *
 * Hand-mirrored in frontend/lib/eventShape.ts — change one, change the other.
 */

/**
 * One gathering inside an event. An event with several (Fire Night on Friday,
 * the Sunday service after it) is still one registration and one QR ticket,
 * valid at every session.
 */
export interface SessionDoc {
  name: string;
  startsAt: Timestamp;
  location?: string;
  locationUrl?: string;
}

/** Which Love Inc chapter is hosting. Sets the logo and the email sign-off. */
export type Chapter = "global" | "knust";

export const DEFAULT_CHAPTER: Chapter = "global";

export interface ChapterInfo {
  /** As it appears in the email header and sign-off. */
  name: string;
  /** Where the chapter is, for the email footer. */
  place: string;
}

export const CHAPTERS: Record<Chapter, ChapterInfo> = {
  global: { name: "Love Inc Global", place: "University of Ghana, Legon" },
  knust: { name: "Love Inc KNUST", place: "KNUST, Kumasi" },
};

export function chapterOf(value: unknown): Chapter {
  return typeof value === "string" && value in CHAPTERS ? (value as Chapter) : DEFAULT_CHAPTER;
}

/**
 * Visual preset for the shared event page. Only the frontend draws these; the
 * backend just carries the value through, unknown values included, so a new
 * preset can ship without a functions deploy.
 */
export type EventTheme = string;

/** The fields of an event doc these helpers need. */
export interface EventTiming {
  name: string;
  startsAt: Timestamp;
  location?: string;
  locationUrl?: string;
  sessions?: SessionDoc[];
}

/**
 * The event's sessions, soonest first. An event without a `sessions` list —
 * every event created before it existed — is a single session built from its
 * own name, start and venue, so callers never have to special-case it.
 */
export function eventSessions(event: EventTiming): SessionDoc[] {
  if (event.sessions && event.sessions.length > 0) {
    return [...event.sessions].sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());
  }
  return [
    {
      name: event.name,
      startsAt: event.startsAt,
      location: event.location,
      locationUrl: event.locationUrl,
    },
  ];
}

/**
 * When the last session starts. This, not `startsAt`, is what decides whether
 * an event is still open — otherwise a Friday-and-Sunday event would close
 * registration on Saturday morning and drop off the homepage before Sunday.
 */
export function eventEndsAt(event: EventTiming): Timestamp {
  const sessions = eventSessions(event);
  return sessions.reduce(
    (latest, session) => (session.startsAt.toMillis() > latest.toMillis() ? session.startsAt : latest),
    event.startsAt
  );
}
