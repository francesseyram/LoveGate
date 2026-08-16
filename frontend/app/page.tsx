"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getPublishedEvents, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

/**
 * LoveGate homepage.
 *
 * The featured event's own flyer carries the page: it runs full-bleed as a
 * darkened, blurred backdrop with the crisp artwork sitting on top, so the
 * hero fills the viewport instead of floating as a narrow column. Everything
 * below returns to a light, wide container. A visitor arrives from a shared
 * link and needs the what, when, where and the way in, in that order.
 */

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

/**
 * The data model has no `endsAt`, so "still on" is an assumption: an event
 * stays listed for six hours past its start, then drops off. That keeps a
 * finished gathering from advertising itself as open indefinitely.
 */
const ASSUMED_RUN_TIME_MS = 6 * 60 * 60 * 1000;

const ACCRA = "Africa/Accra";

/** Soonest first, with anything already over removed. */
function toUpcoming(list: EventSummary[]): EventSummary[] {
  const cutoff = Date.now() - ASSUMED_RUN_TIME_MS;
  return list
    .filter((event) => new Date(event.startsAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function fmt(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: ACCRA, ...options });
}

const timeOf = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });
const weekdayOf = (iso: string) => fmt(iso, { weekday: "short" });
const dayOf = (iso: string) => fmt(iso, { day: "numeric" });
const monthOf = (iso: string) => fmt(iso, { month: "short" });
const fullDateOf = (iso: string) =>
  fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Calendar day in Accra, so events group by the local date people experience. */
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ACCRA });
}

function groupByDay(events: EventSummary[]): Array<{ key: string; events: EventSummary[] }> {
  const groups: Array<{ key: string; events: EventSummary[] }> = [];
  for (const event of events) {
    const key = dayKey(event.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}

/* -------------------------------------------------------------------------
   Clock
   ---------------------------------------------------------------------- */

/**
 * The wall clock is an external store rather than React state, which keeps
 * render pure and avoids a setState cascade every tick. The snapshot is
 * cached because `useSyncExternalStore` compares successive reads and
 * `Date.now()` never equals itself.
 */
let clockSnapshot = 0;

function subscribeToClock(onTick: () => void): () => void {
  clockSnapshot = Date.now();
  const id = setInterval(() => {
    clockSnapshot = Date.now();
    onTick();
  }, 30_000);
  return () => clearInterval(id);
}

const readClock = () => clockSnapshot;
const serverClock = () => 0;

function useNow(): number {
  return useSyncExternalStore(subscribeToClock, readClock, serverClock);
}

function countdownLabel(startsAt: string, now: number): string | null {
  if (now === 0) return null;
  const diff = new Date(startsAt).getTime() - now;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (diff <= 0) return "Happening now";
  if (days >= 1) return `In ${days} ${days === 1 ? "day" : "days"}`;
  if (hours >= 1) return `In ${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `In ${Math.max(minutes, 1)} min`;
}

/* -------------------------------------------------------------------------
   Cover art
   ---------------------------------------------------------------------- */

/**
 * Real flyer art when the event has it. Events without artwork fall back to a
 * warm gradient picked deterministically from the slug, so a given event
 * always wears the same colours everywhere it appears rather than looking
 * broken.
 */
const COVER_THEMES = [
  "linear-gradient(150deg,#7A1F24 0%,#B23A48 48%,#2A0D10 100%)",
  "linear-gradient(150deg,#8F5A12 0%,#D9A441 52%,#3A2408 100%)",
  "linear-gradient(150deg,#43213F 0%,#8F2E5C 50%,#1B0C1A 100%)",
  "linear-gradient(150deg,#123F3A 0%,#2E7D6B 50%,#08211E 100%)",
];

function themeFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return COVER_THEMES[hash % COVER_THEMES.length];
}

function CoverArt({
  event,
  variant,
  onResolved,
}: {
  event: EventSummary;
  variant: "hero" | "thumb";
  onResolved?: (src: string | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(event.coverPhotoUrl) && !failed;
  const isHero = variant === "hero";

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundImage: themeFor(event.slug) }}
    >
      {showImage ? (
        <Image
          src={event.coverPhotoUrl}
          alt={`${event.name} flyer`}
          fill
          priority={isHero}
          sizes={isHero ? "(max-width: 1024px) 90vw, 420px" : "112px"}
          className="object-cover"
          onLoad={() => onResolved?.(event.coverPhotoUrl)}
          onError={() => {
            setFailed(true);
            onResolved?.(null);
          }}
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 22% 24%, rgba(255,255,255,0.16) 0, transparent 42%), radial-gradient(circle at 82% 76%, rgba(0,0,0,0.3) 0, transparent 46%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
            <span
              className={
                isHero
                  ? "text-[clamp(30px,5vw,52px)] leading-[0.95] font-extrabold tracking-[-0.03em] text-white/95 uppercase"
                  : "text-3xl font-extrabold text-white/90"
              }
            >
              {isHero ? event.name : event.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Icons
   ---------------------------------------------------------------------- */

type IconProps = { className?: string };

function GateMark({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 21V11a8 8 0 0 1 16 0v10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[18px] w-[18px] shrink-0 ${className}`}>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[18px] w-[18px] shrink-0 ${className}`}>
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TicketIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[18px] w-[18px] shrink-0 ${className}`}>
      <path
        d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Hero — full bleed
   ---------------------------------------------------------------------- */

function Hero({ event }: { event: EventSummary }) {
  // Only bleed real artwork; smearing the generated gradient behind itself
  // would just look like a rendering fault.
  const [bleed, setBleed] = useState<string | null>(null);
  const countdown = countdownLabel(event.startsAt, useNow());

  return (
    <section className="relative isolate overflow-hidden bg-[#120807]">
      {bleed && (
        <Image
          src={bleed}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="scale-125 object-cover opacity-35 blur-2xl"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(178,58,72,0.5)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,8,7,0.55)_0%,rgba(18,8,7,0.75)_60%,#120807_100%)]"
      />

      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-6 py-12 sm:px-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16 lg:py-20">
        <div className="mx-auto w-full max-w-[340px] lg:mx-0 lg:max-w-none">
          <Link
            href={`/events/${event.slug}`}
            tabIndex={-1}
            aria-hidden
            className="relative block aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-white/12 shadow-[0_50px_90px_-35px_rgba(0,0,0,0.95)] transition duration-300 hover:scale-[1.015]"
          >
            <CoverArt event={event} variant="hero" onResolved={setBleed} />
          </Link>
        </div>

        <div className="flex flex-col items-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.08em] text-white uppercase">
              <TicketIcon className="h-3.5 w-3.5" />
              Registration open
            </span>
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.08em] text-cream/80 uppercase">
              Free entry
            </span>
            {countdown && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.08em] text-cream/80 uppercase">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
                </span>
                {countdown}
              </span>
            )}
          </div>

          <h1 className="mt-5 text-[clamp(42px,6.5vw,78px)] leading-[0.98] font-extrabold tracking-[-0.045em] text-cream">
            {event.name}
          </h1>

          {event.description && (
            <p className="mt-4 line-clamp-3 max-w-[54ch] text-[17px] leading-relaxed text-cream/65">
              {event.description}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:gap-10">
            <div className="flex items-start gap-3">
              <CalendarIcon className="mt-0.5 text-gold" />
              <div>
                <p className="text-[15.5px] font-semibold text-cream">
                  {fullDateOf(event.startsAt)}
                </p>
                <p className="text-[14px] text-cream/55">{timeOf(event.startsAt)}</p>
              </div>
            </div>
            {event.location && (
              <div className="flex items-start gap-3">
                <PinIcon className="mt-0.5 text-gold" />
                <div>
                  <p className="text-[15.5px] font-semibold text-cream">{event.location}</p>
                  {event.locationUrl && (
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded text-[14px] text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/events/${event.slug}`}
            className="mt-9 inline-flex items-center gap-2.5 rounded-full bg-coral px-8 py-4 text-[17px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(178,58,72,0.9)] transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold active:translate-y-px"
          >
            Get your free ticket
            <span aria-hidden>→</span>
          </Link>
          <p className="mt-3 text-[13.5px] text-cream/45">
            Takes about a minute · no account needed
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Date-railed list
   ---------------------------------------------------------------------- */

function EventRow({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-[0_16px_36px_-22px_rgba(25,21,18,0.45)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-coral"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink/50">{timeOf(event.startsAt)}</p>
        <h3 className="mt-0.5 truncate text-[20px] leading-tight font-bold tracking-[-0.02em] text-ink">
          {event.name}
        </h3>
        {event.location && (
          <p className="mt-1.5 flex items-center gap-1.5 truncate text-[13.5px] text-ink/55">
            <PinIcon className="h-4 w-4" />
            <span className="truncate">{event.location}</span>
          </p>
        )}
      </div>
      <div className="relative h-[104px] w-[84px] shrink-0 overflow-hidden rounded-xl">
        <CoverArt event={event} variant="thumb" />
      </div>
    </Link>
  );
}

function UpcomingList({ events }: { events: EventSummary[] }) {
  return (
    <section className="mt-16">
      <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink">More gatherings</h2>
      <div className="mt-7 flex flex-col">
        {groupByDay(events).map((group) => {
          const first = group.events[0];
          return (
            <div
              key={group.key}
              className="grid grid-cols-[48px_1fr] gap-4 sm:grid-cols-[64px_1fr] sm:gap-6"
            >
              <div className="pt-4 text-center">
                <p className="text-[11px] font-bold tracking-[0.1em] text-ink/45 uppercase">
                  {weekdayOf(first.startsAt)}
                </p>
                <p className="text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink">
                  {dayOf(first.startsAt)}
                </p>
                <p className="text-[11px] font-bold tracking-[0.1em] text-ink/45 uppercase">
                  {monthOf(first.startsAt)}
                </p>
              </div>
              <div className="relative border-l border-line pb-6 pl-6">
                <span
                  aria-hidden
                  className="absolute top-7 -left-[4.5px] h-2 w-2 rounded-full bg-coral ring-4 ring-canvas"
                />
                <div className="grid gap-3 xl:grid-cols-2">
                  {group.events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Supporting sections
   ---------------------------------------------------------------------- */

/**
 * What a first-timer actually wonders. Every line is true of the system as
 * built: entry is free, the phone number dedupes to one ticket per person,
 * and the QR is both shown on screen and attached to the confirmation email.
 */
const GOOD_TO_KNOW = [
  {
    icon: <TicketIcon className="h-5 w-5" />,
    title: "Every ticket is free",
    body: "Nothing to pay, at registration or at the door. Come as you are — first time or fiftieth.",
  },
  {
    icon: <PinIcon className="h-5 w-5" />,
    title: "One ticket per person",
    body: "Bringing a friend? Send them the link so they get their own ticket to show at the door.",
  },
  {
    icon: <CalendarIcon className="h-5 w-5" />,
    title: "Your phone is your ticket",
    body: "Show the QR code at the entrance. It's emailed to you too, in case your battery doesn't last.",
  },
];

function GoodToKnow({ event }: { event?: EventSummary }) {
  return (
    <section className="mt-16">
      <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink">Before you come</h2>
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {GOOD_TO_KNOW.map((item) => (
          <div key={item.title} className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10 text-coral-dark">
              {item.icon}
            </div>
            <h3 className="mt-5 text-[17px] font-bold tracking-[-0.01em] text-ink">{item.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{item.body}</p>
          </div>
        ))}
      </div>

      {event?.location && (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink/70">
              <PinIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">Getting there</h3>
              <p className="mt-1 text-[14.5px] text-ink/60">{event.location}</p>
            </div>
          </div>
          {event.locationUrl && (
            <a
              href={event.locationUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full border border-line px-5 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            >
              Open in Maps
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------
   States
   ---------------------------------------------------------------------- */

function Placeholder({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-[#120807] px-6 py-28 text-center">
      <h1 className="text-[clamp(30px,5vw,44px)] font-extrabold tracking-[-0.035em] text-cream">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-cream/60">{body}</p>
      {action && <div className="mt-8">{action}</div>}
    </section>
  );
}

function HeroSkeleton() {
  return (
    <section aria-busy className="bg-[#120807]">
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-6 py-12 sm:px-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16 lg:py-20">
        <div className="mx-auto aspect-[4/5] w-full max-w-[340px] animate-pulse rounded-2xl bg-white/6 lg:mx-0 lg:max-w-none" />
        <div className="flex flex-col gap-5">
          <div className="h-7 w-52 animate-pulse rounded-full bg-white/6" />
          <div className="h-16 w-4/5 animate-pulse rounded-2xl bg-white/6" />
          <div className="h-4 w-full animate-pulse rounded-full bg-white/6" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/6" />
          <div className="mt-4 h-14 w-64 animate-pulse rounded-full bg-white/6" />
        </div>
      </div>
      <p className="sr-only">Loading gatherings</p>
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

  const [featured, ...rest] = events ?? [];

  return (
    <div
      className={`${jakarta.variable} min-h-screen bg-canvas font-[family-name:var(--font-plus-jakarta)] text-ink`}
    >
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral text-cream">
              <GateMark className="h-5 w-5" />
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.035em]">LoveGate</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-cream/60 transition hover:bg-white/10 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Staff sign-in
          </Link>
        </div>
      </header>

      <main>
        {error ? (
          <Placeholder
            title="Couldn't load gatherings"
            body="Check your connection, then try again."
            action={
              <>
                <button
                  onClick={retry}
                  className="rounded-full bg-coral px-7 py-3.5 text-[15px] font-bold text-white transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
                >
                  Try again
                </button>
                <p className="mt-4 text-[13px] text-cream/40">{error}</p>
              </>
            }
          />
        ) : !events ? (
          <HeroSkeleton />
        ) : !featured ? (
          <Placeholder
            title="No gatherings open right now"
            body="When the next one is announced it shows up here first. Check back soon."
          />
        ) : (
          <Hero event={featured} />
        )}

        <div className="mx-auto max-w-[1240px] px-6 pb-24 sm:px-8">
          {rest.length > 0 && <UpcomingList events={rest} />}
          <GoodToKnow event={featured} />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-6 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/love-inc-legon-badge.png"
              alt=""
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-[14.5px] font-bold tracking-[-0.01em] text-ink">Love Inc Legon</p>
              <p className="text-[13px] text-ink/50">Est. 2025</p>
            </div>
          </div>
          <p className="text-[13px] text-ink/45">University of Ghana, Legon</p>
        </div>
      </footer>
    </div>
  );
}
