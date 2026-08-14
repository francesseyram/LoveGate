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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200">
        {results.map((registration) => (
          <li key={registration.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{registration.name}</p>
              <p className="text-xs text-gray-500">{registration.email}</p>
            </div>
            {registration.status === "checked_in" ? (
              <span className="text-xs font-medium text-green-700">Checked in</span>
            ) : (
              <button
                onClick={() => handleCheckIn(registration)}
                disabled={busyId === registration.id}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {busyId === registration.id ? "Checking in…" : "Check in"}
              </button>
            )}
          </li>
        ))}
        {query.trim() && results.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">No matches.</li>
        )}
      </ul>
    </div>
  );
}
