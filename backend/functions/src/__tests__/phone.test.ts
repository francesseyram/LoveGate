import { describe, it, expect } from "vitest";
import { normalizePhone, toPhoneKey } from "../phone";

describe("normalizePhone", () => {
  it("keeps only digits", () => {
    expect(normalizePhone("+1 (234) 567-8901")).toBe("12345678901");
    expect(normalizePhone("020 000 0000")).toBe("0200000000");
  });
});

describe("toPhoneKey", () => {
  // The bug this exists to prevent: the same person writing their number
  // three different ways used to produce three keys, three tickets, three
  // confirmation emails.
  it("collapses every Ghanaian way of writing the same number", () => {
    const expected = "233200000000";
    expect(toPhoneKey("020 000 0000")).toBe(expected);
    expect(toPhoneKey("0200000000")).toBe(expected);
    expect(toPhoneKey("+233 20 000 0000")).toBe(expected);
    expect(toPhoneKey("+233200000000")).toBe(expected);
    expect(toPhoneKey("233200000000")).toBe(expected);
    expect(toPhoneKey("  0200000000  ")).toBe(expected);
    expect(toPhoneKey("+233 (020) 000-0000")).toBe(expected);
  });

  it("keeps genuinely different numbers distinct", () => {
    expect(toPhoneKey("0200000000")).not.toBe(toPhoneKey("0240000000"));
  });

  it("leaves an explicit non-Ghanaian number as dialled", () => {
    expect(toPhoneKey("+1 234 567 8901")).toBe("12345678901");
    expect(toPhoneKey("+44 20 7946 0958")).toBe("442079460958");
  });

  it("returns empty string for input with no digits", () => {
    expect(toPhoneKey("")).toBe("");
    expect(toPhoneKey("not a phone")).toBe("");
  });
});
