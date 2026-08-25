"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Anton, IBM_Plex_Mono } from "next/font/google";
import { PastEventStub, STUB_GROUND } from "@/components/PastEventStub";
import { getPastEvents, getPublishedEvents, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

/**
 * The archive.
 *
 * The homepage answers "what's next" and has to stay pointed at that. This
 * page answers "what has Love Inc actually done", which is a slower question
 * asked by someone who wasn't there — a first-timer deciding whether to come,
 * or someone who was and wants the flyer back. So it is laid out as a shelf of
 * kept stubs rather than a list of links.
 *
 * Anything still open is a single line at the top, not a section: a visitor who
 * arrives here from a finished event needs a way back to the live one, but the
 * archive should not start by talking about something else.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const ACCRA = "Africa/Accra";

function yearOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", timeZone: ACCRA });
}

/** "3 GATHERINGS · 2025–2026" — the shape of the shelf, in one printed line. */
function registerLine(events: EventSummary[]): string {
  const count = `${events.length} ${events.length === 1 ? "GATHERING" : "GATHERINGS"}`;
  if (events.length === 0) return count;
  const years = events.map((event) => yearOf(event.startsAt));
  const first = years[years.length - 1];
  const last = years[0];
  return `${count} · ${first === last ? first : `${first}–${last}`}`;
}

function GateMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
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

export default function EventsArchivePage() {
  const [past, setPast] = useState<EventSummary[] | null>(null);
  const [open, setOpen] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPastEvents()
      .then(setPast)
      .catch((err) => setError(getCallableErrorMessage(err)));
    // The open-events strip is a courtesy, not the page. If it fails the
    // archive still renders, so this failure is deliberately not surfaced.
    getPublishedEvents()
      .then(setOpen)
      .catch(() => setOpen([]));
  }, []);

  const next = open[0];

  return (
    <div
      className={`${anton.variable} ${plexMono.variable} min-h-[100svh] font-sans text-cream`}
      style={{ background: STUB_GROUND }}
    >
      <header className="border-b border-cream/8">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3.5 sm:px-8">
          <Link
            href="/"
            className="-ml-1 flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-cream transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral text-cream">
              <GateMark className="h-4.5 w-4.5" />
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.035em]">LoveGate</span>
          </Link>
          <Link
            href="/login"
            className="flex min-h-11 items-center rounded font-[family-name:var(--font-plex-mono)] text-[12px] tracking-[0.08em] text-cream/40 uppercase transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Staff
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-24">
        {next && (
          <Link
            href={`/events/${next.slug}`}
            className="group mb-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-coral/35 bg-coral/10 px-4 py-3.5 transition hover:border-coral/60 hover:bg-coral/15 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold sm:mb-12"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-coral opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral" />
            </span>
            <span className="text-[15px] font-bold text-cream">{next.name} is open now</span>
            <span className="font-[family-name:var(--font-plex-mono)] text-[12.5px] text-gold transition group-hover:translate-x-0.5 motion-reduce:transition-none">
              GET A TICKET &rarr;
            </span>
          </Link>
        )}

        <h1 className="font-[family-name:var(--font-anton)] text-[clamp(46px,12vw,104px)] leading-[0.88] tracking-[-0.02em] text-cream uppercase">
          Gatherings
        </h1>
        <p className="mt-3.5 font-[family-name:var(--font-plex-mono)] text-[12px] tracking-[0.14em] text-gold/75">
          {past ? registerLine(past) : "LOADING…"}
        </p>
        <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-cream/50">
          Every Love Inc gathering that has already happened, with the flyer, the date and where it
          was.
        </p>

        {error ? (
          <p className="mt-12 rounded-2xl border border-coral/35 bg-coral/10 px-5 py-4 text-[15px] text-cream/75">
            {error}
          </p>
        ) : !past ? (
          <div aria-busy className="mt-12 flex flex-wrap gap-5">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="w-full animate-pulse rounded-[18px] bg-cream/[0.04] pb-24 sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]"
              >
                <div className="aspect-[4/5] rounded-[18px] bg-cream/[0.03]" />
              </div>
            ))}
            <p className="sr-only">Loading past gatherings</p>
          </div>
        ) : past.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-cream/15 px-6 py-14 text-center">
            <p className="text-[16.5px] font-semibold text-cream">Nothing in the archive yet</p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-cream/45">
              Once a gathering has happened it&rsquo;s kept here, flyer and all.
            </p>
          </div>
        ) : (
          <ul className="mt-12 flex flex-wrap gap-5">
            {past.map((event) => (
              <li
                key={event.id}
                className="w-full sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]"
              >
                <PastEventStub event={event} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
