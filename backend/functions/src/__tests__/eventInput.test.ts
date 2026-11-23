import { describe, expect, it } from "vitest";
import { parseEventInput } from "../eventInput";
import type { EventInput } from "../eventInput";

const base: EventInput = {
  name: "Fire Night",
  slug: "fire-night",
  chapter: "knust",
  theme: "fire",
  status: "draft",
  sessions: [{ startsAt: "2026-11-27T19:30:00Z", location: "Kumapley" }],
};

function parse(overrides: Partial<EventInput>) {
  return parseEventInput({ ...base, ...overrides });
}

describe("parseEventInput", () => {
  it("stores a single session as the event's own time and venue", () => {
    const result = parse({});
    if (!result.ok) throw new Error(result.message);
    expect(result.fields.startsAt.toDate().toISOString()).toBe("2026-11-27T19:30:00.000Z");
    expect(result.fields.location).toBe("Kumapley");
    expect(result.fields.sessions).toBeUndefined();
    expect(result.cleared).toContain("sessions");
  });

  it("stores several sessions sorted, with startsAt taken from the earliest", () => {
    const result = parse({
      sessions: [
        { name: "Sunday Service", startsAt: "2026-11-29T11:00:00Z", location: "Mastercard" },
        { name: "Fire Night", startsAt: "2026-11-27T19:30:00Z", location: "Kumapley" },
      ],
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.fields.sessions?.map((s) => s.name)).toEqual(["Fire Night", "Sunday Service"]);
    expect(result.fields.location).toBe("Kumapley");
    expect(result.fields.startsAt.toDate().toISOString()).toBe("2026-11-27T19:30:00.000Z");
  });

  it("requires a name on every session when there are several", () => {
    const result = parse({
      sessions: [{ startsAt: "2026-11-27T19:30:00Z" }, { startsAt: "2026-11-29T11:00:00Z" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing or unreadable date", () => {
    expect(parse({ sessions: [{ startsAt: "" }] }).ok).toBe(false);
    expect(parse({ sessions: [{ startsAt: "next friday" }] }).ok).toBe(false);
    expect(parse({ sessions: [] }).ok).toBe(false);
  });

  it("only accepts link-safe slugs", () => {
    expect(parse({ slug: "Fire Night" }).ok).toBe(false);
    expect(parse({ slug: "fire--night" }).ok).toBe(false);
    expect(parse({ slug: "-fire" }).ok).toBe(false);
    const upper = parse({ slug: "FIRE-NIGHT" });
    expect(upper.ok && upper.fields.slug).toBe("fire-night");
  });

  it("checks the accent is a six-digit hex colour and lowercases it", () => {
    expect(parse({ accent: "gold" }).ok).toBe(false);
    expect(parse({ accent: "#fff" }).ok).toBe(false);
    const ok = parse({ accent: "#E8552D" });
    expect(ok.ok && ok.fields.accent).toBe("#e8552d");
  });

  it("lists empty optional fields as cleared rather than writing empty strings", () => {
    const result = parse({ tagline: "  ", accent: "", mapQuery: "MCFP+22R, Kumasi" });
    if (!result.ok) throw new Error(result.message);
    expect(result.cleared).toEqual(expect.arrayContaining(["tagline", "accent", "companionSlug"]));
    expect(result.cleared).not.toContain("mapQuery");
    expect(result.fields.mapQuery).toBe("MCFP+22R, Kumasi");
    expect("tagline" in result.fields).toBe(false);
  });

  it("refuses an event as its own companion", () => {
    expect(parse({ companionSlug: "fire-night" }).ok).toBe(false);
    expect(parse({ companionSlug: "sunday-service" }).ok).toBe(true);
  });

  it("accepts a flyer as a local path or https link only", () => {
    expect(parse({ coverPhotoUrl: "/events/fire-night/cover.jpg" }).ok).toBe(true);
    expect(parse({ coverPhotoUrl: "https://example.com/a.jpg" }).ok).toBe(true);
    expect(parse({ coverPhotoUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(parse({ coverPhotoUrl: "http://example.com/a.jpg" }).ok).toBe(false);
  });

  it("defaults chapter, theme and status, and rejects unknown chapters and statuses", () => {
    const result = parse({ chapter: "", theme: "", status: "" });
    if (!result.ok) throw new Error(result.message);
    expect([result.fields.chapter, result.fields.theme, result.fields.status]).toEqual(["global", "glow", "draft"]);
    expect(parse({ chapter: "legon" }).ok).toBe(false);
    expect(parse({ status: "archived" }).ok).toBe(false);
  });
});
