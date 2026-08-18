import { describe, expect, it } from "vitest";
import {
  accraDayKey,
  accraHour,
  buildDaySeries,
  buildHourSeries,
  shiftDayKey,
  topCategories,
} from "../analytics";

describe("accraDayKey", () => {
  it("keeps a late-evening signup on the day it happened", () => {
    expect(accraDayKey(new Date("2026-08-18T23:30:00Z"))).toBe("2026-08-18");
  });

  it("rolls over at midnight, not at some UTC offset", () => {
    expect(accraDayKey(new Date("2026-08-19T00:05:00Z"))).toBe("2026-08-19");
  });
});

describe("accraHour", () => {
  it("reports midnight as 0 rather than 24", () => {
    expect(accraHour(new Date("2026-08-18T00:15:00Z"))).toBe(0);
  });

  it("reports an evening arrival", () => {
    expect(accraHour(new Date("2026-08-18T19:37:00Z"))).toBe(19);
  });
});

describe("shiftDayKey", () => {
  it("crosses a month boundary", () => {
    expect(shiftDayKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDayKey("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("crosses a year boundary", () => {
    expect(shiftDayKey("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("buildDaySeries", () => {
  const now = new Date("2026-08-18T12:00:00Z");

  it("zero-fills quiet days so a lull is visible", () => {
    const series = buildDaySeries(
      [new Date("2026-08-16T09:00:00Z"), new Date("2026-08-18T09:00:00Z")],
      now
    );
    expect(series).toEqual([
      { date: "2026-08-16", count: 1 },
      { date: "2026-08-17", count: 0 },
      { date: "2026-08-18", count: 1 },
    ]);
  });

  it("runs to today even when nobody signed up today", () => {
    const series = buildDaySeries([new Date("2026-08-17T09:00:00Z")], now);
    expect(series.at(-1)).toEqual({ date: "2026-08-18", count: 0 });
  });

  it("returns a single day when there are no registrations at all", () => {
    expect(buildDaySeries([], now)).toEqual([{ date: "2026-08-18", count: 0 }]);
  });

  it("caps the window rather than drawing months of columns", () => {
    const series = buildDaySeries([new Date("2025-01-01T09:00:00Z")], now, 7);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-08-12");
  });
});

describe("buildHourSeries", () => {
  it("trims to the span that has arrivals", () => {
    const series = buildHourSeries([
      new Date("2026-08-18T18:10:00Z"),
      new Date("2026-08-18T18:40:00Z"),
      new Date("2026-08-18T20:05:00Z"),
    ]);
    expect(series).toEqual([
      { hour: 18, count: 2 },
      { hour: 19, count: 0 },
      { hour: 20, count: 1 },
    ]);
  });

  it("is empty before the doors open", () => {
    expect(buildHourSeries([])).toEqual([]);
  });
});

describe("topCategories", () => {
  it("groups spellings case-insensitively and labels with the common one", () => {
    expect(topCategories(["Legon", "legon", "Legon", "LEGON "])).toEqual([
      { label: "Legon", count: 4 },
    ]);
  });

  it("ignores blank answers", () => {
    expect(topCategories(["Legon", "", "   "])).toEqual([{ label: "Legon", count: 1 }]);
  });

  it("folds the tail into Other instead of growing forever", () => {
    const values = ["a", "a", "a", "b", "b", "c", "d", "e"];
    expect(topCategories(values, 2)).toEqual([
      { label: "a", count: 3 },
      { label: "b", count: 2 },
      { label: "Other", count: 3 },
    ]);
  });

  it("leaves the list alone when it already fits", () => {
    expect(topCategories(["a", "b"], 6)).toEqual([
      { label: "a", count: 1 },
      { label: "b", count: 1 },
    ]);
  });
});
