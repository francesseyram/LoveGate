"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Anton, Oswald } from "next/font/google";
import { AuthGuard } from "@/components/AuthGuard";
import { StaffBackdrop } from "@/components/StaffBackdrop";
import { StaffNav } from "@/components/StaffNav";
import { ACCENT_SWATCHES, HOUSE_GOLD, accentContrast, accentStyle, isAccent } from "@/lib/accent";
import { CHAPTERS, eventSessions } from "@/lib/eventShape";
import { getAllEvents, getCallableErrorMessage, saveEvent } from "@/lib/functions";
import type { Chapter, EventInput, EventSummary } from "@/lib/types";
import { DEFAULT_THEME, THEME_NAMES, themeFor } from "@/events/themes";

/**
 * The event editor: create an event, and change how it looks.
 *
 * Until this existed, an event was a seed script run from someone's laptop.
 * Everything a script could set is here, and the page is its own preview:
 * the banner behind it and every highlight on it follow the theme and accent
 * being edited, before anything is saved.
 *
 * The flyer is still a path or link rather than an upload: the Firebase
 * project has no Storage bucket yet.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

type SessionDraft = EventInput["sessions"][number];

const MAX_SESSIONS = 6;

const field =
  "h-11 w-full rounded-xl border border-cream/15 bg-cream/[0.04] px-4 text-[16px] text-cream placeholder:text-cream/30 outline-none transition focus:border-gold disabled:opacity-50";
const label = "mb-1.5 block font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/55 uppercase";
const help = "mt-1.5 text-[12.5px] leading-snug text-cream/40";

/** Accra is UTC+0, so the picker's local time and UTC are the same clock. */
function toPicker(iso: string): string {
  return iso ? iso.slice(0, 16) : "";
}
function fromPicker(value: string): string {
  return value ? `${value}:00.000Z` : "";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function blankSession(): SessionDraft {
  return { name: "", startsAt: "", location: "", locationUrl: "" };
}

function blankDraft(): EventInput {
  return {
    name: "",
    slug: "",
    description: "",
    tagline: "",
    coverPhotoUrl: "",
    chapter: "knust",
    theme: DEFAULT_THEME,
    accent: "",
    status: "draft",
    companionSlug: "",
    mapQuery: "",
    schoolDefault: "",
    sessions: [blankSession()],
  };
}

function draftFrom(event: EventSummary): EventInput {
  const sessions = eventSessions(event);
  return {
    name: event.name,
    slug: event.slug,
    description: event.description ?? "",
    tagline: event.tagline ?? "",
    coverPhotoUrl: event.coverPhotoUrl ?? "",
    chapter: event.chapter ?? "global",
    theme: event.theme ?? DEFAULT_THEME,
    accent: event.accent ?? "",
    status: event.status,
    companionSlug: event.companionSlug ?? "",
    mapQuery: event.mapQuery ?? "",
    schoolDefault: event.schoolDefault ?? "",
    sessions: sessions.map((session) => ({
      // A single session is the event itself and is named after it.
      name: sessions.length > 1 ? session.name : "",
      startsAt: session.startsAt,
      location: session.location ?? "",
      locationUrl: session.locationUrl ?? "",
    })),
  };
}

function whenShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Accra",
  });
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cream/12 bg-[#0D0705]/70 p-5 backdrop-blur-sm sm:p-6">
      <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold uppercase">
        {title}
      </h2>
      {hint && <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-snug text-cream/45">{hint}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: EventSummary["status"] }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-sage">
      <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Live
    </span>
  ) : (
    <span className="text-[11.5px] text-cream/40">Draft</span>
  );
}

function SessionEditor({
  sessions,
  onChange,
}: {
  sessions: SessionDraft[];
  onChange: (sessions: SessionDraft[]) => void;
}) {
  const multi = sessions.length > 1;

  function update(index: number, patch: Partial<SessionDraft>) {
    onChange(sessions.map((session, i) => (i === index ? { ...session, ...patch } : session)));
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions.map((session, index) => (
        <div
          key={index}
          className={multi ? "rounded-xl border border-cream/10 bg-cream/[0.02] p-4" : undefined}
        >
          {multi && (
            <div className="mb-4 flex items-center justify-between">
              <span className="font-[family-name:var(--font-oswald)] text-[12px] tracking-[0.14em] text-cream/70 uppercase">
                Session {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(sessions.filter((_, i) => i !== index))}
                className="min-h-9 rounded px-2 text-[12.5px] text-cream/45 transition hover:text-coral focus-visible:outline-2 focus-visible:outline-gold"
              >
                Remove
              </button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {multi && (
              <div className="sm:col-span-2">
                <label className={label} htmlFor={`session-name-${index}`}>
                  Session name
                </label>
                <input
                  id={`session-name-${index}`}
                  className={field}
                  value={session.name}
                  placeholder="Sunday Service"
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className={label} htmlFor={`session-start-${index}`}>
                Starts (Accra time)
              </label>
              <input
                id={`session-start-${index}`}
                type="datetime-local"
                className={`${field} [color-scheme:dark]`}
                value={toPicker(session.startsAt)}
                onChange={(e) => update(index, { startsAt: fromPicker(e.target.value) })}
              />
            </div>
            <div>
              <label className={label} htmlFor={`session-venue-${index}`}>
                Venue
              </label>
              <input
                id={`session-venue-${index}`}
                className={field}
                value={session.location}
                placeholder="Engineering Auditorium (Kumapley)"
                onChange={(e) => update(index, { location: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor={`session-url-${index}`}>
                Venue map link <span className="normal-case tracking-normal text-cream/35">(optional)</span>
              </label>
              <input
                id={`session-url-${index}`}
                className={field}
                inputMode="url"
                value={session.locationUrl}
                placeholder="https://maps.app.goo.gl/…"
                onChange={(e) => update(index, { locationUrl: e.target.value })}
              />
              <p className={help}>Opened from the ticket and the emails.</p>
            </div>
          </div>
        </div>
      ))}

      {sessions.length < MAX_SESSIONS && (
        <button
          type="button"
          onClick={() => onChange([...sessions, blankSession()])}
          className="self-start rounded-xl border border-dashed border-cream/20 px-4 py-2.5 text-[13.5px] text-cream/60 transition hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-gold"
        >
          + Add another session
        </button>
      )}
      {multi && (
        <p className={help}>
          One registration and one QR ticket cover every session. To give each gathering its own
          registrations instead, make them separate events and link them as companions below.
        </p>
      )}
    </div>
  );
}

function ThemePicker({ value, onChange }: { value: string; onChange: (theme: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Look" className="grid gap-3 sm:grid-cols-3">
      {THEME_NAMES.map((name) => {
        const theme = themeFor(name);
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(name)}
            className={`flex flex-col items-start justify-start rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
              selected
                ? "border-gold/60 bg-gold/10 shadow-[inset_0_0_0_1px_var(--color-gold)]"
                : "border-cream/12 bg-cream/[0.03] hover:border-cream/30"
            }`}
          >
            <span className={`block font-[family-name:var(--font-anton)] text-[22px] uppercase ${selected ? "text-gold" : "text-cream"}`}>
              {theme.label}
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-cream/50">{theme.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

function AccentPicker({ value, onChange }: { value: string; onChange: (accent: string) => void }) {
  const effective = isAccent(value) ? value.toLowerCase() : HOUSE_GOLD;
  const low = accentContrast(effective) < 4.5;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Accent colour">
        {ACCENT_SWATCHES.map((swatch) => {
          const selected = effective === swatch.hex;
          return (
            <button
              key={swatch.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              title={swatch.name}
              aria-label={swatch.name}
              onClick={() => onChange(swatch.hex === HOUSE_GOLD ? "" : swatch.hex)}
              className={`h-10 w-10 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cream ${
                selected ? "ring-2 ring-cream ring-offset-3 ring-offset-[#0D0705]" : "hover:scale-110"
              }`}
              style={{ background: swatch.hex }}
            />
          );
        })}
        <label className="ml-1 flex h-10 items-center gap-2 rounded-full border border-cream/15 pr-3 pl-1 text-[13px] text-cream/60 focus-within:border-gold">
          <input
            type="color"
            value={effective}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Custom accent colour"
            className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          />
          <span className="font-mono text-[12.5px] tabular-nums">{effective}</span>
        </label>
      </div>
      <p className={help}>
        Tints labels, figures and buttons on the event page and on the staff tools while this
        event is selected.
      </p>
      {low && (
        <p className="mt-2 text-[12.5px] text-[#F2C1C6]">
          That colour is too dark to read on the event&apos;s dark pages. Pick something lighter.
        </p>
      )}
    </div>
  );
}

function FlyerField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  // Remembers which link failed, so typing a new one clears the error by itself.
  const [brokenUrl, setBrokenUrl] = useState("");
  const broken = Boolean(value) && brokenUrl === value;
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
      <div>
        <label className={label} htmlFor="flyer">
          Flyer
        </label>
        <input
          id="flyer"
          className={field}
          value={value}
          placeholder="/events/fire-night/cover.jpg"
          onChange={(e) => onChange(e.target.value)}
        />
        <p className={help}>
          A file in the site&apos;s <code className="text-cream/60">public/events/&lt;link&gt;/</code>{" "}
          folder (needs a site deploy), or an https:// link to an image. Leave it empty if there isn&apos;t
          one yet: the companion tick-box shows the event&apos;s details instead.
        </p>
      </div>
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-cream/12 bg-cream/[0.03] text-center text-[12px] text-cream/35">
        {value && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Flyer preview" className="h-full w-full object-cover" onError={() => setBrokenUrl(value)} />
        ) : (
          <span className="px-3">{value ? "Can't load that image" : "No flyer"}</span>
        )}
      </div>
    </div>
  );
}

function EventsTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventInput>(blankDraft);
  const [baseline, setBaseline] = useState<string>(JSON.stringify(blankDraft()));
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await getAllEvents();
        if (!active) return;
        setEvents(list);
        if (list.length > 0) open(list[0]);
      } catch (err) {
        if (active) setError(getCallableErrorMessage(err));
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = events.find((event) => event.id === selectedId) ?? null;
  const dirty = JSON.stringify(draft) !== baseline;
  const slugLocked = selected?.status === "published";

  function open(event: EventSummary | null) {
    const next = event ? draftFrom(event) : blankDraft();
    setSelectedId(event?.id ?? null);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setSlugTouched(Boolean(event));
    setError(null);
    setNotice(null);
  }

  function choose(event: EventSummary | null) {
    if (dirty && !window.confirm("Discard the changes you haven't saved?")) return;
    open(event);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function set<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setNotice(null);
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveEvent({ id: selectedId ?? undefined, event: draft });
      const list = await getAllEvents();
      setEvents(list);
      open(list.find((event) => event.id === saved.id) ?? saved);
      setNotice(
        selectedId
          ? "Saved."
          : saved.status === "published"
            ? "Event created and live."
            : "Event created as a draft."
      );
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const companions = useMemo(() => events.filter((event) => event.id !== selectedId), [events, selectedId]);
  // A companion that points back at this one is the working setup; say so
  // when it doesn't, since the tick-box only appears on the side that names it.
  const companion = companions.find((event) => event.slug === draft.companionSlug);
  const oneWay = companion && companion.companionSlug !== draft.slug;

  const preview = { theme: draft.theme, accent: isAccent(draft.accent) ? draft.accent : undefined };

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-[100svh] overflow-hidden bg-[#0D0705] font-sans text-cream`}
      style={accentStyle(preview)}
    >
      <StaffBackdrop event={ready ? preview : null} />

      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <StaffNav events={events} eventId={selectedId ?? ""} />

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-32 sm:px-8 sm:pt-16">
          <p className="font-[family-name:var(--font-oswald)] text-[12px] tracking-[0.18em] text-gold uppercase">
            Events
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-anton)] text-[clamp(40px,10vw,84px)] leading-[0.9] tracking-[-0.02em] text-cream uppercase">
            {draft.name.trim() || (selectedId ? "Untitled" : "New event")}
          </h1>
          {draft.tagline.trim() && (
            <p className="mt-2.5 font-[family-name:var(--font-oswald)] text-[14px] tracking-[0.12em] text-cream/70 uppercase">
              {draft.tagline}
            </p>
          )}

          {!ready && <p className="mt-8 text-sm text-cream/50">Loading…</p>}

          {ready && (
            <div className="mt-10 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
              <aside aria-label="All events" className="lg:sticky lg:top-24 lg:self-start">
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className={`mb-3 flex min-h-12 w-full items-center justify-center rounded-xl text-[14.5px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                    selectedId === null
                      ? "bg-gold text-[#2A0A0E]"
                      : "border border-gold/40 text-gold hover:bg-gold/10"
                  }`}
                >
                  + New event
                </button>
                <ul className="flex max-h-[50svh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-cream/12 bg-[#0D0705]/70 p-2 backdrop-blur-sm lg:max-h-[calc(100svh-12rem)]">
                  {events.length === 0 && (
                    <li className="px-3 py-6 text-center text-[13px] text-cream/40">No events yet.</li>
                  )}
                  {events.map((event) => {
                    const active = event.id === selectedId;
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => choose(event)}
                          aria-current={active ? "true" : undefined}
                          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-gold ${
                            active ? "bg-cream/[0.08]" : "hover:bg-cream/[0.04]"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: isAccent(event.accent) ? event.accent : HOUSE_GOLD }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-cream">{event.name}</span>
                            <span className="mt-0.5 flex items-center gap-2 text-[12px] text-cream/40">
                              {whenShort(event.startsAt)} · <StatusPill status={event.status} />
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              <form
                id="editor"
                className="flex scroll-mt-24 flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
              >
                <Section title="The basics">
                  <div>
                    <label className={label} htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      className={field}
                      value={draft.name}
                      placeholder="Fire Night"
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="slug">
                      Link
                    </label>
                    <div className="flex items-center rounded-xl border border-cream/15 bg-cream/[0.04] focus-within:border-gold">
                      <span className="pl-4 text-[15px] text-cream/35">/events/</span>
                      <input
                        id="slug"
                        className="h-11 min-w-0 flex-1 bg-transparent pr-4 text-[16px] text-cream outline-none disabled:opacity-50"
                        value={draft.slug}
                        disabled={slugLocked}
                        placeholder="fire-night"
                        onChange={(e) => {
                          setSlugTouched(true);
                          set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                        }}
                      />
                    </div>
                    <p className={help}>
                      {slugLocked
                        ? "Fixed while the event is live: people already have the link. Set it back to draft to change it."
                        : "Lowercase letters, numbers and hyphens. This goes on the flyer, so settle it before publishing."}
                    </p>
                  </div>
                  <div>
                    <label className={label} htmlFor="tagline">
                      Tagline <span className="normal-case tracking-normal text-cream/35">(optional)</span>
                    </label>
                    <input
                      id="tagline"
                      className={field}
                      value={draft.tagline}
                      placeholder="The Fire of God"
                      onChange={(e) => set("tagline", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="description">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={4}
                      className={`${field} h-auto py-3 leading-relaxed`}
                      value={draft.description}
                      placeholder="What people are coming to, in a sentence or two."
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="chapter">
                      Hosted by
                    </label>
                    <select
                      id="chapter"
                      className={`${field} [color-scheme:dark]`}
                      value={draft.chapter}
                      onChange={(e) => set("chapter", e.target.value as Chapter)}
                    >
                      {(Object.keys(CHAPTERS) as Chapter[]).map((key) => (
                        <option key={key} value={key} className="bg-[#22090a]">
                          {CHAPTERS[key].name}
                        </option>
                      ))}
                    </select>
                    <p className={help}>Sets the logo on the page and the sign-off in the emails.</p>
                  </div>
                </Section>

                <Section title="When and where">
                  <SessionEditor sessions={draft.sessions} onChange={(sessions) => set("sessions", sessions)} />
                  <div>
                    <label className={label} htmlFor="map">
                      Map on the page <span className="normal-case tracking-normal text-cream/35">(optional)</span>
                    </label>
                    <input
                      id="map"
                      className={field}
                      value={draft.mapQuery}
                      placeholder="MCFP+22R, Kumasi"
                      onChange={(e) => set("mapQuery", e.target.value)}
                    />
                    <p className={help}>
                      What to search Google Maps for. A plus code works best on campus: find the building
                      in Google Maps, tap it, and copy the code that looks like MCFP+22R.
                    </p>
                  </div>
                  <div>
                    <label className={label} htmlFor="school-default">
                      Pre-fill School with <span className="normal-case tracking-normal text-cream/35">(optional)</span>
                    </label>
                    <input
                      id="school-default"
                      className={field}
                      value={draft.schoolDefault}
                      placeholder="Tech"
                      onChange={(e) => set("schoolDefault", e.target.value)}
                    />
                    <p className={help}>
                      For an event on one campus. People can still change it on the form.
                    </p>
                  </div>
                </Section>

                <Section title="The look" hint="This page is showing it now. Nothing changes on the live event page until you save.">
                  <div>
                    <span className={label}>Event page</span>
                    <ThemePicker value={draft.theme} onChange={(theme) => set("theme", theme)} />
                  </div>
                  <div>
                    <span className={label}>Accent colour</span>
                    <AccentPicker value={draft.accent} onChange={(accent) => set("accent", accent)} />
                  </div>
                  <FlyerField value={draft.coverPhotoUrl} onChange={(url) => set("coverPhotoUrl", url)} />
                </Section>

                <Section
                  title="Companion event"
                  hint="Offer a tick-box on this event's form to register for another one too. Both registrations share one QR ticket."
                >
                  <div>
                    <label className={label} htmlFor="companion">
                      Also offer
                    </label>
                    <select
                      id="companion"
                      className={`${field} [color-scheme:dark]`}
                      value={draft.companionSlug}
                      onChange={(e) => set("companionSlug", e.target.value)}
                    >
                      <option value="" className="bg-[#22090a]">
                        Nothing
                      </option>
                      {companions.map((event) => (
                        <option key={event.id} value={event.slug} className="bg-[#22090a]">
                          {event.name} ({whenShort(event.startsAt)})
                        </option>
                      ))}
                    </select>
                    {oneWay && (
                      <p className={help}>
                        {companion.name} doesn&apos;t offer this event back. To get the tick-box on both
                        forms, open {companion.name} and pick this event there too.
                      </p>
                    )}
                  </div>
                </Section>

                <Section title="Status">
                  <div role="radiogroup" aria-label="Status" className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { value: "draft", title: "Draft", body: "Only staff can see it. Nobody can register." },
                        {
                          value: "published",
                          title: "Live",
                          body: "On the homepage and open for registration until the day after it ends.",
                        },
                      ] as const
                    ).map((option) => {
                      const on = draft.status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set("status", option.value)}
                          className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                            on ? "border-gold/60 bg-gold/10" : "border-cream/12 bg-cream/[0.03] hover:border-cream/30"
                          }`}
                        >
                          <span className={`block text-[15px] font-bold ${on ? "text-gold" : "text-cream"}`}>
                            {option.title}
                          </span>
                          <span className="mt-1 block text-[12.5px] leading-snug text-cream/50">{option.body}</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Pinned so Save is always one tap away on a long form. */}
                <div className="sticky bottom-0 z-20 -mx-4 border-t border-cream/10 bg-[#0D0705]/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving || (!dirty && Boolean(selectedId))}
                      className="inline-flex min-h-12 items-center rounded-full bg-gold px-7 text-[15px] font-bold text-[#2A0A0E] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cream disabled:opacity-40"
                    >
                      {saving ? "Saving…" : selectedId ? "Save changes" : "Create event"}
                    </button>
                    {selected && (
                      <Link
                        href={`/events/${selected.slug}`}
                        target="_blank"
                        className="inline-flex min-h-12 items-center rounded-full px-4 text-[14px] text-cream/60 transition hover:text-gold focus-visible:outline-2 focus-visible:outline-gold"
                      >
                        {selected.status === "published" ? "Open the event page ↗" : "Preview the page ↗"}
                      </Link>
                    )}
                    <p aria-live="polite" className="text-[13.5px]">
                      {error ? (
                        <span className="text-[#F2C1C6]">{error}</span>
                      ) : notice ? (
                        <span className="text-sage">{notice}</span>
                      ) : dirty && selectedId ? (
                        <span className="text-cream/45">Unsaved changes</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminEventsPage() {
  return (
    <AuthGuard>
      <EventsTool />
    </AuthGuard>
  );
}
