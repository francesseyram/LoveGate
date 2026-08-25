"use client";

import { useEffect, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import { FireBackground } from "@/components/FireBackground";
import {
  getPublishedEvents,
  searchSelfCheckin,
  selfCheckIn,
  getCallableErrorMessage,
} from "@/lib/functions";
import type { EventSummary, SelfCheckinMatch } from "@/lib/types";

/**
 * Self check-in.
 *
 * Reached by scanning a QR at the venue, on a phone, by someone standing up and
 * probably in a queue. So: one input, big targets, no login, no scrolling to
 * find the thing you came for. Nothing here is shared with the staff console —
 * that page assumes a volunteer who can be trained, this one assumes nobody has
 * explained anything.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const REGISTER_URL = "/events/revive";
const MIN_QUERY = 3;

type Done = { name: string; alreadyIn: boolean };

export default function SelfCheckinPage() {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SelfCheckinMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await getPublishedEvents();
        setEvent(list[0] ?? null);
      } catch (err) {
        setError(getCallableErrorMessage(err));
      }
    })();
  }, []);

  useEffect(() => {
    if (!event) return;

    const trimmed = query.trim();
    const enough = trimmed.replace(/[^a-zA-Z0-9]/g, "").length >= MIN_QUERY;
    let cancelled = false;

    // Everything, including clearing stale results, happens inside the debounce
    // callback — updating state straight from the effect body would re-render
    // on every keystroke before the timer has even been set.
    const handle = setTimeout(() => {
      if (!enough) {
        setMatches([]);
        setSearched(false);
        setSearching(false);
        return;
      }

      setSearching(true);
      void (async () => {
        try {
          const result = await searchSelfCheckin({ eventId: event.id, query: trimmed });
          if (cancelled) return;
          setMatches(result.matches);
          setSearched(!result.needsMoreTyping);
          setError(null);
        } catch (err) {
          if (!cancelled) setError(getCallableErrorMessage(err));
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, event]);

  async function handleCheckIn(match: SelfCheckinMatch) {
    if (!event) return;
    setBusyKey(match.key);
    setError(null);
    try {
      const result = await selfCheckIn({ eventId: event.id, key: match.key });
      setDone({ name: result.name, alreadyIn: result.outcome === "already_checked_in" });
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  const typedEnough = query.trim().replace(/[^a-zA-Z0-9]/g, "").length >= MIN_QUERY;

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-lg flex-col px-5 pt-10 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
        {done ? (
          <Confirmation done={done} onAgain={() => { setDone(null); setQuery(""); }} />
        ) : (
          <>
            <header className="text-center">
              <p className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.18em] text-gold uppercase">
                {event?.name ?? "Loading…"}
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-anton)] text-[clamp(38px,11vw,58px)] leading-[0.95] tracking-[-0.01em] uppercase">
                Check yourself in
              </h1>
              <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-relaxed text-cream/60">
                Type your name, then tap it in the list.
              </p>
            </header>

            <div className="mt-8">
              <label htmlFor="self-search" className="sr-only">
                Your name
              </label>
              <input
                id="self-search"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="search"
                placeholder="Start typing your name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-16 w-full rounded-2xl border-[1.5px] border-gold/40 bg-cream/[0.06] px-5 text-[18px] text-cream placeholder:text-cream/30 outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
              />
              {!typedEnough && query.length > 0 && (
                <p className="mt-2.5 text-center text-[13px] text-cream/40">
                  Keep typing — at least {MIN_QUERY} letters.
                </p>
              )}
            </div>

            {error && (
              <p className="mt-5 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-center text-[14px] text-[#F2C1C6]">
                {error}
              </p>
            )}

            {typedEnough && (
              <div className="mt-6 flex-1">
                {searching && matches.length === 0 ? (
                  <p className="text-center text-[14px] text-cream/40">Looking…</p>
                ) : matches.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {matches.map((match) => (
                      <li key={match.key}>
                        <button
                          onClick={() => handleCheckIn(match)}
                          disabled={busyKey !== null || match.alreadyCheckedIn}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left transition ${
                            match.alreadyCheckedIn
                              ? "border-sage/30 bg-sage/10"
                              : "border-cream/15 bg-cream/[0.05] active:scale-[0.99] hover:border-gold/50 disabled:opacity-60"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[17px] font-semibold text-cream">
                              {match.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-cream/45">
                              {[match.campus, match.maskedPhone].filter(Boolean).join(" · ") ||
                                "No extra details"}
                            </span>
                          </span>
                          {match.alreadyCheckedIn ? (
                            <span className="shrink-0 font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.1em] text-sage uppercase">
                              Already in
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-[#1A0D0A]">
                              {busyKey === match.key ? "…" : "That's me"}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : searched ? (
                  <NoMatch />
                ) : null}

                {/* The list can be full of people and still not contain you.
                    Sits directly under the last row because that is where the
                    eye already is after reading the list — a link back up in
                    the header would never be found. */}
                {matches.length > 0 && <NoneOfThese />}
              </div>
            )}

            {/* Someone who already knows they never registered shouldn't have
                to type a name that won't be found just to reach the link. Kept
                quiet, and hidden once either card above is showing its own. */}
            {!typedEnough && (
              <div className="mt-auto pt-10 text-center">
                <a
                  href={REGISTER_URL}
                  className="inline-block text-[14px] text-cream/45 underline decoration-cream/25 underline-offset-4 transition hover:text-gold hover:decoration-gold/50"
                >
                  Never registered? Register here
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** Escape hatch for "the list is showing, but none of these people are me". */
function NoneOfThese() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-cream/20 px-5 py-5 text-center">
      <p className="text-[15px] font-semibold text-cream">None of these are me</p>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-[13.5px] leading-relaxed text-cream/50">
        Try your other name first — some people are listed by surname. If you&apos;ve never
        registered, do that instead.
      </p>
      <a
        href={REGISTER_URL}
        className="mt-4 inline-block rounded-full bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-6 py-3 text-[14px] font-bold tracking-wide text-[#1A0D0A] uppercase"
      >
        Register instead
      </a>
    </div>
  );
}

function NoMatch() {
  return (
    <div className="rounded-2xl border border-dashed border-cream/20 px-6 py-8 text-center">
      <p className="text-[16px] font-semibold text-cream">We can&apos;t find that name</p>
      <p className="mx-auto mt-2 max-w-[32ch] text-[14px] leading-relaxed text-cream/55">
        Try your other name — first or last. If you&apos;ve never registered, do it now, it takes
        under a minute.
      </p>
      <a
        href={REGISTER_URL}
        className="mt-5 inline-block rounded-full bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-7 py-3.5 text-[15px] font-bold tracking-wide text-[#1A0D0A] uppercase"
      >
        Register now
      </a>
    </div>
  );
}

function Confirmation({ done, onAgain }: { done: Done; onAgain: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full ${
          done.alreadyIn ? "bg-cream/10" : "bg-sage/20"
        }`}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 12.5 9.5 18 20 6"
            stroke={done.alreadyIn ? "#C6B49B" : "#93B183"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="mt-7 font-[family-name:var(--font-anton)] text-[clamp(40px,12vw,64px)] leading-[0.95] uppercase">
        {done.alreadyIn ? "Already in" : "You're in"}
      </h1>
      <p className="mt-3 text-[19px] font-semibold text-cream">{done.name}</p>
      <p className="mx-auto mt-3 max-w-[30ch] text-[15px] leading-relaxed text-cream/55">
        {done.alreadyIn
          ? "You were already checked in. Head on in and enjoy."
          : "You're checked in. Head on in and enjoy."}
      </p>

      <button
        onClick={onAgain}
        className="mt-10 rounded-full border border-cream/20 px-7 py-3 text-[14px] font-medium text-cream/70 transition hover:text-cream"
      >
        Check someone else in
      </button>
    </div>
  );
}
