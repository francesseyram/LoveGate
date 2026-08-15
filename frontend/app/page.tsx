"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedEvents, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";
import { eventHomeCards } from "@/events/registry";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STEPS = [
  {
    title: "1. Pick an event",
    description: "Browse what's coming up and choose the one you're going to.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="#D9A441" strokeWidth="1.8" />
        <path
          d="M3 9H21M8 3V6M16 3V6"
          stroke="#D9A441"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "2. Enter your details",
    description: "Just your name, phone and email — takes under a minute.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 21V11C4 6.58 7.58 3 12 3C16.42 3 20 6.58 20 11V21"
          stroke="#D9A441"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2.6" stroke="#D9A441" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "3. Show your ticket",
    description: "Your QR ticket lands on screen right away — just show it at the door.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="6" height="6" stroke="#D9A441" strokeWidth="1.8" />
        <rect x="14" y="4" width="6" height="6" stroke="#D9A441" strokeWidth="1.8" />
        <rect x="4" y="14" width="6" height="6" stroke="#D9A441" strokeWidth="1.8" />
        <path d="M15 15H20V20H15V15Z" stroke="#D9A441" strokeWidth="1.8" />
      </svg>
    ),
  },
];

function FallbackCard({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="block overflow-hidden rounded-[20px] border border-charcoal/10 bg-white p-6 shadow-[0_16px_32px_-18px_rgba(46,42,38,0.25)] transition hover:-translate-y-0.5"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="h-[7px] w-[7px] rounded-full bg-coral" />
        <div className="text-xs font-semibold tracking-wide text-coral uppercase">
          Registration open
        </div>
      </div>
      <div className="mb-1 font-display text-xl font-bold text-charcoal">{event.name}</div>
      <div className="text-sm text-charcoal/65">{formatDateTime(event.startsAt)}</div>
      {event.location && <div className="mb-3.5 text-sm text-charcoal/65">{event.location}</div>}
      <div className="text-sm font-bold text-coral">View event →</div>
    </Link>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedEvents()
      .then(setEvents)
      .catch((err) => setError(getCallableErrorMessage(err)));
  }, []);

  return (
    <main className="flex-1 bg-cream text-charcoal">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 21V11C4 6.58 7.58 3 12 3C16.42 3 20 6.58 20 11V21"
              stroke="#D9A441"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M4 21H20" stroke="#D9A441" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div className="font-display text-xl font-extrabold tracking-tight">
            Love<span className="text-coral">Gate</span>
          </div>
        </div>
        <div className="text-[13px] text-charcoal/55">Love Inc events</div>
      </header>

      <section className="relative overflow-hidden px-5 pt-7 pb-2">
        <div className="pointer-events-none absolute top-[-80px] left-[calc(50%-620px)] h-[340px] w-[340px] rounded-full bg-gold opacity-20 blur-[70px]" />
        <div className="pointer-events-none absolute top-5 left-[calc(50%+120px)] h-[280px] w-[280px] rounded-full bg-coral opacity-15 blur-[70px]" />
        <div className="relative mx-auto max-w-[1100px]">
          <h1 className="max-w-[560px] font-display text-[clamp(30px,6vw,48px)] leading-[1.08] font-extrabold tracking-tight text-balance">
            Find your next Love Inc gathering.
          </h1>
          <p className="mt-3.5 max-w-[460px] text-base leading-relaxed text-charcoal/70">
            Pick an event below and get your free ticket in under a minute. No app, no account —
            just your name, phone and email.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pt-9 pb-3">
        <div className="grid grid-cols-1 gap-5 border-y border-charcoal/10 py-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="flex flex-col gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.4px] border-gold">
                {step.icon}
              </div>
              <div className="font-display text-[15px] font-bold">{step.title}</div>
              <div className="text-[13px] leading-relaxed text-charcoal/60">{step.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pt-9 pb-20">
        <div className="mb-2 text-xs font-bold tracking-[0.12em] text-gold uppercase">
          Happening soon
        </div>
        <h2 className="mb-5 font-display text-2xl font-bold">Live events</h2>

        {error && <p className="text-sm text-coral">{error}</p>}
        {!events && !error && <p className="text-sm text-charcoal/60">Loading…</p>}
        {events && events.length === 0 && (
          <p className="text-sm text-charcoal/60">No events are open for registration right now.</p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events?.map((event) => {
            const Card = eventHomeCards[event.slug];
            return Card ? <Card key={event.id} event={event} /> : <FallbackCard key={event.id} event={event} />;
          })}
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2.5 border-t border-charcoal/10 px-5 py-7">
        <div className="text-[13px] text-charcoal/55">Love Inc Legon · Est. 2025</div>
        <div className="text-[13px] text-charcoal/40">Powered by LoveGate</div>
      </footer>
    </main>
  );
}
