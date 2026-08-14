"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedEvents, getCallableErrorMessage } from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedEvents()
      .then(setEvents)
      .catch((err) => setError(getCallableErrorMessage(err)));
  }, []);

  return (
    <main className="flex-1 bg-white text-gray-900">
      <header className="border-b border-gray-100 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Love Inc</h1>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-lg font-semibold">Upcoming events</h2>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!events && !error && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
        {events && events.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No events are open for registration right now.</p>
        )}

        <ul className="mt-6 space-y-4">
          {events?.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.slug}`}
                className="block rounded-lg border border-gray-200 p-5 transition hover:border-gray-400"
              >
                <p className="font-medium">{event.name}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {formatEventDate(event.startsAt)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
