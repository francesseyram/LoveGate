import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { chapterOf, eventEndsAt, eventSessions } from "../eventShape";
import { isEventCurrent } from "../eventWindow";

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

const fireNight = {
  name: "Fire Night",
  startsAt: at("2026-11-27T19:30:00Z"),
  location: "New Engineering Building Auditorium",
  sessions: [
    // Deliberately out of order: the helpers must not trust stored order.
    { name: "Sunday Service", startsAt: at("2026-11-29T11:00:00Z"), location: "Mastercard Medium Conference Room" },
    { name: "Fire Night", startsAt: at("2026-11-27T19:30:00Z"), location: "New Engineering Building Auditorium" },
  ],
};

const single = {
  name: "Revive",
  startsAt: at("2026-08-22T18:30:00Z"),
  location: "Anglican Church Hall",
  locationUrl: "https://maps.example/revive",
};

describe("eventSessions", () => {
  it("sorts stored sessions soonest first", () => {
    expect(eventSessions(fireNight).map((s) => s.name)).toEqual(["Fire Night", "Sunday Service"]);
  });

  it("builds one session from the event itself when none are stored", () => {
    expect(eventSessions(single)).toEqual([
      {
        name: "Revive",
        startsAt: single.startsAt,
        location: "Anglican Church Hall",
        locationUrl: "https://maps.example/revive",
      },
    ]);
  });

  it("treats an empty sessions list like a missing one", () => {
    expect(eventSessions({ ...single, sessions: [] })).toHaveLength(1);
  });
});

describe("eventEndsAt", () => {
  it("is the last session's start", () => {
    expect(eventEndsAt(fireNight).toDate().toISOString()).toBe("2026-11-29T11:00:00.000Z");
  });

  it("is startsAt for a single-session event", () => {
    expect(eventEndsAt(single).toMillis()).toBe(single.startsAt.toMillis());
  });
});

describe("isEventCurrent", () => {
  it("keeps a multi-session event open between its sessions", () => {
    // Saturday noon: well past Friday's 12h grace window, before Sunday.
    expect(isEventCurrent(fireNight, at("2026-11-28T12:00:00Z"))).toBe(true);
  });

  it("closes it 12 hours after the last session starts", () => {
    expect(isEventCurrent(fireNight, at("2026-11-29T22:59:00Z"))).toBe(true);
    expect(isEventCurrent(fireNight, at("2026-11-29T23:01:00Z"))).toBe(false);
  });

  it("still closes a single-session event 12 hours after it starts", () => {
    expect(isEventCurrent(single, at("2026-08-23T06:29:00Z"))).toBe(true);
    expect(isEventCurrent(single, at("2026-08-23T06:31:00Z"))).toBe(false);
  });
});

describe("chapterOf", () => {
  it("passes known chapters through", () => {
    expect(chapterOf("knust")).toBe("knust");
  });

  it("falls back to global for missing or unknown values", () => {
    expect(chapterOf(undefined)).toBe("global");
    expect(chapterOf("legon-annex")).toBe("global");
  });
});
