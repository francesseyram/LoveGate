"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Big_Shoulders, Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getPublishedEvents, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";
import { eventHomeCards } from "@/events/registry";

/**
 * LoveGate homepage.
 *
 * The concept is that the page *is* the ticket. This system's whole vocabulary
 * is already threshold language — gate, admit one, check-in, stub — so instead
 * of a generic landing page the homepage presents itself as a printed
 * admission ticket lying on a dark board: a poster panel for the next
 * gathering, a perforated tear line, and a stub carrying the practical details
 * and the way in. Typefaces are the system's own (condensed signage + mono
 * stub data) rather than any single event's, which keeps the frame neutral
 * enough for a hand-built event page to still feel like its own brand.
 */

// next/font has no metric overrides published for Big Shoulders, so it can't
// synthesise a matched fallback — an explicit condensed stack keeps the swap
// from reflowing the hero.
const poster = Big_Shoulders({
  variable: "--font-big-shoulders",
  weight: ["500", "700", "800", "900"],
  subsets: ["latin"],
  fallback: ["Haettenschweiler", "Impact", "Arial Narrow", "sans-serif"],
});
const grotesk = Schibsted_Grotesk({
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const stubMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

/**
 * The data model has no `endsAt`, so "still on" is an assumption: an event
 * stays current for six hours past its start, then drops off the page. That
 * keeps a finished gathering from advertising itself as open indefinitely.
 */
const ASSUMED_RUN_TIME_MS = 6 * 60 * 60 * 1000;

/**
 * A finished gathering shouldn't keep advertising itself as open, so the list
 * is trimmed to what a visitor can still turn up to, soonest first. Evaluated
 * once as the data lands rather than during render — the cutoff reads the
 * clock, and render has to stay pure.
 */
function toUpcoming(list: EventSummary[]): EventSummary[] {
  const cutoff = Date.now() - ASSUMED_RUN_TIME_MS;
  return list
    .filter((event) => new Date(event.startsAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

const ACCRA = "Africa/Accra";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ACCRA,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ACCRA,
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ACCRA,
  });
}

function stubRef(slug: string): string {
  return `LG-${slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8)}`;
}

/* -------------------------------------------------------------------------
   Ticket furniture
   ---------------------------------------------------------------------- */

/**
 * The page's one structural divider: a tear line whose punch-outs are cut
 * clean through the stock to the board behind it. Horizontal by default,
 * vertical from `lg` when the hero splits into poster + stub.
 */
function Perforation({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  if (orientation === "vertical") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden lg:block">
        <div className="h-full border-l-2 border-dashed border-ink/25" />
        {/* Smaller than the edge notches: these land where the vertical tear
            crosses the horizontal ones, so they read as punches at the
            intersections rather than bites out of the card. */}
        <span className="absolute -top-2.5 -left-2.5 h-5 w-5 rounded-full bg-board" />
        <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full bg-board" />
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none relative">
      <div className="border-t-2 border-dashed border-ink/25" />
      <span className="absolute -top-3.5 -left-3.5 h-7 w-7 rounded-full bg-board" />
      <span className="absolute -top-3.5 -right-3.5 h-7 w-7 rounded-full bg-board" />
    </div>
  );
}

function Eyebrow({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "gold" }) {
  return (
    <p
      className={`font-stub text-[10px] font-medium tracking-[0.22em] uppercase ${
        tone === "gold" ? "text-gold" : "text-ink/65"
      }`}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------
   Countdown
   ---------------------------------------------------------------------- */

/**
 * The wall clock is an external store, not React state — subscribing to it is
 * what keeps render pure and avoids a setState cascade every second. The
 * snapshot has to be cached rather than read live, since `useSyncExternalStore`
 * compares successive reads and `Date.now()` never equals itself.
 */
let clockSnapshot = 0;

function subscribeToClock(onTick: () => void): () => void {
  clockSnapshot = Date.now();
  const id = setInterval(() => {
    clockSnapshot = Date.now();
    onTick();
  }, 1000);
  return () => clearInterval(id);
}

function readClock(): number {
  return clockSnapshot;
}

/** 0 on the server and on the very first client read, which renders as a hold. */
function serverClock(): number {
  return 0;
}

function useNow(): number {
  return useSyncExternalStore(subscribeToClock, readClock, serverClock);
}

/**
 * Time left is the single most actionable fact on the page, so it gets the
 * display face at size. Units step down as the event closes in — days/hours/
 * minutes while it's far off, hours/minutes/seconds on the day itself — so
 * the ticking digit only appears when it actually means something.
 */
function Countdown({ startsAt }: { startsAt: string }) {
  const now = useNow();
  const target = useMemo(() => new Date(startsAt).getTime(), [startsAt]);

  if (now === 0) {
    return <div className="h-[86px]" aria-hidden />;
  }

  const diff = target - now;

  if (diff <= 0) {
    return (
      <div>
        <Eyebrow tone="gold">Happening now</Eyebrow>
        <p className="mt-2 font-poster text-[44px] leading-none font-extrabold tracking-tight text-coral uppercase">
          Doors are open
        </p>
      </div>
    );
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const units =
    days > 0
      ? [
          { value: days, label: days === 1 ? "day" : "days" },
          { value: hours, label: "hrs" },
          { value: minutes, label: "min" },
        ]
      : [
          { value: hours, label: "hrs" },
          { value: minutes, label: "min" },
          { value: seconds, label: "sec" },
        ];

  return (
    <div>
      <Eyebrow>Starts in</Eyebrow>
      {/* The digits retick every second, which would make a screen reader
          announce the block endlessly — the static date below carries the
          same information once. */}
      <div aria-hidden className="mt-2 flex items-end gap-5">
        {units.map((unit) => (
          <div key={unit.label}>
            <div className="font-poster text-[54px] leading-[0.82] font-extrabold tracking-tight tabular-nums text-ink">
              {String(unit.value).padStart(2, "0")}
            </div>
            <div className="font-stub mt-1.5 text-[10px] tracking-[0.18em] text-ink/60 uppercase">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">Starts on {formatFullDate(startsAt)}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Poster panel
   ---------------------------------------------------------------------- */

/**
 * The event's own cover art when it has one, otherwise a typographic poster
 * built from the name. `coverPhotoUrl` points at a file the repo may not have
 * yet, so a failed load quietly falls back rather than leaving a broken frame.
 */
function PosterPanel({ event }: { event: EventSummary }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = Boolean(event.coverPhotoUrl) && !coverFailed;

  return (
    <div className="relative flex min-h-[420px] flex-col justify-end overflow-hidden bg-char sm:min-h-[520px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,#7a1f24_0%,#3a0f12_34%,#170807_62%,#0d0705_88%)]" />

      {showCover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverPhotoUrl}
          alt=""
          onError={() => setCoverFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
      )}

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 26%, rgba(230,100,60,0.26) 0, transparent 1.3%), radial-gradient(circle at 79% 16%, rgba(230,100,60,0.22) 0, transparent 1.1%), radial-gradient(circle at 88% 58%, rgba(230,100,60,0.28) 0, transparent 0.9%), radial-gradient(circle at 12% 70%, rgba(230,100,60,0.24) 0, transparent 1.2%)",
        }}
      />

      {/* Foil sheen */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(251,243,231,0.13),transparent)] motion-safe:animate-[foil-sweep_11s_ease-in-out_infinite]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgba(13,7,5,0.86)_100%)]" />

      <div className="relative z-10 p-7 sm:p-9">
        <Eyebrow tone="gold">Next gathering</Eyebrow>
        <h1 className="font-poster mt-3 text-[clamp(58px,12vw,116px)] leading-[0.84] font-extrabold tracking-[-0.015em] text-cream uppercase">
          {event.name}
        </h1>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-cream/15 px-7 py-3.5 sm:px-9">
        <span className="font-stub text-[11px] tracking-[0.14em] text-gold uppercase">
          {formatDay(event.startsAt)} · {formatTime(event.startsAt)}
        </span>
        {event.location && (
          <>
            <span aria-hidden className="text-cream/25">
              /
            </span>
            <span className="font-stub text-[11px] tracking-[0.14em] text-cream/55 uppercase">
              {event.location}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Hero
   ---------------------------------------------------------------------- */

function NextGathering({ event }: { event: EventSummary }) {
  return (
    <section className="grid lg:grid-cols-[1.12fr_0.88fr]">
      <div className="motion-safe:animate-[rise-in_600ms_ease-out_both]">
        <PosterPanel event={event} />
      </div>

      <div className="relative">
        <Perforation orientation="vertical" />
        <div className="lg:hidden">
          <Perforation />
        </div>

        <div className="flex h-full flex-col justify-between gap-8 px-6 py-8 motion-safe:animate-[rise-in_600ms_ease-out_120ms_both] sm:px-8 sm:py-9">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-5">
              <div>
                <Eyebrow>When</Eyebrow>
                <p className="mt-1.5 text-[17px] leading-snug font-medium text-ink">
                  {formatFullDate(event.startsAt)}
                </p>
                <p className="text-[17px] leading-snug text-ink/70">
                  {formatTime(event.startsAt)}
                </p>
              </div>

              {event.location && (
                <div>
                  <Eyebrow>Where</Eyebrow>
                  <p className="mt-1.5 text-[17px] leading-snug font-medium text-ink">
                    {event.location}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-ink/12 pt-6">
              <Countdown startsAt={event.startsAt} />
            </div>
          </div>

          <div>
            <Link
              href={`/events/${event.slug}`}
              className="group flex h-14 w-full items-center justify-between gap-3 rounded-xl bg-coral px-6 text-cream transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold active:translate-y-px"
            >
              <span className="font-poster text-[22px] font-bold tracking-wide uppercase">
                Get your ticket
              </span>
              <span
                aria-hidden
                className="text-xl transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
            <div className="mt-3.5 flex items-center justify-between">
              <p className="font-stub text-[10px] tracking-[0.16em] text-ink/60 uppercase">
                Free · one ticket per person
              </p>
              <p className="font-stub text-[10px] tracking-[0.16em] text-ink/50 uppercase">
                {stubRef(event.slug)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   States
   ---------------------------------------------------------------------- */

function TicketMessage({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="px-6 py-16 text-center sm:px-10 sm:py-24">
      <Eyebrow tone="gold">{eyebrow}</Eyebrow>
      <h1 className="font-poster mx-auto mt-4 max-w-[16ch] text-[clamp(38px,8vw,64px)] leading-[0.9] font-extrabold tracking-tight text-ink uppercase">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-[42ch] text-[17px] leading-relaxed text-ink/70">{body}</p>
      {action && <div className="mt-7">{action}</div>}
    </section>
  );
}

function LoadingTicket() {
  return (
    <section aria-busy className="grid lg:grid-cols-[1.12fr_0.88fr]">
      <div className="min-h-[420px] animate-pulse bg-char/90 sm:min-h-[520px]" />
      <div className="relative">
        <Perforation orientation="vertical" />
        <div className="lg:hidden">
          <Perforation />
        </div>
        <div className="flex flex-col gap-5 px-6 py-9 sm:px-8">
          <div className="h-3 w-20 animate-pulse rounded-full bg-stock-deep" />
          <div className="h-6 w-52 animate-pulse rounded-full bg-stock-deep" />
          <div className="h-6 w-36 animate-pulse rounded-full bg-stock-deep" />
          <div className="mt-4 h-14 w-full animate-pulse rounded-xl bg-stock-deep" />
        </div>
      </div>
      <p className="sr-only">Loading gatherings</p>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Secondary sections
   ---------------------------------------------------------------------- */

/**
 * What a first-timer actually wants to know, which is not how a form works.
 * Every claim here is true of the system as built: entry is free, the phone
 * dedupe means one ticket per person, and the QR is both rendered on screen
 * and attached to the confirmation email.
 */
const BEFORE_YOU_COME = [
  {
    title: "Come as you are",
    body: "No dress code, no membership, nothing to pay. First time or fiftieth, the door is the same.",
  },
  {
    title: "Bring someone",
    body: "Tickets are one per person, so send your friend the link and they'll get their own to show at the door.",
  },
  {
    title: "Your phone is your ticket",
    body: "Show the QR code at the entrance and you're in. It's emailed to you as well, in case your battery doesn't make it.",
  },
];

function BeforeYouCome() {
  return (
    <section className="px-6 py-12 sm:px-10 sm:py-16">
      <Eyebrow tone="gold">Before you come</Eyebrow>
      <div className="mt-8 grid gap-9 sm:grid-cols-3 sm:gap-7">
        {BEFORE_YOU_COME.map((item) => (
          <div key={item.title}>
            <div aria-hidden className="mb-4 h-px w-9 bg-gold" />
            <h3 className="font-poster text-[26px] leading-none font-bold tracking-tight text-ink uppercase">
              {item.title}
            </h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink/70">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Compact stub for every gathering after the next one. */
function MiniStub({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-stretch overflow-hidden rounded-lg border border-ink/12 bg-stock-deep/45 transition hover:-translate-y-0.5 hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
    >
      <div className="flex w-[86px] shrink-0 flex-col items-center justify-center bg-char px-3 py-5 text-center">
        <div className="font-poster text-[34px] leading-none font-extrabold text-cream">
          {new Date(event.startsAt).toLocaleDateString("en-GB", {
            day: "numeric",
            timeZone: ACCRA,
          })}
        </div>
        <div className="font-stub mt-1 text-[10px] tracking-[0.16em] text-gold uppercase">
          {new Date(event.startsAt).toLocaleDateString("en-GB", {
            month: "short",
            timeZone: ACCRA,
          })}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4">
        <h3 className="font-poster truncate text-[24px] leading-none font-bold tracking-tight text-ink uppercase">
          {event.name}
        </h3>
        <p className="font-stub mt-1.5 truncate text-[10px] tracking-[0.14em] text-ink/65 uppercase">
          {formatTime(event.startsAt)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      <div
        aria-hidden
        className="flex items-center pr-4 text-lg text-ink/50 transition-transform group-hover:translate-x-1 group-hover:text-coral"
      >
        →
      </div>
    </Link>
  );
}

function AlsoComingUp({ events }: { events: EventSummary[] }) {
  return (
    <section className="px-6 py-12 sm:px-10 sm:py-16">
      <Eyebrow tone="gold">Also coming up</Eyebrow>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {events.map((event) => {
          // An event can ship a hand-built teaser of its own; the registry is
          // where a new one opts in.
          const Custom = eventHomeCards[event.slug];
          return Custom ? (
            <Custom key={event.id} event={event} />
          ) : (
            <MiniStub key={event.id} event={event} />
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Page
   ---------------------------------------------------------------------- */

export default function HomePage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(() => {
    getPublishedEvents()
      .then((list) => setEvents(toUpcoming(list)))
      .catch((err) => setError(getCallableErrorMessage(err)));
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function retry() {
    setError(null);
    setEvents(null);
    fetchEvents();
  }

  const [next, ...rest] = events ?? [];

  return (
    <div
      className={`${poster.variable} ${grotesk.variable} ${stubMono.variable} min-h-screen bg-board px-3 py-3 font-[family-name:var(--font-schibsted)] sm:px-6 sm:py-8`}
    >
      <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-2xl bg-stock text-ink shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
        {/* Paper grain — sells the card stock without tinting it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 opacity-[0.05] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <header className="flex items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <Link
            href="/"
            className="flex items-baseline gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            <span className="font-poster text-[26px] leading-none font-extrabold tracking-tight text-ink uppercase">
              Love<span className="text-coral">Gate</span>
            </span>
          </Link>
          <span className="font-stub text-[10px] tracking-[0.2em] text-ink/60 uppercase">
            Admit one · free entry
          </span>
        </header>

        <Perforation />

        {error ? (
          <TicketMessage
            eyebrow="Nothing loaded"
            title="Couldn't load gatherings"
            body="Check your connection, then load the page again."
            action={
              <>
                <button
                  onClick={retry}
                  className="font-poster h-12 rounded-xl bg-coral px-7 text-[19px] font-bold tracking-wide text-cream uppercase transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
                >
                  Try again
                </button>
                {/* The raw callable message, kept out of the main copy so the
                    guidance stays readable but the cause is still recoverable. */}
                <p className="font-stub mt-5 text-[11px] tracking-wide text-ink/50">{error}</p>
              </>
            }
          />
        ) : !events ? (
          <LoadingTicket />
        ) : !next ? (
          <TicketMessage
            eyebrow="Between gatherings"
            title="Nothing open right now"
            body="When the next gathering is announced, it shows up here first."
          />
        ) : (
          <NextGathering event={next} />
        )}

        <Perforation />
        <BeforeYouCome />

        {rest.length > 0 && (
          <>
            <Perforation />
            <AlsoComingUp events={rest} />
          </>
        )}

        <Perforation />

        <footer className="flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/love-inc-legon-badge.png"
              alt=""
              className="h-9 w-9 object-contain opacity-70"
            />
            <div>
              <p className="text-[13px] font-medium text-ink/70">Love Inc Legon</p>
              <p className="font-stub text-[10px] tracking-[0.16em] text-ink/60 uppercase">
                Est. 2025
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="font-stub rounded text-[10px] tracking-[0.18em] text-ink/60 uppercase underline-offset-4 transition hover:text-coral hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            Staff sign-in
          </Link>
        </footer>
      </div>
    </div>
  );
}
