/**
 * Parsing + normalization for the standing membership roster (`member_db`).
 *
 * This is NOT the ticketing path. `registrations` is per-event and written by
 * people typing their own details into a form; `member_db` is a roster
 * imported from spreadsheets that four different people maintained over four
 * years, by hand, in Excel. Everything here exists because of that: the same
 * person shows up as "Ben Arthur" and "Benedict Arthur", their number is
 * written five ways, and their date of birth might be "18-Sep", "17/11/2006"
 * or a serial date Excel stamped with whatever year it was when someone typed
 * "18 Sep" into a cell.
 *
 * The rule throughout: never discard what was written. Normalize into fields
 * that are actually queryable, keep the original alongside, and flag anything
 * a human should look at rather than silently guessing.
 */
import { createHash } from "crypto";
import { toPhoneKey, normalizePhone, DEFAULT_COUNTRY_CODE } from "./phone";
import { buildSearchPrefixes } from "./search";

/** A Ghanaian national number is 9 digits once the trunk "0" is gone. */
const GH_NATIONAL_LENGTH = 9;

/**
 * Nobody in a campus fellowship was born before this, and anyone "born" after
 * it is a typo — most often Excel autofilling the current year onto a
 * day/month someone typed without one. Years outside the range are dropped
 * while day and month are kept, because the day and month are real.
 */
const MIN_BIRTH_YEAR = 1940;
const MAX_BIRTH_YEAR = 2016;

/**
 * Placeholder text people type into a cell they can't fill. Treated as empty
 * everywhere — an email of "N/A" is worse than no email, because it looks
 * like data.
 */
const BLANKS = new Set([
  "", "-", "--", "---", ".", "n/a", "n\\a", "na", "n/", "no", "none", "nil",
  "null", "nan", "undefined", "unknown", "not in school", "no access", "n.a",
]);

export function isBlank(raw: string | undefined | null): boolean {
  return raw == null || BLANKS.has(raw.trim().toLowerCase());
}

/** Collapses runs of whitespace; "  Ama   Owusu " -> "Ama Owusu". */
export function tidy(raw: string | undefined | null): string {
  if (isBlank(raw)) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/**
 * ALL-CAPS entries ("GLORIA ANNABELLA FOKUOH") are a shouting artifact of the
 * spreadsheet, not how the person writes their name, and they look broken next
 * to everyone else in a list. Mixed-case names are left exactly as written —
 * we have no business "fixing" someone's capitalisation of McCarthy or
 * Nii-Addoquaye.
 */
export function tidyName(raw: string | undefined | null): string {
  const name = tidy(raw);
  if (!name || name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'’\-.,])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export interface ParsedPhone {
  /** Display form: "0241234567" for Ghana, "+19034490210" otherwise. */
  phone: string;
  /** Dedupe key from `toPhoneKey`, e.g. "233241234567". Empty if unparseable. */
  phoneKey: string;
  /** Second and later numbers from cells like "0505011723/0257993771". */
  altPhones: string[];
  /** An email address found in a phone column — one row really does this. */
  strandedEmail: string;
  /** Set when the number is the wrong length to be real; imported anyway. */
  suspect: boolean;
  /** Human-readable reason, for the import report. */
  note: string;
}

const EMPTY_PHONE: ParsedPhone = {
  phone: "", phoneKey: "", altPhones: [], strandedEmail: "", suspect: false, note: "",
};

/**
 * Turns one spreadsheet phone cell into a display number plus a dedupe key.
 *
 * The cases here are all real rows: "(+233) 549806258", "054 901 3067",
 * "553997671.0" (Excel read it as a float), "504371221" (Excel ate the
 * leading zero), "O536692716" (typed with a letter O), "0505011723/0257993771"
 * (two numbers in one cell) and one cell containing an email address.
 */
export function parsePhone(raw: string | undefined | null): ParsedPhone {
  const value = tidy(raw);
  if (!value) return { ...EMPTY_PHONE };

  if (value.includes("@")) {
    return { ...EMPTY_PHONE, strandedEmail: value.toLowerCase(), note: "email found in phone column" };
  }

  const notes: string[] = [];
  const parts = value
    .split(/[/,;]| or /i)
    .map((part) => part.trim())
    .filter((part) => part && !isBlank(part));
  if (!parts.length) return { ...EMPTY_PHONE };

  const parsed = parts.map((part) => {
    let cleaned = part;
    // A letter O where a 0 belongs, but only when nothing else alphabetic is
    // present — "O536692716" is a typo, "call Odie" is not a phone number.
    if (/^[Oo]?[\d\s()+\-.]*$/.test(cleaned) && /[Oo]/.test(cleaned)) {
      cleaned = cleaned.replace(/[Oo]/g, "0");
      notes.push(`read "${part}" as "${cleaned}"`);
    }
    cleaned = cleaned.replace(/\.0+$/, ""); // Excel floated it: "553997671.0"
    return { raw: part, key: toPhoneKey(cleaned), digits: normalizePhone(cleaned) };
  }).filter((p) => p.digits);

  if (!parsed.length) return { ...EMPTY_PHONE };

  const [primary, ...rest] = parsed;
  const suspect = !isPlausiblePhoneKey(primary.key);
  if (suspect) notes.push(`"${primary.raw}" is not a valid Ghana number`);

  return {
    phone: displayPhone(primary.key, primary.digits),
    phoneKey: primary.key,
    altPhones: rest.map((p) => displayPhone(p.key, p.digits)),
    strandedEmail: "",
    suspect,
    note: notes.join("; "),
  };
}

/** A real Ghana number keys to country code + exactly 9 national digits. */
export function isPlausiblePhoneKey(key: string): boolean {
  if (!key) return false;
  if (!key.startsWith(DEFAULT_COUNTRY_CODE)) {
    return key.length >= 8 && key.length <= 15; // dialled international, left alone
  }
  const national = key.slice(DEFAULT_COUNTRY_CODE.length);
  return national.length === GH_NATIONAL_LENGTH && /^[235]/.test(national);
}

/**
 * Ghana numbers display the way people actually write them ("0241234567") so
 * a volunteer can read one off the screen and dial it; anything foreign keeps
 * its "+" so nobody dials it as local.
 */
function displayPhone(key: string, digits: string): string {
  if (!key) return digits;
  if (key.startsWith(DEFAULT_COUNTRY_CODE)) {
    const national = key.slice(DEFAULT_COUNTRY_CODE.length);
    if (national.length === GH_NATIONAL_LENGTH) return `0${national}`;
  }
  return `+${key}`;
}

export function parseEmail(raw: string | undefined | null): string {
  const value = tidy(raw).toLowerCase().replace(/\s+/g, "");
  return value.includes("@") && !value.endsWith("@") ? value : "";
}

/** "Level 100" / "100" / "N/A" -> "100" / "100" / "". */
export function parseLevel(raw: string | undefined | null): string {
  const digits = tidy(raw).match(/\d{3}/);
  return digits ? digits[0] : "";
}

export interface ParsedDob {
  /** Exactly what the spreadsheet said, always kept. */
  raw: string;
  day: number | null;
  month: number | null;
  /** Null whenever the year is missing or implausible — see MIN/MAX_BIRTH_YEAR. */
  year: number | null;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Date of birth is the messiest column in every one of these files: "18-Sep",
 * "29th July", "20th July,2006", "17/11/2006", "10/18/2006" (the UMaT sheet is
 * month-first), "17-08-06", "52007-03-01" (a genuine typo) and thousands of
 * Excel serial dates whose year is whenever the row was typed.
 *
 * Day and month survive this; the year usually does not, so it is dropped
 * unless it lands in a plausible range. Birthday lists work either way — which
 * is what this column is actually used for.
 *
 * `order` disambiguates "04/07": every sheet is day-first except UMaT.
 */
export function parseDob(raw: string | undefined | null, order: "dmy" | "mdy" = "dmy"): ParsedDob {
  const value = tidy(raw);
  const empty: ParsedDob = { raw: value, day: null, month: null, year: null };
  if (!value) return empty;

  // ISO, as written by the xlsx export of a real date cell.
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return build(+iso[3], +iso[2], +iso[1], value);

  // Month by name: "18-Sep", "29th July", "20th July,2006", "March 18 2006".
  const named = value.match(/^(?:(\d{1,2})(?:st|nd|rd|th)?[\s\-.,]+)?([a-z]{3,})[\s\-.,]*(\d{1,2})?(?:st|nd|rd|th)?[\s\-.,]*(\d{2,4})?$/i);
  if (named) {
    const month = MONTHS.findIndex((m) => m.startsWith(named[2].toLowerCase()));
    if (month >= 0) {
      const day = named[1] ? +named[1] : named[3] ? +named[3] : null;
      const yearPart = named[4] ?? (named[1] && named[3] ? named[3] : undefined);
      return build(day, month + 1, yearPart ? expandYear(+yearPart, yearPart.length) : null, value);
    }
  }

  // Numeric: "17/11/2006", "20/06", "17-08-06", "09.09.06".
  const parts = value.split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^\d{1,4}$/.test(p))) {
    let [a, b, c] = parts.map(Number);
    const yearLength = parts[2]?.length ?? 0;
    // Whichever number can't be a month tells us the layout, whatever the
    // sheet's usual convention is.
    let day: number, month: number;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else if (order === "mdy") { month = a; day = b; }
    else { day = a; month = b; }
    return build(day, month, parts.length >= 3 ? expandYear(c, yearLength) : null, value);
  }

  return empty;
}

/** "06" -> 2006, "95" -> 1995. Four-digit years pass through untouched. */
function expandYear(year: number, digits: number): number {
  if (digits >= 4) return year;
  return year > 30 ? 1900 + year : 2000 + year;
}

function build(day: number | null, month: number | null, year: number | null, raw: string): ParsedDob {
  const validDay = day != null && day >= 1 && day <= 31 ? day : null;
  const validMonth = month != null && month >= 1 && month <= 12 ? month : null;
  const validYear = year != null && year >= MIN_BIRTH_YEAR && year <= MAX_BIRTH_YEAR ? year : null;
  return { raw, day: validDay, month: validMonth, year: validYear };
}

/**
 * Deterministic id so re-running the seeder updates the same document instead
 * of doubling the roster. Keyed on the phone rather than the name because the
 * phone is the one field the same person writes the same way (once
 * normalized), and names drift across sheets.
 *
 * Unlike registration ids this one is never published — member docs are
 * staff-only — but it stays hashed anyway so nothing derived from a phone
 * number ends up in a URL by accident.
 */
export function memberDocId(phoneKey: string): string {
  return `m_${createHash("sha256").update(phoneKey).digest("hex").slice(0, 20)}`;
}

/**
 * Id for the ~30 people listed with a name and nothing else. They can't be
 * deduped against anyone, so they're scoped to the sheet they came from: two
 * sheets each listing a "Joshua" are two different Joshuas until someone
 * writes down a number. Re-running the seeder still updates in place.
 */
export function unkeyedMemberDocId(source: string, nameLower: string): string {
  const digest = createHash("sha256").update(`${source}:${nameLower}`).digest("hex");
  return `mu_${digest.slice(0, 20)}`;
}

export function buildMemberSearchPrefixes(fullName: string, aka: string[] = []): string[] {
  return buildSearchPrefixes([fullName, ...aka].join(" "));
}
