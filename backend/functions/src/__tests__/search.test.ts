import { describe, it, expect } from "vitest";
import { buildSearchPrefixes, buildTicketRef, registrationDocId } from "../search";

describe("buildSearchPrefixes", () => {
  it("indexes every prefix of every word, not just the full name", () => {
    const prefixes = buildSearchPrefixes("Ama Owusu");
    expect(prefixes).toEqual(
      expect.arrayContaining(["a", "am", "ama", "o", "ow", "owu", "owus", "owusu"])
    );
  });

  // The bug this exists to prevent: staff type a surname at the door and the
  // old nameLower range query returned nothing, because it could only ever
  // match from the start of the whole string.
  it("finds someone by surname", () => {
    expect(buildSearchPrefixes("Ama Owusu")).toContain("owusu");
    expect(buildSearchPrefixes("Nana Kwame Osei")).toContain("osei");
  });

  it("matches partial surnames for type-ahead", () => {
    expect(buildSearchPrefixes("Ama Owusu")).toContain("owu");
  });

  it("is case- and punctuation-insensitive", () => {
    const prefixes = buildSearchPrefixes("KWAME  Osei-Bonsu");
    expect(prefixes).toContain("kwame");
    expect(prefixes).toContain("osei");
    expect(prefixes).toContain("bonsu");
  });

  it("includes the ticket ref so staff can search by the printed code", () => {
    const prefixes = buildSearchPrefixes("Ama Owusu", "LG-4F9K2A");
    expect(prefixes).toContain("4f9k2a");
  });

  it("does not blow up index size on absurd input", () => {
    const prefixes = buildSearchPrefixes("a".repeat(500));
    expect(prefixes.length).toBeLessThanOrEqual(15);
  });

  it("handles empty input", () => {
    expect(buildSearchPrefixes("")).toEqual([]);
  });
});

describe("registrationDocId", () => {
  it("is deterministic, so a duplicate submit collides instead of racing", () => {
    const a = registrationDocId("evt1", "233200000000");
    const b = registrationDocId("evt1", "233200000000");
    expect(a).toBe(b);
  });

  it("separates different people and different events", () => {
    expect(registrationDocId("evt1", "233200000000")).not.toBe(
      registrationDocId("evt1", "233240000000")
    );
    expect(registrationDocId("evt1", "233200000000")).not.toBe(
      registrationDocId("evt2", "233200000000")
    );
  });

  // The doc id ends up inside the QR payload, and QR codes get forwarded.
  it("never leaks the phone number", () => {
    expect(registrationDocId("evt1", "233200000000")).not.toContain("233200000000");
    expect(registrationDocId("evt1", "233200000000")).not.toContain("200000000");
  });

  it("keeps the event id addressable for debugging", () => {
    expect(registrationDocId("evt1", "233200000000").startsWith("evt1_")).toBe(true);
  });
});

describe("buildTicketRef", () => {
  it("produces a short, human-quotable code", () => {
    expect(buildTicketRef("evt1_abcdef123456")).toBe("LG-123456");
  });
});
