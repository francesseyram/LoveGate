"use client";

import { useEffect, useState } from "react";
import type { RosterEntry } from "@/lib/offlineStore";
import type { CheckinOutcome } from "@/lib/useOfflineCheckin";

/**
 * Name/ticket-ref lookup against the locally cached roster, so the fallback
 * path when a phone is dead or a QR won't scan keeps working with no network.
 */
export function CheckinSearch({
  search,
  onCheckIn,
  disabled,
}: {
  search: (query: string) => RosterEntry[];
  onCheckIn: (entry: RosterEntry) => Promise<CheckinOutcome>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RosterEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setResults(search(query)), 150);
    return () => clearTimeout(handle);
  }, [query, search]);

  async function handleCheckIn(entry: RosterEntry) {
    setBusyId(entry.id);
    setMessage(null);
    try {
      const outcome = await onCheckIn(entry);
      if (outcome.result === "already_checked_in") {
        setMessage(`${outcome.name} was already checked in.`);
      } else if (outcome.result === "checked_in") {
        setMessage(`${outcome.name} checked in.${outcome.offline ? " (saved offline)" : ""}`);
      }
      setResults(search(query));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder={disabled ? "Loading attendee list…" : "Search by name or ticket code…"}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 py-3 font-sans text-[15px] text-cream placeholder:text-cream/35 outline-none focus:border-gold disabled:opacity-50"
      />
      {message && (
        <p className="mt-3 flex items-center gap-2 rounded-[10px] border border-sage/35 bg-sage/15 px-4 py-2.5 text-sm text-sage">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sage" />
          {message}
        </p>
      )}
      <ul className="mt-4 divide-y divide-cream/10 overflow-hidden rounded-[10px] border border-cream/12 bg-cream/[0.04]">
        {results.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-cream">{entry.name}</p>
              <p className="truncate text-[13px] text-cream/50">{entry.ticketRef}</p>
            </div>
            {entry.status === "checked_in" ? (
              <span className="shrink-0 rounded-full border border-sage/35 bg-sage/15 px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-sage uppercase">
                Checked in
              </span>
            ) : (
              <button
                onClick={() => handleCheckIn(entry)}
                disabled={busyId === entry.id}
                className="shrink-0 rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-[#1A0D0A] hover:brightness-105 disabled:opacity-50"
              >
                {busyId === entry.id ? "Checking in…" : "Check in"}
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
