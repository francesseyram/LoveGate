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
    <main className="mx-auto min-h-screen max-w-xl bg-cream px-4 py-8 text-charcoal">
      <h1 className="font-display text-xl font-bold">Send reminder emails</h1>
      <p className="mt-1 text-sm text-charcoal/65">
        Sends a reminder email right now to every registrant still marked &quot;going&quot; for the
        selected event.
      </p>

      <div className="mt-6">
        <label
          className="block text-xs font-semibold tracking-wide text-charcoal/60 uppercase"
          htmlFor="event-select"
        >
          Event
        </label>
        <select
          id="event-select"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal"
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
        className="mt-6 rounded-xl bg-coral px-4 py-2.5 font-display text-sm font-bold text-cream transition hover:bg-coral-dark disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send reminder now"}
      </button>

      {message && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sage-tint px-4 py-3 text-sm font-medium text-sage-dark">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sage-dark" />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-charcoal/5 px-4 py-3 text-sm text-coral">{error}</p>
      )}
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
