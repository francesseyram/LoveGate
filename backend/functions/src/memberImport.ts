/**
 * Source definitions and merge rules for seeding `member_db` from the
 * spreadsheets the fellowship has kept since 2022.
 *
 * Each sheet became its own CSV (see scripts/seedMembers.js) because each one
 * has its own columns, its own date convention and its own idea of what a
 * phone number looks like. What they share is people: the same person appears
 * in three files under two spellings of their name, so the import has to fold
 * them together rather than import a roster with duplicates in it.
 */
import {
  ParsedDob, buildMemberSearchPrefixes, isBlank, memberDocId, parseDob, parseEmail,
  parseLevel, parsePhone, tidy, tidyName, unkeyedMemberDocId,
} from "./members";

export interface MemberSource {
  slug: string;
  /** Where these people actually are — inferred from the halls they list. */
  campus: string;
  /**
   * Higher wins when two sheets disagree about the same person's email,
   * hostel or level. Ranked by how recently the sheet was maintained: the
   * Legon members export is regenerated continuously, the 2022 Ashesi cohort
   * sheet has not been touched in years.
   */
  priority: number;
  /** The UMaT sheet was typed month-first; every other sheet is day-first. */
  dateOrder: "dmy" | "mdy";
  /** Ashesi sheets are per graduating class. */
  classYear?: number;
}

export const MEMBER_SOURCES: Record<string, MemberSource> = {
  "loveinc-members": { slug: "loveinc-members", campus: "Legon", priority: 100, dateOrder: "dmy" },
  apostolos: { slug: "apostolos", campus: "KNUST", priority: 90, dateOrder: "dmy" },
  umat: { slug: "umat", campus: "UMaT", priority: 80, dateOrder: "mdy" },
  "ashesi-c2029": { slug: "ashesi-c2029", campus: "Ashesi", priority: 79, dateOrder: "dmy", classYear: 2029 },
  "ashesi-c2028": { slug: "ashesi-c2028", campus: "Ashesi", priority: 78, dateOrder: "dmy", classYear: 2028 },
  "ashesi-c2027": { slug: "ashesi-c2027", campus: "Ashesi", priority: 77, dateOrder: "dmy", classYear: 2027 },
  "ashesi-c2026": { slug: "ashesi-c2026", campus: "Ashesi", priority: 76, dateOrder: "dmy", classYear: 2026 },
  "ashesi-c2025": { slug: "ashesi-c2025", campus: "Ashesi", priority: 75, dateOrder: "dmy", classYear: 2025 },
  "ashesi-c2024": { slug: "ashesi-c2024", campus: "Ashesi", priority: 74, dateOrder: "dmy", classYear: 2024 },
  "ashesi-c2023": { slug: "ashesi-c2023", campus: "Ashesi", priority: 73, dateOrder: "dmy", classYear: 2023 },
  "ashesi-c2022": { slug: "ashesi-c2022", campus: "Ashesi", priority: 72, dateOrder: "dmy", classYear: 2022 },
  "ashesi-guests": { slug: "ashesi-guests", campus: "Ashesi", priority: 60, dateOrder: "dmy" },
  "ashesi-misc": { slug: "ashesi-misc", campus: "Ashesi", priority: 50, dateOrder: "dmy" },
};

/**
 * Numbers where two entirely unlike names turned out to be one person, checked
 * by hand against the sheets. Without this the merge is still correct, but it
 * re-raises `needsReview` on every import and someone has to re-decide it —
 * so the answer is recorded here once. Both spellings stay in `aka`.
 */
const CONFIRMED_SAME_PERSON = new Set([
  "233503879141", // Sedem Kporvi / Nana Yaw Muzzu   (ashesi-c2027)
  "233206723467", // Addey / innocent                (loveinc-members)
]);

/** Column headings, as literally typed across the twelve sheets. */
const COLUMNS: Record<string, string[]> = {
  fullName: ["name", "full name", "names"],
  phone: ["mobile", "phone", "phone number", "mobile number", "contact"],
  whatsapp: ["whatsapp", "whatsapp number", "whatsapp no"],
  dob: ["dob", "date of birth", "birthday", "d.o.b"],
  hostel: ["hostel", "hall", "hall/hostel", "location", "residence"],
  email: ["email", "email address", "e-mail"],
  level: ["level", "year"],
  status: ["status"],
  dateAdded: ["date added", "date joined"],
};

export function mapHeaders(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headers.forEach((heading, i) => {
    const key = tidy(heading).toLowerCase().replace(/[.:]/g, "");
    for (const [field, synonyms] of Object.entries(COLUMNS)) {
      if (synonyms.includes(key) && index[field] === undefined) index[field] = i;
    }
  });
  return index;
}

export interface MemberRecord {
  fullName: string;
  nameLower: string;
  /** Other spellings this person was filed under, kept so search still finds them. */
  aka: string[];
  phone: string;
  phoneKey: string;
  altPhones: string[];
  phoneSuspect: boolean;
  whatsapp: string;
  whatsappKey: string;
  email: string;
  dobRaw: string;
  dobDay: number | null;
  dobMonth: number | null;
  dobYear: number | null;
  level: string;
  hostel: string;
  campus: string;
  classYear: number | null;
  status: string;
  joinedOn: string;
  /** Every sheet and row this person came from, e.g. "apostolos#12". */
  sources: string[];
  needsReview: boolean;
  reviewNotes: string[];
  /** Priority of the highest-ranked sheet this record has been merged from. */
  priority: number;
}

/**
 * Builds one record from one spreadsheet row. Returns null for rows that are
 * structurally empty or nameless — a row with no name and no number is a
 * stray cell, not a person.
 */
export function mapRow(
  row: string[],
  index: Record<string, number>,
  source: MemberSource,
  rowNumber: number,
): MemberRecord | null {
  const at = (field: string): string => {
    const i = index[field];
    return i === undefined ? "" : tidy(row[i] ?? "");
  };

  const fullName = tidyName(at("fullName"));
  const phone = parsePhone(at("phone"));
  if (!fullName && !phone.phoneKey) return null;

  const notes: string[] = [];
  if (phone.note) notes.push(phone.note);

  // "Same" in a WhatsApp column means the mobile number, not a value.
  const whatsappRaw = at("whatsapp");
  const whatsapp = SAME_AS_MOBILE.has(whatsappRaw.toLowerCase()) ? phone : parsePhone(whatsappRaw);

  const dob: ParsedDob = parseDob(at("dob"), source.dateOrder);
  if (dob.raw && dob.day === null && dob.month === null) {
    notes.push(`could not read date of birth "${dob.raw}"`);
  }

  // One row has an email address typed into the phone column.
  const email = parseEmail(at("email")) || parseEmail(phone.strandedEmail);
  if (phone.strandedEmail) notes.push("phone column contained an email address");
  if (!fullName) notes.push("no name given");
  if (!phone.phoneKey) notes.push("no phone number — cannot be deduplicated");

  return {
    fullName: fullName || "(no name)",
    nameLower: (fullName || "(no name)").toLowerCase(),
    aka: [],
    phone: phone.phone,
    phoneKey: phone.phoneKey,
    altPhones: phone.altPhones,
    phoneSuspect: phone.suspect,
    whatsapp: whatsapp.phone,
    whatsappKey: whatsapp.phoneKey,
    email,
    dobRaw: dob.raw,
    dobDay: dob.day,
    dobMonth: dob.month,
    dobYear: dob.year,
    level: parseLevel(at("level")),
    hostel: isBlank(at("hostel")) ? "" : at("hostel"),
    campus: source.campus,
    classYear: source.classYear ?? null,
    status: normalizeStatus(at("status")),
    joinedOn: parseJoinedOn(at("dateAdded")),
    sources: [`${source.slug}#${rowNumber}`],
    needsReview: notes.length > 0,
    reviewNotes: notes,
    priority: source.priority,
  };
}

const SAME_AS_MOBILE = new Set(["same", "same as above", "same number", "yes"]);

function normalizeStatus(raw: string): string {
  const value = raw.toLowerCase();
  return value === "active" || value === "inactive" ? value : "";
}

/** "13/07/2026" -> "2026-07-13". Day-first; left as typed if it won't parse. */
function parseJoinedOn(raw: string): string {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return raw;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface MergeResult {
  merged: MemberRecord;
  /** One line per field the two rows disagreed about, for the import report. */
  log: string[];
}

/**
 * Folds a duplicate into an existing member.
 *
 * The sheet that is still actively maintained wins any straight disagreement
 * (a hostel changes; the newer sheet is right), but an empty cell never beats
 * a filled one — a 2022 sheet with an email still contributes that email to
 * someone whose 2026 row has none.
 *
 * Names are the exception: the longest spelling wins, because the difference
 * is almost always "Ben" versus "Benedict" rather than two different people,
 * and the discarded spelling is kept in `aka` so searching either one works.
 */
export function mergeMembers(existing: MemberRecord, incoming: MemberRecord): MergeResult {
  const [winner, loser] = incoming.priority > existing.priority
    ? [incoming, existing]
    : [existing, incoming];
  const log: string[] = [];

  const merged: MemberRecord = { ...winner };

  const scalars: (keyof MemberRecord)[] = [
    "phone", "whatsapp", "whatsappKey", "email", "level", "hostel", "campus", "status", "joinedOn",
  ];
  for (const field of scalars) {
    const win = winner[field] as string;
    const lose = loser[field] as string;
    if (!win && lose) {
      (merged[field] as string) = lose;
    } else if (win && lose && win !== lose) {
      log.push(`  ${field}: kept "${win}" (${sheetOf(winner)}), dropped "${lose}" (${sheetOf(loser)})`);
    }
  }

  // Name: longest spelling wins, every other spelling is remembered.
  const names = [existing.fullName, incoming.fullName, ...existing.aka, ...incoming.aka]
    .filter((name) => name && name !== "(no name)");
  const best = names.slice().sort((a, b) => b.length - a.length)[0] ?? winner.fullName;
  merged.fullName = best;
  merged.nameLower = best.toLowerCase();
  merged.aka = Array.from(new Set(names.filter((name) => name.toLowerCase() !== best.toLowerCase())));
  if (merged.aka.length && existing.fullName.toLowerCase() !== incoming.fullName.toLowerCase()) {
    log.push(`  name: kept "${best}", also known as ${merged.aka.map((n) => `"${n}"`).join(", ")}`);
  }

  // Date of birth: prefer whichever row actually has one, and prefer the row
  // that also carried a usable year.
  const dobWinner = pickDob(winner, loser);
  merged.dobRaw = dobWinner.dobRaw;
  merged.dobDay = dobWinner.dobDay;
  merged.dobMonth = dobWinner.dobMonth;
  merged.dobYear = dobWinner.dobYear;
  if (winner.dobDay && loser.dobDay && (winner.dobDay !== loser.dobDay || winner.dobMonth !== loser.dobMonth)) {
    log.push(`  dob: kept "${winner.dobRaw}" (${sheetOf(winner)}), dropped "${loser.dobRaw}" (${sheetOf(loser)})`);
  }

  merged.classYear = winner.classYear ?? loser.classYear;
  merged.altPhones = Array.from(new Set([...winner.altPhones, ...loser.altPhones, loser.phone]))
    .filter((p) => p && p !== merged.phone);
  merged.phoneSuspect = winner.phoneSuspect || loser.phoneSuspect;
  merged.sources = Array.from(new Set([...existing.sources, ...incoming.sources]));
  merged.reviewNotes = Array.from(new Set([...winner.reviewNotes, ...loser.reviewNotes]));

  // Two rows can share a phone number without being the same person: someone
  // mistyped a digit, or two friends handed in the same number. Names that
  // overlap ("Ben" / "Benedict Arthur") are the same person; names with
  // nothing in common are a data-entry error worth a human look, so the merge
  // still happens but gets flagged instead of quietly hiding one of them.
  if (!sharesNameToken(existing.fullName, incoming.fullName) && !CONFIRMED_SAME_PERSON.has(merged.phoneKey)) {
    const note = `merged with "${loser.fullName}" (${sheetOf(loser)}) on phone ${merged.phone} ` +
      `but the names have nothing in common — check for a mistyped number`;
    merged.reviewNotes.push(note);
    log.push(`  ! ${note}`);
  }

  merged.needsReview = merged.reviewNotes.length > 0;
  merged.priority = winner.priority;

  return { merged, log };
}

/** Ignores initials and particles; "Kofi" matching "kofi" is signal, "a" is not. */
function sharesNameToken(a: string, b: string): boolean {
  const tokens = (name: string) =>
    new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
  const left = tokens(a);
  if (!left.size) return true;
  const right = tokens(b);
  if (!right.size) return true;
  return [...left].some((token) => right.has(token));
}

function pickDob(winner: MemberRecord, loser: MemberRecord): MemberRecord {
  if (!winner.dobDay && !winner.dobMonth) return loser.dobDay || loser.dobMonth ? loser : winner;
  if (!winner.dobYear && loser.dobYear && loser.dobDay === winner.dobDay) return loser;
  return winner;
}

function sheetOf(record: MemberRecord): string {
  return record.sources[0] ?? "?";
}

/** The Firestore document, as written. `priority` is import bookkeeping only. */
export function toMemberDoc(record: MemberRecord): Record<string, unknown> {
  const { priority: _priority, ...fields } = record;
  return {
    ...fields,
    searchPrefixes: buildMemberSearchPrefixes(record.fullName, record.aka),
    sourceCount: record.sources.length,
  };
}

export function docIdFor(record: MemberRecord): string {
  return record.phoneKey
    ? memberDocId(record.phoneKey)
    : unkeyedMemberDocId(record.sources[0]?.split("#")[0] ?? "unknown", record.nameLower);
}
