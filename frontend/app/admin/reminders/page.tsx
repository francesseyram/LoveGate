"use client";

import { useCallback, useEffect, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { FireBackground } from "@/components/FireBackground";
import {
  getPublishedEvents,
  getReminderRecipientCount,
  triggerManualReminder,
  getCallableErrorMessage,
  type ReminderResult,
} from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

interface Recipients {
  total: number;
  alreadyReminded: number;
  willReceive: number;
}

function ReminderTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [recipients, setRecipients] = useState<Recipients | null>(null);
  const [resend, setResend] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ReminderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await getPublishedEvents();
      setEvents(list);
      if (list.length > 0) setEventId(list[0].id);
    })();
  }, []);

  const loadRecipients = useCallback(async () => {
    if (!eventId) return;
    const counts = await getReminderRecipientCount({ eventId });
    setRecipients(counts);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      try {
        await loadRecipients();
      } catch (err) {
        setError(getCallableErrorMessage(err));
      }
    })();
  }, [eventId, loadRecipients]);

  async function handleSend() {
    if (!eventId) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await triggerManualReminder({ eventId, resend });
      setResult(res);
      setConfirming(false);
      setResend(false);
      await loadRecipients();
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const willReceive = resend ? (recipients?.total ?? 0) : (recipients?.willReceive ?? 0);
  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/checkin" className="text-[13px] text-cream/45 transition hover:text-gold">
            ← Check-in
          </Link>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 uppercase">
              Staff mode
            </span>
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-anton)] text-[clamp(34px,7vw,54px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
          Send reminders
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-cream/60">
          Emails everyone registered for the event their ticket and the event details. A reminder
          also goes out automatically 24 hours before the event starts.
        </p>

        <div className="mt-8">
          <label
            className="mb-1.5 block font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-gold/85 uppercase"
            htmlFor="event-select"
          >
            Event
          </label>
          <select
            id="event-select"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setResult(null);
              setConfirming(false);
            }}
            className="w-full max-w-xs rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 py-2.5 font-sans text-[15px] text-cream outline-none focus:border-gold"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id} className="bg-[#22090a] text-cream">
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {recipients && (
          <div className="mt-6 flex items-stretch gap-3">
            <Stat label="Will receive" value={willReceive} accent />
            <Stat label="Registered" value={recipients.total} />
            <Stat label="Already sent" value={recipients.alreadyReminded} />
          </div>
        )}

        {recipients && recipients.alreadyReminded > 0 && (
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[10px] border border-cream/12 bg-cream/[0.04] px-4 py-3">
            <input
              type="checkbox"
              checked={resend}
              onChange={(e) => {
                setResend(e.target.checked);
                setConfirming(false);
              }}
              className="mt-0.5 h-4 w-4 accent-[#D9A441]"
            />
            <span className="text-[13px] leading-relaxed text-cream/70">
              Also re-send to the {recipients.alreadyReminded} who already got a reminder.
              <span className="block text-cream/45">
                Only for something that changed — a new venue or time.
              </span>
            </span>
          </label>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!eventId || willReceive === 0}
            className="mt-7 h-13 rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-6 py-3.5 text-[15px] font-bold tracking-wide text-[#1A0D0A] uppercase shadow-[0_12px_24px_-8px_rgba(217,164,65,0.4)] transition hover:brightness-[1.08] disabled:opacity-40"
          >
            {willReceive === 0 ? "Everyone has been reminded" : `Send to ${willReceive} people`}
          </button>
        ) : (
          <div className="mt-7 rounded-[10px] border border-gold/45 bg-gold/10 p-5">
            <p className="text-[15px] text-cream">
              Send a reminder email to <strong>{willReceive}</strong>{" "}
              {willReceive === 1 ? "person" : "people"} registered for {selectedEvent?.name}?
            </p>
            <p className="mt-1.5 text-[13px] text-cream/55">This can&apos;t be undone.</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-5 py-2.5 text-sm font-bold tracking-wide text-[#1A0D0A] uppercase transition hover:brightness-[1.08] disabled:opacity-50"
              >
                {sending ? "Sending…" : "Yes, send now"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="rounded-xl border border-cream/20 px-5 py-2.5 text-sm font-medium text-cream/70 transition hover:text-cream disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-[10px] border border-sage/35 bg-sage/15 px-4 py-3.5 text-sm text-sage">
            <p className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 shrink-0 rounded-full bg-sage" />
              Sent {result.sent} reminder{result.sent === 1 ? "" : "s"}.
            </p>
            {(result.skipped > 0 || result.failed > 0) && (
              <p className="mt-1.5 pl-4 text-[13px] text-sage/80">
                {result.skipped > 0 && `${result.skipped} already had one. `}
                {result.failed > 0 &&
                  `${result.failed} failed to send — check the function logs.`}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-[10px] border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-[10px] border px-4 py-3 ${
        accent ? "border-gold/40 bg-gold/10" : "border-cream/12 bg-cream/[0.04]"
      }`}
    >
      <div
        className={`font-[family-name:var(--font-anton)] text-2xl tabular-nums ${
          accent ? "text-gold" : "text-cream"
        }`}
      >
        {value}
      </div>
      <div className="font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-cream/50 uppercase">
        {label}
      </div>
    </div>
  );
}

export default function AdminRemindersPage() {
  return (
    <AuthGuard>
      <ReminderTool />
    </AuthGuard>
  );
}
