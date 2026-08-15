"use client";

import { useEffect, useState } from "react";
import { searchRegistrations, checkInByRegistrationId, getCallableErrorMessage } from "@/lib/functions";
import type { Registration } from "@/lib/types";

export function CheckinSearch({ eventId }: { eventId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Registration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const handle = setTimeout(() => {
      if (!trimmed) {
        setResults([]);
        return;
      }
      searchRegistrations({ eventId, query: trimmed })
        .then(setResults)
        .catch((err) => setError(getCallableErrorMessage(err)));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, eventId]);

  async function handleCheckIn(registration: Registration) {
    setBusyId(registration.id);
    setError(null);
    setMessage(null);
    try {
      const result = await checkInByRegistrationId({ eventId, registrationId: registration.id });
      setMessage(
        result.outcome === "already_checked_in"
          ? `${result.registration.name} was already checked in.`
          : `${result.registration.name} checked in.`
      );
      setResults((prev) => prev.map((r) => (r.id === result.registration.id ? result.registration : r)));
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 py-3 font-sans text-[15px] text-cream placeholder:text-cream/35 outline-none focus:border-gold"
      />
      {message && (
        <p className="mt-3 flex items-center gap-2 rounded-[10px] border border-sage/35 bg-sage/15 px-4 py-2.5 text-sm text-sage">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sage" />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-[10px] border border-coral/40 bg-coral/15 px-4 py-2.5 text-sm text-[#F2C1C6]">
          {error}
        </p>
      )}
      <ul className="mt-4 divide-y divide-cream/10 overflow-hidden rounded-[10px] border border-cream/12 bg-cream/[0.04]">
        {results.map((registration) => (
          <li key={registration.id} className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[15px] font-medium text-cream">{registration.name}</p>
              <p className="text-[13px] text-cream/50">{registration.email}</p>
            </div>
            {registration.status === "checked_in" ? (
              <span className="rounded-full border border-sage/35 bg-sage/15 px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-sage uppercase">
                Checked in
              </span>
            ) : (
              <button
                onClick={() => handleCheckIn(registration)}
                disabled={busyId === registration.id}
                className="rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-[#1A0D0A] hover:brightness-105 disabled:opacity-50"
              >
                {busyId === registration.id ? "Checking in…" : "Check in"}
              </button>
            )}
          </li>
        ))}
        {query.trim() && results.length === 0 && (
          <li className="px-4 py-3.5 text-sm text-cream/45">No matches.</li>
        )}
      </ul>
    </div>
  );
}
