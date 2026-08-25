"use client";

import Link from "next/link";
import { Anton, Oswald } from "next/font/google";
import type { EventSummary } from "@/lib/types";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FireBackground } from "@/components/FireBackground";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Example / template event page. Copy this folder for each new event and
 * swap the theme (colors, cover art, copy) — the registration mechanics
 * (validation, duplicate check, QR + email) live in RegistrationForm and
 * don't change per event.
 *
 * The event arrives resolved from `EventGate`, which fetches it, handles the
 * loading and error states, and sends finished events to the archive view
 * instead. This page only ever draws an event that is still open.
 */
export default function ReviveEventPage({ event }: { event: EventSummary }) {
  return (
    <div className={`${anton.variable} ${oswald.variable} min-h-[100svh] bg-[#0D0705] font-sans`}>
      <section className="relative flex min-h-[100svh] flex-col items-center overflow-hidden">
        {/* Gradient + brightness/scale pulse live on their own layer — `filter` on
            an ancestor of the badge image would isolate it into a new stacking
            context and break its mix-blend-mode against this background. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_105%,#7a1f24_0%,#3a0f12_32%,#170807_60%,#0D0705_85%)] motion-safe:animate-[hero-glow_8s_ease-in-out_infinite]" />
        <div
          className="pointer-events-none absolute inset-0 motion-safe:animate-[ember-drift_9s_ease-in-out_infinite]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 25%, rgba(230,100,60,0.28) 0, transparent 1.4%), radial-gradient(circle at 78% 15%, rgba(230,100,60,0.24) 0, transparent 1.2%), radial-gradient(circle at 88% 55%, rgba(230,100,60,0.3) 0, transparent 1%), radial-gradient(circle at 10% 68%, rgba(230,100,60,0.26) 0, transparent 1.3%), radial-gradient(circle at 30% 85%, rgba(230,100,60,0.22) 0, transparent 1%), radial-gradient(circle at 65% 78%, rgba(230,100,60,0.25) 0, transparent 1.1%)",
          }}
        />
        <FireBackground />

        <div className="relative z-10 flex min-h-[100svh] w-full flex-col items-center justify-center gap-7 px-5 pt-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] pb-12 text-center sm:gap-10 sm:pt-32 sm:pb-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/love-inc-globe-white.png"
            alt="Love Inc Global · Est. 2022"
            className="block w-20 sm:w-28"
          />

          <div>
            <div className="font-[family-name:var(--font-anton)] text-[clamp(76px,24vw,190px)] leading-[0.86] tracking-[-0.03em] text-[#FBF3E7] uppercase">
              {event.name}
            </div>
            <div className="mt-2.5 font-[family-name:var(--font-oswald)] text-[clamp(15px,3vw,21px)] font-semibold tracking-[0.14em] text-[#FBF3E7] uppercase">
              The Fire of God
            </div>
          </div>

          <div className="font-[family-name:var(--font-anton)] text-[clamp(20px,4.5vw,34px)] tracking-[0.01em] text-[#FBF3E7] uppercase">
            {formatDate(event.startsAt)}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#170807,#0D0705)] px-5 pt-14 pb-20 sm:pt-16 sm:pb-24">
        <div className="mx-auto max-w-[760px]">
          <div className="mb-3 text-sm font-bold tracking-[0.12em] text-gold uppercase">About</div>
          <div className="mb-4 font-[family-name:var(--font-oswald)] text-[clamp(27px,7.5vw,38px)] leading-tight font-semibold text-[#FBF3E7]">
            What to expect
          </div>
          <div className="mb-9 max-w-[62ch] text-[16.5px] leading-[1.7] whitespace-pre-line text-[#FBF3E7]/70 sm:text-lg">
            {event.description}
          </div>

          <div className="mb-12 flex flex-col gap-4 sm:mb-14">
            <div className="flex items-start gap-3.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="#D9A441" strokeWidth="1.6" />
                <path
                  d="M3 9H21M8 3V6M16 3V6"
                  stroke="#D9A441"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-[16.5px] text-[#FBF3E7] sm:text-lg">
                {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
              </div>
            </div>
            {event.location && (
              <div className="flex items-start gap-3.5">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-1 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M12 21C12 21 19 14.5 19 9.5C19 5.36 15.64 2 12 2C8.36 2 5 5.36 5 9.5C5 14.5 12 21 12 21Z"
                    stroke="#D9A441"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="9.5" r="2.4" stroke="#D9A441" strokeWidth="1.6" />
                </svg>
                {event.locationUrl ? (
                  <a
                    href={event.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-[16.5px] text-[#FBF3E7] underline decoration-gold/40 underline-offset-4 transition hover:decoration-gold sm:text-lg"
                  >
                    {event.location}
                    <span className="ml-2 text-sm whitespace-nowrap text-gold">
                      View map ↗
                    </span>
                  </a>
                ) : (
                  <div className="text-[16.5px] text-[#FBF3E7] sm:text-lg">{event.location}</div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <RegistrationForm
              eventId={event.id}
              eventName={event.name}
              eventStartsAt={event.startsAt}
              eventLocation={event.location}
              eventLocationUrl={event.locationUrl}
              theme="revive"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#FBF3E7]/10 px-5 pt-8 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] text-center">
        <Link href="/" className="inline-block min-h-11 rounded px-4 py-3 text-[13.5px] text-[#FBF3E7]/50 transition hover:text-[#f0be6a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          ← Back to LoveGate
        </Link>
      </footer>
    </div>
  );
}
