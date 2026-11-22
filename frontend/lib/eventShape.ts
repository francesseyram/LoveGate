import type { Chapter, EventSession, EventSummary } from "@/lib/types";

/**
 * Mirrors backend/functions/src/eventShape.ts — the pieces of an event that
 * let it be drawn from its Firestore doc alone, with no per-event code.
 */

/**
 * The event's sessions, soonest first. Falls back to a single session built
 * from the event's own fields, both for single-session events and for a
 * backend deployed before `sessions` existed.
 */
export function eventSessions(event: EventSummary): EventSession[] {
  if (event.sessions && event.sessions.length > 0) {
    return [...event.sessions].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
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

/** When the last session starts: what decides whether the event is still open. */
export function eventEndsAt(event: EventSummary): string {
  if (event.endsAt) return event.endsAt;
  const sessions = eventSessions(event);
  return sessions[sessions.length - 1].startsAt;
}

export interface ChapterInfo {
  name: string;
  /** White-on-transparent mark, drawn over dark heroes. */
  logo: string;
  logoAlt: string;
}

export const CHAPTERS: Record<Chapter, ChapterInfo> = {
  global: {
    name: "Love Inc Global",
    logo: "/assets/love-inc-globe-white.png",
    logoAlt: "Love Inc Global · Est. 2022",
  },
  knust: {
    name: "Love Inc KNUST",
    logo: "/assets/love-inc-knust-white.png",
    logoAlt: "Love Inc KNUST · Est. 2025",
  },
};

export function chapterOf(event: EventSummary): ChapterInfo {
  return CHAPTERS[event.chapter && event.chapter in CHAPTERS ? event.chapter : "global"];
}

const ACCRA = "Africa/Accra";

function fmt(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: ACCRA, ...options });
}

/** Event times are always shown in Accra time, wherever the visitor is. */
export const weekdayOf = (iso: string) => fmt(iso, { weekday: "long" });
export const shortWeekdayOf = (iso: string) => fmt(iso, { weekday: "short" });
export const dayOf = (iso: string) => fmt(iso, { day: "numeric" });
export const monthOf = (iso: string) => fmt(iso, { month: "long" });
/** "7:30 PM", "11 AM". */
export const timeOf = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString("en-US", { timeZone: ACCRA, hour: "numeric", minute: "2-digit" })
    .replace(":00", "");

/** "Night" from 6 PM to 5 AM — picks which half of the session ticket a session is drawn in. */
export function isNightSession(session: EventSession): boolean {
  const hour = Number(
    new Date(session.startsAt).toLocaleString("en-GB", { timeZone: ACCRA, hour: "numeric", hour12: false })
  );
  return hour >= 18 || hour < 5;
}
