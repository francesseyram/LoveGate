"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { CheckinScanner } from "@/components/CheckinScanner";
import { CheckinSearch } from "@/components/CheckinSearch";
import { getPublishedEvents, checkInByQr, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary, CheckInResult } from "@/lib/types";

type Tab = "scan" | "search";

function CheckinTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("scan");
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  useEffect(() => {
    getPublishedEvents().then((list) => {
      setEvents(list);
      if (list.length > 0) setEventId(list[0].id);
    });
  }, []);

  async function handleScan(decodedText: string) {
    if (scanLocked || !eventId) return;
    setScanLocked(true);
    setError(null);
    try {
      const result = await checkInByQr({ eventId, qrValue: decodedText });
      setLastResult(result);
    } catch (err) {
      setLastResult(null);
      setError(getCallableErrorMessage(err));
    } finally {
      setTimeout(() => setScanLocked(false), 2000);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900">Check-in</h1>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="event-select">
          Event
        </label>
        <select
          id="event-select"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("scan")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "scan" ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500"
          }`}
        >
          Scan QR
        </button>
        <button
          onClick={() => setTab("search")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "search" ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500"
          }`}
        >
          Search by name
        </button>
      </div>

      <div className="mt-6">
        {!eventId && <p className="text-sm text-gray-500">No events available.</p>}

        {eventId && tab === "scan" && (
          <div>
            <CheckinScanner onScan={handleScan} paused={scanLocked} />
            {lastResult && (
              <p
                className={`mt-4 rounded-md px-4 py-3 text-sm ${
                  lastResult.outcome === "already_checked_in"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-green-50 text-green-800"
                }`}
              >
                {lastResult.outcome === "already_checked_in"
                  ? `${lastResult.registration.name} was already checked in.`
                  : `${lastResult.registration.name} checked in.`}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
          </div>
        )}

        {eventId && tab === "search" && <CheckinSearch eventId={eventId} />}
      </div>
    </main>
  );
}

export default function CheckinPage() {
  return (
    <AuthGuard>
      <CheckinTool />
    </AuthGuard>
  );
}
