"use client";

import { useEffect, useState } from "react";
import type { RosterEntry } from "@/lib/offlineStore";
import type { CheckinOutcome, UndoOutcome } from "@/lib/useOfflineCheckin";

/**
 * Name/ticket-ref lookup against the locally cached roster, so the fallback
 * path when a phone is dead or a QR won't scan keeps working with no network.
 */
export function CheckinSearch({
  search,
  onCheckIn,
  onUndoCheckIn,
  disabled,
  emptyState,
}: {
  search: (query: string) => RosterEntry[];
  onCheckIn: (entry: RosterEntry) => Promise<CheckinOutcome>;
  onUndoCheckIn: (entry: RosterEntry) => Promise<UndoOutcome>;
  disabled?: boolean;
  /** Shown instead of an empty list before anything is typed. Omitted while `disabled`. */
  emptyState?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RosterEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which row is asking "undo?". Undo is one tap from where "Check in" was, so
  // it takes a second tap — at the door, a slip here marks a present person absent.
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setResults(search(query)), 150);
    return () => clearTimeout(handle);
  }, [query, search]);

  async function handleCheckIn(entry: RosterEntry) {
    setBusyId(entry.id);
    setMessage(null);
    setError(null);
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

  async function handleUndo(entry: RosterEntry) {
    setBusyId(entry.id);
    setMessage(null);
    setError(null);
    try {
      const outcome = await onUndoCheckIn(entry);
      if (outcome.result === "failed") {
        setError(outcome.message);
      } else {
        setMessage(`${outcome.name} is back to not arrived.`);
      }
      setResults(search(query));
    } finally {
      setBusyId(null);
      setUndoingId(null);
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
        className="w-full rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 py-3.5 font-sans text-[16px] text-cream placeholder:text-cream/35 outline-none focus:border-gold disabled:opacity-50"
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
      {!disabled && !query.trim() && emptyState}

      <ul
        className={`mt-4 divide-y divide-cream/10 overflow-hidden rounded-[10px] border border-cream/12 bg-cream/[0.04] ${
          query.trim() ? "" : "hidden"
        }`}
      >
        {results.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-cream">{entry.name}</p>
              <p className="truncate text-[13px] text-cream/50">{entry.ticketRef}</p>
            </div>
            {entry.status === "checked_in" ? (
              undoingId === entry.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleUndo(entry)}
                    disabled={busyId === entry.id}
                    className="min-h-11 rounded-lg border border-coral/50 bg-coral/20 px-3.5 text-[13px] font-semibold text-[#F2C1C6] transition hover:bg-coral/30 disabled:opacity-50"
                  >
                    {busyId === entry.id ? "Undoing…" : "Undo check-in"}
                  </button>
                  <button
                    onClick={() => setUndoingId(null)}
                    disabled={busyId === entry.id}
                    className="min-h-11 px-1 text-[13px] text-cream/45 transition hover:text-cream disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="rounded-full border border-sage/35 bg-sage/15 px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-sage uppercase">
                    Checked in
                  </span>
                  <button
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      setUndoingId(entry.id);
                    }}
                    title={`Mark ${entry.name} as not arrived`}
                    className="min-h-11 px-1 text-[13px] text-cream/40 underline underline-offset-2 transition hover:text-cream"
                  >
                    Undo
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => handleCheckIn(entry)}
                disabled={busyId === entry.id}
                className="min-h-11 shrink-0 rounded-lg bg-gold px-4 text-[13px] font-bold text-[#1A0D0A] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
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
