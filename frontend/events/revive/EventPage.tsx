"use client";

import { useEffect, useState } from "react";
import { getEvent, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";
import { RegistrationForm } from "@/components/RegistrationForm";

const SLUG = "revive";

/**
 * Example / template event page. Copy this folder for each new event and
 * swap the theme (colors, cover art, copy) — the registration mechanics
 * (validation, duplicate check, QR + email) live in RegistrationForm and
 * don't change per event.
 */
export default function ReviveEventPage() {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvent(SLUG)
      .then(setEvent)
      .catch((err) => setError(getCallableErrorMessage(err)));
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <p>{error}</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Replace this gradient with a real cover photo bundled at
          frontend/public/events/revive/cover.jpg, referenced via event.coverPhotoUrl. */}
      <div className="flex h-72 items-end bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 px-6 pb-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Love Inc presents</p>
          <h1 className="mt-2 text-4xl font-bold">{event.name}</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-3xl gap-10 px-6 py-12 sm:grid-cols-2">
        <div>
          <p className="text-sm text-indigo-300">
            {new Date(event.startsAt).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {event.location ? ` · ${event.location}` : ""}
          </p>
          <p className="mt-4 whitespace-pre-line text-slate-300">{event.description}</p>
        </div>

        <div className="rounded-xl bg-white p-6 text-gray-900">
          <h2 className="text-lg font-semibold">Register</h2>
          <div className="mt-4">
            <RegistrationForm eventId={event.id} eventName={event.name} />
          </div>
        </div>
      </div>
    </main>
  );
}
