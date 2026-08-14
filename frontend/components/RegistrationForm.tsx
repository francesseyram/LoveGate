"use client";

import { useState, type FormEvent } from "react";
import { registerForEvent, getCallableErrorMessage } from "@/lib/functions";
import type { RegisterForEventResult } from "@/lib/types";
import { QRTicket } from "./QRTicket";

/**
 * Shared registration mechanics (validation, duplicate check, QR + email trigger)
 * embedded in every event's custom themed page. Visual styling here is
 * intentionally neutral — wrap it in the event page to match that event's theme.
 */
export function RegistrationForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterForEventResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await registerForEvent({ eventId, name, phone, email });
      setResult(res);
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        {result.alreadyRegistered && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Looks like you&apos;re already registered for {eventName} — here&apos;s your ticket again.
          </p>
        )}
        <QRTicket registration={result.registration} qrImage={result.qrImage} eventName={eventName} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="reg-name">
          Full name
        </label>
        <input
          id="reg-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="reg-phone">
          Phone number
        </label>
        <input
          id="reg-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
