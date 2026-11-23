import { Timestamp } from "firebase-admin/firestore";
import { CHAPTERS } from "./eventShape";
import type { Chapter, SessionDoc } from "./eventShape";
import type { EventStatus } from "./types";

/**
 * Checks and shapes what the staff event editor sends, before `saveEvent`
 * writes it. Pure, so the rules can be tested without Firestore.
 *
 * The editor always sends a list of sessions, even for an ordinary one-night
 * event. One session is stored the way events always have been: the event's
 * own `startsAt`/`location`, no `sessions` field. Two or more are stored as
 * `sessions`, with `startsAt`/`location` copied from the first, because the
 * reminder schedule still keys off `startsAt` (see eventShape.ts).
 */

export interface SessionInput {
  name?: string;
  /** ISO 8601. Accra is UTC+0, so the editor's local time is already UTC. */
  startsAt?: string;
  location?: string;
  locationUrl?: string;
}

export interface EventInput {
  name?: string;
  slug?: string;
  description?: string;
  tagline?: string;
  coverPhotoUrl?: string;
  chapter?: string;
  theme?: string;
  accent?: string;
  status?: string;
  companionSlug?: string;
  mapQuery?: string;
  schoolDefault?: string;
  sessions?: SessionInput[];
}

/** What gets written. Optional fields left empty are listed in `cleared` instead. */
export interface EventFields {
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  chapter: Chapter;
  theme: string;
  status: EventStatus;
  startsAt: Timestamp;
  location: string;
  locationUrl: string;
  tagline?: string;
  accent?: string;
  companionSlug?: string;
  mapQuery?: string;
  schoolDefault?: string;
  sessions?: SessionDoc[];
}

export type OptionalField =
  | "tagline"
  | "accent"
  | "companionSlug"
  | "mapQuery"
  | "schoolDefault"
  | "sessions";

export type ParseResult =
  | { ok: true; fields: EventFields; cleared: OptionalField[] }
  | { ok: false; message: string };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
const THEME_PATTERN = /^[a-z0-9-]{1,30}$/;
export const MAX_SESSIONS = 6;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A link staff can paste, or a path to a file the frontend serves itself. */
function isLink(value: string): boolean {
  return value.startsWith("/") || /^https:\/\/\S+$/.test(value);
}

export function parseEventInput(raw: EventInput | undefined): ParseResult {
  const input = raw ?? {};
  const fail = (message: string): ParseResult => ({ ok: false, message });

  const name = text(input.name);
  if (!name) return fail("Give the event a name.");
  if (name.length > 80) return fail("Keep the name under 80 characters.");

  const slug = text(input.slug).toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) {
    return fail("The link name can only use lowercase letters, numbers and single hyphens, like fire-night.");
  }

  const description = text(input.description);
  if (description.length > 4000) return fail("Keep the description under 4,000 characters.");

  const tagline = text(input.tagline);
  if (tagline.length > 80) return fail("Keep the tagline under 80 characters.");

  const coverPhotoUrl = text(input.coverPhotoUrl);
  if (coverPhotoUrl && (!isLink(coverPhotoUrl) || coverPhotoUrl.length > 500)) {
    return fail("The flyer must be a path like /events/fire-night/cover.jpg or an https:// link.");
  }

  const chapterValue = text(input.chapter) || "global";
  if (!(chapterValue in CHAPTERS)) return fail("Pick which chapter is hosting.");
  const chapter = chapterValue as Chapter;

  const theme = text(input.theme) || "glow";
  if (!THEME_PATTERN.test(theme)) return fail("Pick a look for the event page.");

  const accent = text(input.accent).toLowerCase();
  if (accent && !ACCENT_PATTERN.test(accent)) return fail("The accent colour must look like #d9a441.");

  const statusValue = text(input.status) || "draft";
  if (statusValue !== "draft" && statusValue !== "published") return fail("Status must be draft or published.");
  const status = statusValue as EventStatus;

  const companionSlug = text(input.companionSlug).toLowerCase();
  if (companionSlug && !SLUG_PATTERN.test(companionSlug)) return fail("That companion event doesn't exist.");
  if (companionSlug === slug) return fail("An event can't be its own companion.");

  const mapQuery = text(input.mapQuery);
  if (mapQuery.length > 200) return fail("Keep the map search under 200 characters.");

  const schoolDefault = text(input.schoolDefault);
  if (schoolDefault.length > 80) return fail("Keep the pre-filled school under 80 characters.");

  const rawSessions = Array.isArray(input.sessions) ? input.sessions : [];
  if (rawSessions.length === 0) return fail("Add when and where the event happens.");
  if (rawSessions.length > MAX_SESSIONS) return fail(`An event can have at most ${MAX_SESSIONS} sessions.`);

  const multi = rawSessions.length > 1;
  const sessions: SessionDoc[] = [];
  for (const [index, session] of rawSessions.entries()) {
    const label = multi ? `Session ${index + 1}` : "The event";
    const startsAtText = text(session?.startsAt);
    const startsAt = new Date(startsAtText);
    if (!startsAtText || Number.isNaN(startsAt.getTime())) return fail(`${label} needs a date and time.`);

    const sessionName = multi ? text(session?.name) : name;
    if (!sessionName) return fail(`${label} needs a name, like "Sunday Service".`);
    if (sessionName.length > 80) return fail(`Keep ${label.toLowerCase()}'s name under 80 characters.`);

    const location = text(session?.location);
    if (location.length > 200) return fail(`Keep ${label.toLowerCase()}'s venue under 200 characters.`);

    const locationUrl = text(session?.locationUrl);
    if (locationUrl && !/^https:\/\/\S+$/.test(locationUrl)) {
      return fail(`${label}'s map link must start with https://.`);
    }

    const shaped: SessionDoc = { name: sessionName, startsAt: Timestamp.fromDate(startsAt) };
    if (location) shaped.location = location;
    if (locationUrl) shaped.locationUrl = locationUrl;
    sessions.push(shaped);
  }
  sessions.sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());
  const [first] = sessions;

  const fields: EventFields = {
    name,
    slug,
    description,
    coverPhotoUrl,
    chapter,
    theme,
    status,
    startsAt: first.startsAt,
    location: first.location ?? "",
    locationUrl: first.locationUrl ?? "",
  };
  const cleared: OptionalField[] = [];
  const optional: Array<[OptionalField, string | SessionDoc[] | undefined]> = [
    ["tagline", tagline],
    ["accent", accent],
    ["companionSlug", companionSlug],
    ["mapQuery", mapQuery],
    ["schoolDefault", schoolDefault],
    ["sessions", multi ? sessions : undefined],
  ];
  for (const [key, value] of optional) {
    if (value && value.length > 0) Object.assign(fields, { [key]: value });
    else cleared.push(key);
  }

  return { ok: true, fields, cleared };
}
