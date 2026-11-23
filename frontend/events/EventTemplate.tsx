"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Anton, Oswald } from "next/font/google";
import type { EventSummary } from "@/lib/types";
import { RegistrationForm } from "@/components/RegistrationForm";
import { chapterOf, dayOf, eventSessions, shortWeekdayOf, timeOf } from "@/lib/eventShape";
import { SessionTicket, TICKET_GROUND } from "./SessionTicket";
import { themeFor } from "./themes";
import { accentStyle } from "@/lib/accent";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

/**
 * The title is set one word per line, as big as the longest word allows: an
 * event name is usually two or three words, and stacked at full width it's
 * the poster. Anton capitals run about half an em wide, so the longest word
 * gets ~88% of the viewport. A long name (four words or more) wraps normally
 * at a smaller size instead of becoming a tower.
 */
function titleStyle(name: string): { words: string[]; stacked: boolean; style: CSSProperties } {
  const words = name.trim().split(/\s+/);
  const stacked = words.length <= 3;
  const longest = Math.max(...words.map((word) => word.length));
  const size = stacked
    ? `clamp(56px, calc(88vw / ${(longest * 0.5).toFixed(2)}), 220px)`
    : "clamp(48px, 11vw, 120px)";
  return { words, stacked, style: { fontSize: size } };
}

/**
 * The venue on a live Google map, with a button that opens turn-by-turn
 * directions in the visitor's own Maps app. Uses the keyless embed, so there's
 * no API key to manage; `query` is best as a plus code, since campus
 * buildings rarely have street addresses Maps can find.
 *
 * Google's embed only comes in a light style, so it's inverted and hue-turned
 * back to sit on the dark page: roads go dark, water and parks keep their
 * colours roughly where they were.
 */
function VenueMap({ query, venue }: { query: string; venue?: string }) {
  const q = encodeURIComponent(query);
  return (
    <div className="mt-14">
      <div className="mb-3 text-sm font-bold tracking-[0.12em] text-gold uppercase">Getting there</div>
      {venue && (
        <p className="mb-5 max-w-[62ch] text-[16.5px] leading-[1.6] text-[#FBF3E7]/80 sm:text-lg">{venue}</p>
      )}
      <div className="overflow-hidden rounded-[22px] ring-1 ring-[#FBF3E7]/10">
        <iframe
          title={`Map: ${venue ?? query}`}
          src={`https://www.google.com/maps?q=${q}&z=17&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[320px] w-full border-0 [filter:invert(0.92)_hue-rotate(180deg)_saturate(0.8)] sm:h-[380px]"
        />
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#FBF3E7] px-6 text-[15px] font-bold text-[#56081A] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
      >
        Get directions <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

/**
 * The page every event gets, drawn entirely from its Firestore doc: name,
 * tagline, sessions, description, chapter (logo) and theme (hero atmosphere).
 * A new event needs a doc, not a page — `events/registry.tsx` is only for the
 * rare event that wants something this template can't do.
 *
 * Like every event page, it is handed a resolved, still-open event by
 * `EventGate` and never fetches.
 */
export default function EventTemplate({
  event,
  companion,
}: {
  event: EventSummary;
  /** A sister event the form offers to register for too; see `EventSummary.companionSlug`. */
  companion?: EventSummary | null;
}) {
  const sessions = eventSessions(event);
  const multi = sessions.length > 1;
  const chapter = chapterOf(event);
  const theme = themeFor(event.theme);
  const title = titleStyle(event.name);
  const [first, ...rest] = sessions;

  return (
    <div
      className={`${anton.variable} ${oswald.variable} min-h-[100svh] bg-[#0D0505] font-sans`}
      style={accentStyle(event)}
    >
      <section className="relative flex min-h-[100svh] flex-col items-center overflow-hidden">
        {theme.heroBackground}

        <div className="relative z-10 flex min-h-[100svh] w-full flex-col items-center justify-center gap-8 px-5 pt-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] pb-12 text-center sm:gap-10 sm:pt-32 sm:pb-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chapter.logo} alt={chapter.logoAlt} className="block w-24 sm:w-32" />

          <div>
            <h1
              className="font-[family-name:var(--font-anton)] leading-[0.84] tracking-[-0.03em] text-balance text-[#FBF3E7] uppercase"
              style={title.style}
            >
              {title.stacked
                ? title.words.map((word, index) => (
                    <span key={index} className="block">
                      {word}
                    </span>
                  ))
                : event.name}
            </h1>
            {event.tagline && (
              <p className="mt-3 font-[family-name:var(--font-oswald)] text-[clamp(15px,3vw,21px)] font-semibold tracking-[0.14em] text-[#FBF3E7]/85 uppercase">
                {event.tagline}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 font-[family-name:var(--font-oswald)] text-[clamp(15px,3.4vw,21px)] font-semibold tracking-[0.14em] text-[#FBF3E7] uppercase sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4">
            <span>
              {shortWeekdayOf(first.startsAt)} {dayOf(first.startsAt)} · {timeOf(first.startsAt)}
            </span>
            {rest.map((session) => (
              <span key={`${session.name}-${session.startsAt}`} className="flex items-center gap-4 text-[#F0BE6A]">
                <span aria-hidden>+</span>
                <span>
                  {session.name}, {shortWeekdayOf(session.startsAt)} {dayOf(session.startsAt)}
                </span>
              </span>
            ))}
          </div>

          <a
            href="#register"
            className="inline-flex min-h-12 items-center rounded-full bg-[#FBF3E7] px-7 text-[15px] font-bold text-[#56081A] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
          >
            Register
          </a>
        </div>
      </section>

      <section className="px-5 pt-16 pb-14 sm:pt-20 sm:pb-16" style={{ background: TICKET_GROUND }}>
        <div className="mx-auto max-w-[860px]">
          <div className="mb-3 text-sm font-bold tracking-[0.12em] text-gold uppercase">
            {multi
              ? `${NUMBER_WORDS[sessions.length] ?? sessions.length} gatherings, one ticket`
              : "The details"}
          </div>
          <h2 className="mb-4 font-[family-name:var(--font-oswald)] text-[clamp(27px,7vw,38px)] leading-tight font-semibold text-[#FBF3E7]">
            {multi
              ? `Register once. Your QR gets you into ${sessions.length === 2 ? "both" : `all ${sessions.length}`}.`
              : "What to expect"}
          </h2>
          {event.description && (
            <p className="mb-10 max-w-[62ch] text-[16.5px] leading-[1.7] whitespace-pre-line text-[#FBF3E7]/70 sm:text-lg">
              {event.description}
            </p>
          )}

          <SessionTicket sessions={sessions} />

          {event.mapQuery && <VenueMap query={event.mapQuery} venue={first.location} />}
        </div>
      </section>

      <section
        id="register"
        className="scroll-mt-6 bg-[linear-gradient(180deg,#120605,#0D0505)] px-5 pt-6 pb-20 sm:pb-24"
      >
        <div className="mx-auto flex max-w-[760px] justify-center">
          <RegistrationForm
            eventId={event.id}
            eventName={event.name}
            eventStartsAt={event.startsAt}
            eventLocation={event.location}
            eventLocationUrl={event.locationUrl}
            sessions={sessions}
            companion={companion ?? undefined}
            schoolDefault={event.schoolDefault}
            theme="revive"
          />
        </div>
      </section>

      <footer className="border-t border-[#FBF3E7]/10 px-5 pt-8 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] text-center">
        <Link
          href="/"
          className="inline-block min-h-11 rounded px-4 py-3 text-[13.5px] text-[#FBF3E7]/50 transition hover:text-[#f0be6a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          ← Back to LoveGate
        </Link>
      </footer>
    </div>
  );
}
