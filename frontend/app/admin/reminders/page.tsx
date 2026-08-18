"use client";

import { useCallback, useEffect, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import { AuthGuard } from "@/components/AuthGuard";
import { FireBackground } from "@/components/FireBackground";
import { StaffNav } from "@/components/StaffNav";
import {
  getPublishedEvents,
  getReminderRecipientCount,
  triggerManualReminder,
  getCallableErrorMessage,
  type ReminderResult,
} from "@/lib/functions";
import type { EventSummary } from "@/lib/types";

/**
 * Manual reminder blast.
 *
 * Sending mail to a few hundred people is irreversible, so the layout splits
 * the decision from its consequences: controls on the left, and on the right a
 * standing description of exactly what lands in someone's inbox. The operator
 * should never have to remember what the email contains.
 */

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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-xl border px-4 py-3 ${
        accent ? "border-gold/40 bg-gold/10" : "border-cream/12 bg-cream/[0.04]"
      }`}
    >
      <div
        className={`font-[family-name:var(--font-anton)] text-[26px] leading-none tabular-nums sm:text-[30px] ${
          accent ? "text-gold" : "text-cream"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-cream/50 uppercase">
        {label}
      </div>
    </div>
  );
}

function formatWhen(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
}

const ACCRA = "Africa/Accra";

function ymdInAccra(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCRA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isTomorrowInAccra(startsAt: Date): boolean {
  const [year, month, day] = ymdInAccra(new Date()).split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowKey = [
    tomorrow.getUTCFullYear(),
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0"),
    String(tomorrow.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return ymdInAccra(startsAt) === tomorrowKey;
}

/** Mirrors what backend/functions/src/email.ts actually builds. */
function EmailPreview({ event }: { event?: EventSummary }) {
  const startsAt = event ? new Date(event.startsAt) : null;
  const tomorrow = startsAt ? isTomorrowInAccra(startsAt) : false;
  const time = startsAt
    ? startsAt.toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: ACCRA,
      })
    : "";
  const date = startsAt
    ? startsAt.toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: ACCRA,
      })
    : "";

  const subject = event
    ? tomorrow
      ? `Tomorrow: ${event.name} at ${time}`
      : `Reminder: ${event.name} on ${date}`
    : "Reminder: your event";

  const contents = [
    "Their QR ticket and ticket reference",
    "The date, time and venue, with a map link",
    "The event flyer",
  ];

  return (
    <aside className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-5">
      <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
        What they receive
      </h2>

      <div className="mt-4 rounded-xl border border-cream/10 bg-cream/[0.03] p-4">
        <p className="font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.14em] text-cream/40 uppercase">
          Subject
        </p>
        <p className="mt-1.5 text-[15px] font-medium text-cream">{subject}</p>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {contents.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[14px] text-cream/65">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-cream/10 pt-4">
        <p className="text-[13px] leading-relaxed text-cream/45">
          A reminder also goes out automatically 24 hours before the event starts. Anyone it has
          already reached is skipped here unless you tick the re-send box.
        </p>
      </div>
    </aside>
  );
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

      <div className="relative z-10 flex min-h-screen flex-col">
        <StaffNav
          events={events}
          eventId={eventId}
          onEventChange={(next) => {
            setEventId(next);
            setResult(null);
            setConfirming(false);
          }}
        />

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-anton)] text-[clamp(34px,6vw,54px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
                Send reminders
              </h1>
              {selectedEvent && (
                <p className="mt-1.5 font-[family-name:var(--font-oswald)] text-[13px] tracking-[0.1em] text-cream/50 uppercase">
                  {selectedEvent.name} · {formatWhen(selectedEvent.startsAt)}
                </p>
              )}
            </div>

            {recipients && (
              <div className="flex w-full items-stretch gap-3 lg:max-w-[480px]">
                <Stat label="Will receive" value={willReceive} accent />
                <Stat label="Registered" value={recipients.total} />
                <Stat label="Already sent" value={recipients.alreadyReminded} />
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-6">
            <section className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-5 sm:p-6">
              <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
                Send now
              </h2>
              <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-cream/60">
                Emails everyone registered for this event their ticket and the event details.
              </p>

              {recipients && recipients.alreadyReminded > 0 && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-cream/12 bg-cream/[0.04] px-4 py-3">
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
                      Only for something that changed, like a new venue or time.
                    </span>
                  </span>
                </label>
              )}

              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!eventId || willReceive === 0}
                  className="mt-6 rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-6 py-3.5 text-[15px] font-bold tracking-wide text-[#1A0D0A] uppercase shadow-[0_12px_24px_-8px_rgba(217,164,65,0.4)] transition hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold disabled:opacity-40"
                >
                  {willReceive === 0 ? "Everyone has been reminded" : `Send to ${willReceive} people`}
                </button>
              ) : (
                <div className="mt-6 rounded-xl border border-gold/45 bg-gold/10 p-5">
                  <p className="text-[15px] text-cream">
                    Send a reminder email to <strong>{willReceive}</strong>{" "}
                    {willReceive === 1 ? "person" : "people"} registered for {selectedEvent?.name}?
                  </p>
                  <p className="mt-1.5 text-[13px] text-cream/55">This can&apos;t be undone.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
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
                <div className="mt-5 rounded-xl border border-sage/35 bg-sage/15 px-4 py-3.5 text-sm text-sage">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sage" />
                    Sent {result.sent} reminder{result.sent === 1 ? "" : "s"}.
                  </p>
                  {(result.skipped > 0 || result.failed > 0) && (
                    <p className="mt-1.5 pl-4 text-[13px] text-sage/80">
                      {result.skipped > 0 && `${result.skipped} already had one. `}
                      {result.failed > 0 &&
                        `${result.failed} failed to send. Check the function logs.`}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-5 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
                  {error}
                </p>
              )}
            </section>

            <EmailPreview event={selectedEvent} />
          </div>
        </div>
      </div>
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
