"use client";

import Link from "next/link";
import Image from "next/image";
import { Anton, IBM_Plex_Mono, Oswald } from "next/font/google";
import { SocialLinks } from "@/components/SocialLinks";
import type { EventSummary } from "@/lib/types";

/**
 * What an event page becomes once the event is over.
 *
 * Every hand-built event page is a sales pitch: fill the room, take the
 * registration. None of that is true any more the moment the doors close, and
 * a page that keeps asking for a registration nobody can use is worse than no
 * page at all — so a finished event swaps its whole register rather than
 * greying out a button. The ember palette stays, because it is still the same
 * gathering; what changes is that everything is stated in the past tense and
 * the one live thing left on the page is where to find Love Inc next.
 *
 * Shared by every slug on purpose. The themed pages exist to make people come;
 * once nobody can, there is nothing left for a per-event theme to do.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const ACCRA = "Africa/Accra";

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ACCRA,
  });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ACCRA,
  });
}

/** Section label, in the archive's printed voice. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.16em] text-cream/35 uppercase">
      {children}
    </p>
  );
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

export function PastEventView({ event }: { event: EventSummary }) {
  return (
    <div
      className={`${anton.variable} ${oswald.variable} ${plexMono.variable} min-h-[100svh] bg-[#0D0705] font-sans text-cream`}
    >
      <header className="border-b border-cream/8">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-3.5 sm:px-8">
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
            href="/events"
            className="flex min-h-11 items-center rounded font-[family-name:var(--font-plex-mono)] text-[12px] tracking-[0.08em] text-cream/45 uppercase transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            All gatherings
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-24">
        <p className="font-[family-name:var(--font-plex-mono)] text-[12px] tracking-[0.14em] text-gold/80 uppercase">
          Held &middot; {fullDate(event.startsAt)}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-anton)] text-[clamp(52px,15vw,132px)] leading-[0.86] tracking-[-0.02em] text-cream uppercase">
          {event.name}
        </h1>
        <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-cream/50 sm:text-[17.5px]">
          This gathering has ended. Registration is closed and the tickets are spent — what&rsquo;s
          below is the record of it.
        </p>

        <div className="mt-12 grid gap-10 sm:mt-14 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-14">
          {/* The flyer, kept as the stub it became. */}
          <div>
            <div className="relative overflow-hidden rounded-[18px] bg-[#1A100E] ring-1 ring-cream/10">
              {event.coverPhotoUrl ? (
                <Image
                  src={event.coverPhotoUrl}
                  alt={`${event.name} flyer`}
                  width={680}
                  height={850}
                  priority
                  sizes="(max-width: 1024px) 88vw, 340px"
                  className="h-auto w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center p-6 text-center">
                  <span className="font-[family-name:var(--font-anton)] text-[44px] leading-none text-cream/30 uppercase">
                    {event.name}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-3 font-[family-name:var(--font-plex-mono)] text-[11.5px] tracking-[0.08em] text-cream/30 uppercase">
              Flyer &middot; {event.name}
            </p>
          </div>

          <div className="flex flex-col gap-9">
            <div>
              <Label>When it was</Label>
              <p className="mt-2 font-[family-name:var(--font-oswald)] text-[21px] font-medium text-cream sm:text-[23px]">
                {fullDate(event.startsAt)}
              </p>
              <p className="mt-0.5 text-[15.5px] text-cream/50">Doors at {time(event.startsAt)}</p>
            </div>

            {event.location && (
              <div>
                <Label>Where it was</Label>
                <p className="mt-2 font-[family-name:var(--font-oswald)] text-[21px] font-medium text-cream sm:text-[23px]">
                  {event.location}
                </p>
                {event.locationUrl && (
                  <a
                    href={event.locationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="-my-1 inline-flex min-h-11 items-center rounded text-[14.5px] font-semibold text-gold underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    Open in Maps &#8599;
                  </a>
                )}
              </div>
            )}

            {event.description && (
              <div>
                <Label>What it was</Label>
                <p className="mt-2 max-w-[60ch] text-[16.5px] leading-[1.7] whitespace-pre-line text-cream/70">
                  {event.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* The tear line, carried across the page: the same edge as the stub. */}
        <hr className="mt-14 border-0 border-t border-dashed border-cream/18 sm:mt-18" />

        <section className="mt-10 sm:mt-12">
          <h2 className="font-[family-name:var(--font-oswald)] text-[clamp(24px,5vw,32px)] leading-tight font-semibold text-cream">
            A gathering ends, the family doesn&rsquo;t
          </h2>
          <p className="mt-2 max-w-[52ch] text-[15.5px] leading-relaxed text-cream/50">
            Here&rsquo;s where Love Inc is in between — and where the next one gets announced.
          </p>
          <div className="mt-6">
            <SocialLinks />
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-14">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-coral px-6 text-[15px] font-bold text-white transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
          >
            See what&rsquo;s on now
          </Link>
          <Link
            href="/events"
            className="inline-flex min-h-11 items-center rounded text-[14.5px] font-semibold text-cream/50 underline-offset-4 transition hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Every gathering so far
          </Link>
        </div>
      </main>
    </div>
  );
}
