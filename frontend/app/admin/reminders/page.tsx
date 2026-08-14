"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { getPublishedEvents, triggerManualReminder, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

function ReminderTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedEvents().then((list) => {
      setEvents(list);
      if (list.length > 0) setEventId(list[0].id);
    });
  }, []);

  async function handleSend() {
    if (!eventId) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const { sent } = await triggerManualReminder({ eventId });
      setMessage(`Sent ${sent} reminder email${sent === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900">Send reminder emails</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sends a reminder email right now to every registrant still marked &quot;going&quot; for the
        selected event.
      </p>

      <div className="mt-6">
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

      <button
        onClick={handleSend}
        disabled={!eventId || sending}
        className="mt-6 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send reminder now"}
      </button>

      {message && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>
      )}
      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}

export default function AdminRemindersPage() {
  return (
    <AuthGuard>
      <ReminderTool />
    </AuthGuard>
  );
}
