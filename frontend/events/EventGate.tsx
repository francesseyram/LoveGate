"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventPages } from "./registry";
import { PastEventView } from "./PastEventView";
import { FunctionsError } from "firebase/functions";
import { getEvent, getCallableErrorMessage } from "@/lib/functions";
import { isEventPast } from "@/lib/eventWindow";
import type { EventSummary } from "@/lib/types";

/**
 * Decides which version of an event page a visitor gets.
 *
 * Fetching moved up here from the individual event pages so this decision can
 * be made once, before anything is drawn. If each themed page kept fetching
 * for itself, a finished event would have to render its hero and its
 * registration form first and then admit the event was over — and every new
 * event page copied from the last would inherit the same fetch, loading state
 * and error handling to get wrong independently. Themed pages are now handed
 * a resolved event and do nothing but draw it.
 *
 * The registry is checked here rather than in the route, because whether a
 * hand-built page is required depends on something the route cannot know. A
 * finished event doesn't need one — the archive view is the same for all of
 * them — and the archive lists every past published event, including ones that
 * predate the registry or never got their own page. Checking the registry
 * first would have sent those to a 404 from their own archive card.
 */
export function EventGate({ slug }: { slug: string }) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEvent(slug)
      .then((next) => {
        if (!cancelled) setEvent(next);
      })
      .catch((err) => {
        if (cancelled) return;
        // No event with that slug is a 404, not something to apologise for.
        // Every other failure is the network or the server, and says so.
        if (err instanceof FunctionsError && err.code === "functions/not-found") {
          setMissing(true);
        } else {
          setError(getCallableErrorMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) {
    notFound();
  }

  if (error) {
    return (
      <main className="flex min-h-[100svh] flex-col items-center justify-center gap-5 bg-[#0D0705] px-6 text-center text-cream">
        <p className="max-w-[44ch] text-[16px] leading-relaxed text-cream/70">{error}</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full bg-coral px-6 text-[15px] font-bold text-white transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold"
        >
          Back to LoveGate
        </Link>
      </main>
    );
  }

  if (!event) {
    return (
      <main
        aria-busy
        className="flex min-h-[100svh] items-center justify-center bg-[#0D0705] text-sm text-cream/50"
      >
        Loading&hellip;
      </main>
    );
  }

  if (isEventPast(event.startsAt)) {
    return <PastEventView event={event} />;
  }

  // An open event with no hand-built page is a genuine gap — someone published
  // it without shipping the page — and there is nothing sensible to render.
  const Themed = eventPages[slug];
  if (!Themed) {
    notFound();
  }

  return <Themed event={event} />;
}
