/**
 * Bucketing behind the admin dashboard.
 *
 * Deliberately free of firebase-admin: the arithmetic every chart depends on is
 * the part worth testing, and keeping it in its own module means testing it
 * doesn't need a Firestore stub — the same split phone.ts and search.ts use.
 *
 * Everything is bucketed in Accra time, not UTC. The distinction only bites for
 * a couple of hours a day, but "registered today" being wrong for an evening
 * signup is exactly the kind of number staff would notice and stop trusting.
 */

/** Accra is UTC+0 year-round; naming the zone keeps the intent explicit. */
export const ACCRA = "Africa/Accra";

/** yyyy-mm-dd, which sorts lexicographically the same way it sorts in time. */
export function accraDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCRA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function accraHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: ACCRA,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // Some ICU builds render midnight as "24" under hour12:false.
  return Number(hour) % 24;
}

/** Safe as plain date arithmetic because Accra has no DST to skip over. */
export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export interface DayBucket {
  date: string;
  count: number;
}

/**
 * Signups per day, running to today and zero-filled.
 *
 * The zero-fill is the point: dropping quiet days would sit Monday next to
 * Thursday on the axis and turn a lull into what looks like steady interest.
 * The window starts at the first signup so a brand-new event isn't mostly
 * empty gutter, and is capped so a long-running one stays readable.
 */
export function buildDaySeries(dates: Date[], now: Date, maxDays = 30): DayBucket[] {
  const today = accraDayKey(now);
  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = accraDayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const earliest = Array.from(counts.keys()).sort()[0] ?? today;
  const floor = shiftDayKey(today, -(maxDays - 1));
  let start = earliest < today ? earliest : today;
  if (start < floor) start = floor;

  const series: DayBucket[] = [];
  for (let key = start; key <= today; key = shiftDayKey(key, 1)) {
    series.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return series;
}

export interface HourBucket {
  hour: number;
  count: number;
}

/**
 * Arrivals by hour of day, trimmed to the span that actually has arrivals.
 * A fixed 24-hour axis for a four-hour event is twenty columns of nothing,
 * and it flattens the door rush that the chart exists to show.
 *
 * Hours are a circle, not a line: an event that runs 10pm–1am occupies 22, 23,
 * 0 and 1. Filling min..max would draw 0 through 23 and bury the rush in a
 * day of empty afternoon columns. The span is the shortest arc that covers
 * every occupied hour, wrapping midnight when that is the shorter path.
 */
export function buildHourSeries(dates: Date[]): HourBucket[] {
  if (dates.length === 0) return [];

  const counts = new Map<number, number>();
  for (const date of dates) {
    const hour = accraHour(date);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  const occupied = Array.from(counts.keys()).sort((a, b) => a - b);
  const n = occupied.length;

  // Largest empty gap on the 24-hour circle. The series is everything else:
  // start just after that gap and walk until it begins again.
  let largestGap = 0;
  let start = occupied[0];
  for (let i = 0; i < n; i++) {
    const current = occupied[i];
    const next = occupied[(i + 1) % n];
    const gap = (next - current - 1 + 24) % 24;
    if (gap >= largestGap) {
      largestGap = gap;
      start = next;
    }
  }

  const series: HourBucket[] = [];
  const length = 24 - largestGap;
  for (let i = 0; i < length; i++) {
    const hour = (start + i) % 24;
    series.push({ hour, count: counts.get(hour) ?? 0 });
  }
  return series;
}

export interface CategoryBucket {
  label: string;
  count: number;
}

/**
 * Counts a free-text field case-insensitively — attendees type "Legon",
 * "legon" and "LEGON" and all three are one school. The most common spelling
 * wins the label, so the chart shows back what people actually wrote.
 *
 * Everything past `limit` folds into one "Other" rather than growing an
 * unbounded tail of one-person rows.
 */
export function topCategories(values: string[], limit = 6): CategoryBucket[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();

  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;

    const key = label.toLowerCase();
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += 1;
    group.spellings.set(label, (group.spellings.get(label) ?? 0) + 1);
    groups.set(key, group);
  }

  const ranked = Array.from(groups.values())
    .map((group) => {
      const [label] = Array.from(group.spellings.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      )[0];
      return { label, count: group.count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (ranked.length <= limit) return ranked;

  const tail = ranked.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return [...ranked.slice(0, limit), { label: "Other", count: tail }];
}
