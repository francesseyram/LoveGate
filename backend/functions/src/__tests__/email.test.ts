import { describe, it, expect } from "vitest";
import { isToday, isTomorrow } from "../email";

/**
 * These two decide the reminder's subject line, and the scheduled 24-hour
 * reminder shares the template with the blast staff send on the night. If
 * `isToday` ever returned true a day early, every day-before email would
 * claim the event was already happening.
 *
 * Days are judged in Accra, not the server's timezone — the functions run in
 * europe-west1, which is an hour ahead for part of the year.
 */
const ACCRA_EVENING = new Date("2026-08-22T18:30:00Z"); // 18:30 in Accra

describe("reminder timing", () => {
  it("says today when the event is on the current Accra day", () => {
    const now = new Date("2026-08-22T15:48:00Z");
    expect(isToday(ACCRA_EVENING, now)).toBe(true);
    expect(isTomorrow(ACCRA_EVENING, now)).toBe(false);
  });

  it("says tomorrow the day before, never today", () => {
    const now = new Date("2026-08-21T17:00:00Z");
    expect(isToday(ACCRA_EVENING, now)).toBe(false);
    expect(isTomorrow(ACCRA_EVENING, now)).toBe(true);
  });

  it("says neither well in advance", () => {
    const now = new Date("2026-08-19T09:00:00Z");
    expect(isToday(ACCRA_EVENING, now)).toBe(false);
    expect(isTomorrow(ACCRA_EVENING, now)).toBe(false);
  });

  // 00:30 Accra on the 22nd is still the 22nd; a server reading UTC would agree
  // here, but the guard matters for zones that don't line up.
  it("treats just-after-midnight on the day as today", () => {
    const now = new Date("2026-08-22T00:30:00Z");
    expect(isToday(ACCRA_EVENING, now)).toBe(true);
  });
});
