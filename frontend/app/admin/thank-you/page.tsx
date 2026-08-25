"use client";

import { useCallback, useEffect, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import { AuthGuard } from "@/components/AuthGuard";
import { FireBackground } from "@/components/FireBackground";
import { StaffNav } from "@/components/StaffNav";
import {
  getStaffEvents,
  getThankYouRecipientCount,
  sendEventThankYou,
  getCallableErrorMessage,
  type ThankYouRecipients,
  type ThankYouResult,
} from "@/lib/functions";
import { mostRecentlyStarted, sortStaffEvents } from "@/lib/eventWindow";
import { SOCIALS } from "@/lib/socials";
import type { EventSummary } from "@/lib/types";

/**
 * The thank-you blast, sent by hand once an event is over.
 *
 * Laid out like the reminder tool on purpose — same split of controls from
 * consequences, same standing description of what lands in an inbox — because
 * they are the same irreversible action and an operator should not have to
 * relearn the screen. What differs is stated where it matters: this one goes
 * to everyone who ever registered, including the people who never turned up,
 * and it can only be sent after the event has actually started.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ACCRA = "Africa/Accra";

function formatWhen(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ACCRA,
  });
}

/** Before the doors open there is nothing to thank anyone for. */
function hasStarted(event?: EventSummary): boolean {
  return Boolean(event) && new Date(event!.startsAt).getTime() <= Date.now();
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

/** Mirrors what `sendThankYouEmail` in backend/functions/src/email.ts builds. */
function EmailPreview({ event }: { event?: EventSummary }) {
  const subject = event ? `That was ${event.name}` : "That was your event";

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
        {["The event flyer", "A short thank-you, by first name", "A link back to the event page"].map(
          (line) => (
            <li key={line} className="flex items-start gap-2.5 text-[14px] text-cream/65">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {line}
            </li>
          )
        )}
      </ul>

      <div className="mt-4 rounded-xl border border-cream/10 bg-cream/[0.03] p-4">
        <p className="font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.14em] text-cream/40 uppercase">
          And the links to
        </p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {SOCIALS.map((social) => (
            <li key={social.platform} className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-medium text-cream">{social.platform}</span>
              <span className="truncate text-[12.5px] text-cream/40">{social.handle}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-cream/10 pt-4">
        <p className="text-[13px] leading-relaxed text-cream/45">
          No ticket and no QR code — the ticket is spent. The wording thanks people for being part
          of it without claiming they were in the room, because this reaches everyone who
          registered, not only the ones who arrived.
        </p>
      </div>
    </aside>
  );
}

function ThankYouTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [recipients, setRecipients] = useState<ThankYouRecipients | null>(null);
  const [resend, setResend] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ThankYouResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Finished events sort last in the picker but are the whole point of
        // this page, so it opens on the most recent one that has actually run.
        const list = sortStaffEvents(await getStaffEvents());
        setEvents(list);
        const opening = mostRecentlyStarted(list) ?? list[0];
        if (opening) setEventId(opening.id);
      } catch (err) {
        setError(getCallableErrorMessage(err));
      }
    })();
  }, []);

  const loadRecipients = useCallback(async () => {
    if (!eventId) return;
    setRecipients(await getThankYouRecipientCount({ eventId }));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      try {
        setRecipients(null);
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
      const res = await sendEventThankYou({ eventId, resend });
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

  const selectedEvent = events.find((event) => event.id === eventId);
  const started = hasStarted(selectedEvent);
  const willReceive = resend ? (recipients?.total ?? 0) : (recipients?.willReceive ?? 0);
  const canSend = Boolean(eventId) && started && willReceive > 0;

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <StaffNav
          events={events}
          eventId={eventId}
          onEventChange={(next) => {
            setEventId(next);
            setResult(null);
            setConfirming(false);
            setResend(false);
          }}
        />

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))] sm:px-8 sm:pt-9 sm:pb-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-anton)] text-[clamp(34px,6vw,54px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
                Send thank-you
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
                <Stat label="Already sent" value={recipients.alreadyThanked} />
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-6">
            <section className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-5 sm:p-6">
              <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
                Send now
              </h2>
              <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-cream/60">
                Emails everyone who registered for this event a thank-you, the flyer, and where to
                find Love Inc next.
              </p>

              {!started && selectedEvent && (
                <p className="mt-5 rounded-xl border border-gold/35 bg-gold/10 px-4 py-3.5 text-[14px] leading-relaxed text-cream/80">
                  {selectedEvent.name} hasn&rsquo;t started yet. A thank-you can only go out once
                  the event has run — pick a finished event from the menu above.
                </p>
              )}

              {recipients && recipients.noEmail > 0 && (
                <p className="mt-5 text-[13px] leading-relaxed text-cream/45">
                  {recipients.noEmail} {recipients.noEmail === 1 ? "person has" : "people have"} no
                  email address on file and can&rsquo;t be reached. Those are self check-ins raised
                  from the membership roster.
                </p>
              )}

              {started && recipients && recipients.alreadyThanked > 0 && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-cream/12 bg-cream/[0.04] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={resend}
                    onChange={(event) => {
                      setResend(event.target.checked);
                      setConfirming(false);
                    }}
                    className="mt-0.5 h-4 w-4 accent-[#D9A441]"
                  />
                  <span className="text-[13px] leading-relaxed text-cream/70">
                    Also send again to the {recipients.alreadyThanked} who already got one.
                    <span className="block text-cream/45">
                      They will receive a second, identical email.
                    </span>
                  </span>
                </label>
              )}

              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!canSend}
                  className="mt-6 rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-6 py-3.5 text-[15px] font-bold tracking-wide text-[#1A0D0A] uppercase shadow-[0_12px_24px_-8px_rgba(217,164,65,0.4)] transition hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold disabled:opacity-40"
                >
                  {!started
                    ? "Event hasn't run yet"
                    : willReceive === 0
                      ? "Everyone has been thanked"
                      : `Send to ${willReceive} ${willReceive === 1 ? "person" : "people"}`}
                </button>
              ) : (
                <div className="mt-6 rounded-xl border border-gold/45 bg-gold/10 p-5">
                  <p className="text-[15px] text-cream">
                    Send a thank-you email to <strong>{willReceive}</strong>{" "}
                    {willReceive === 1 ? "person" : "people"} who registered for{" "}
                    {selectedEvent?.name}?
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
                    Sent {result.sent} thank-you{result.sent === 1 ? "" : "s"}.
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

export default function AdminThankYouPage() {
  return (
    <AuthGuard>
      <ThankYouTool />
    </AuthGuard>
  );
}
