import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { isSupersededByRevert } from "../revertGuard";

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

describe("isSupersededByRevert", () => {
  it("lets a scan through when the person was never reverted", () => {
    expect(isSupersededByRevert(at("2026-08-22T18:00:00Z"), null)).toBe(false);
    expect(isSupersededByRevert(at("2026-08-22T18:00:00Z"), undefined)).toBe(false);
  });

  it("drops a scan recorded before the revert", () => {
    // Scanned at the door while offline, reverted while that phone was still
    // out of signal, queue flushed afterwards.
    expect(isSupersededByRevert(at("2026-08-22T18:00:00Z"), at("2026-08-22T18:05:00Z"))).toBe(true);
  });

  it("treats a tie as the revert winning", () => {
    expect(isSupersededByRevert(at("2026-08-22T18:00:00Z"), at("2026-08-22T18:00:00Z"))).toBe(true);
  });

  it("lets a genuine re-scan through after a revert", () => {
    // Reverted by mistake, then the person is scanned again for real.
    expect(isSupersededByRevert(at("2026-08-22T18:10:00Z"), at("2026-08-22T18:05:00Z"))).toBe(false);
  });

  it("compares by instant, not by clock string", () => {
    // Same moment, different zone offsets — must not read as a re-scan.
    expect(isSupersededByRevert(at("2026-08-22T18:00:00Z"), at("2026-08-22T20:00:00+02:00"))).toBe(
      true
    );
  });
});
