"use client";

import { useEffect, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { CheckinScanner } from "@/components/CheckinScanner";
import { CheckinSearch } from "@/components/CheckinSearch";
import { FireBackground } from "@/components/FireBackground";
import { getPublishedEvents } from "@/lib/functions";
import { useOfflineCheckin, type CheckinOutcome } from "@/lib/useOfflineCheckin";
import type { EventSummary } from "@/lib/types";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

type Tab = "scan" | "search";

function CheckinTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("scan");
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  const checkin = useOfflineCheckin(eventId);

  useEffect(() => {
    getPublishedEvents().then((list) => {
      setEvents(list);
      if (list.length > 0) setEventId(list[0].id);
    });
  }, []);

  async function handleScan(decodedText: string) {
    if (scanLocked || !eventId) return;
    setScanLocked(true);

    const entry = checkin.findByQr(decodedText);
    setOutcome(entry ? await checkin.checkIn(entry) : { result: "not_found" });

    setTimeout(() => setScanLocked(false), 2000);
  }

  const rosterReady = checkin.roster !== null;

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-[13px] text-cream/45 transition hover:text-gold">
            ← LoveGate
          </Link>
          <div className="flex items-center gap-4">
            {checkin.pendingCount > 0 && (
              <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.12em] text-gold uppercase">
                {checkin.pendingCount} queued
              </span>
            )}
            <span className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${checkin.online ? "bg-sage" : "bg-gold"}`}
              />
              <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 uppercase">
                {checkin.online ? "Online" : "Offline"}
              </span>
            </span>
            <Link
              href="/admin/reminders"
              className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.12em] text-cream/50 uppercase transition hover:text-gold"
            >
              Reminders →
            </Link>
          </div>
        </div>

        <h1 className="font-[family-name:var(--font-anton)] text-[clamp(40px,8vw,64px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
          Check-in
        </h1>

        <div className="mt-6 mb-6">
          <label className="mb-1.5 block font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-gold/85 uppercase">
            Event
          </label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full max-w-xs rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 py-2.5 font-sans text-[15px] text-cream outline-none focus:border-gold"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id} className="bg-[#22090a] text-cream">
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {rosterReady && (
          <div className="mb-8 flex items-stretch gap-3">
            <Stat label="In the room" value={checkin.checkedInCount} accent />
            <Stat label="Registered" value={checkin.attendeeCount} />
            <Stat
              label="Yet to arrive"
              value={Math.max(0, checkin.attendeeCount - checkin.checkedInCount)}
            />
          </div>
        )}

        {checkin.error && (
          <p className="mb-6 rounded-[10px] border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
            {checkin.error}
          </p>
        )}

        <div className="flex gap-7 border-b border-cream/12">
          {(["scan", "search"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 pb-3 font-[family-name:var(--font-oswald)] text-sm font-medium tracking-wide uppercase transition ${
                tab === value ? "border-gold text-cream" : "border-transparent text-cream/45"
              }`}
            >
              {value === "scan" ? "Scan QR" : "Search by name"}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {!eventId && <p className="text-sm text-cream/50">No events available.</p>}

          {/* Scanner mounts once the event (and roster) are known so html5-qrcode
              measures a visible container, then only toggles hidden/paused across
              tabs — remounting it restarts the camera on every tab click. */}
          {eventId && (
            <div className={tab === "scan" ? "block" : "hidden"}>
              <div className="relative mx-auto w-full max-w-sm">
                <div className="pointer-events-none absolute -top-2 -left-2 h-6 w-6 rounded-tl-lg border-t-2 border-l-2 border-gold" />
                <div className="pointer-events-none absolute -top-2 -right-2 h-6 w-6 rounded-tr-lg border-t-2 border-r-2 border-gold" />
                <div className="pointer-events-none absolute -bottom-2 -left-2 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-gold" />
                <div className="pointer-events-none absolute -right-2 -bottom-2 h-6 w-6 rounded-br-lg border-r-2 border-b-2 border-gold" />
                <CheckinScanner onScan={handleScan} paused={tab !== "scan" || scanLocked} />
              </div>
              {outcome && <OutcomeBanner outcome={outcome} />}
            </div>
          )}

          {eventId && tab === "search" && (
            <CheckinSearch
              search={checkin.search}
              onCheckIn={checkin.checkIn}
              disabled={!rosterReady}
            />
          )}
        </div>
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

function OutcomeBanner({ outcome }: { outcome: CheckinOutcome }) {
  if (outcome.result === "not_found") {
    return (
      <p className="mt-5 rounded-[10px] border border-coral/40 bg-coral/15 px-4 py-3 text-center text-sm text-[#F2C1C6]">
        No ticket found for this code.
      </p>
    );
  }

  const checkedIn = outcome.result === "checked_in";
  return (
    <p
      className={`mt-5 flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-medium ${
        checkedIn ? "border border-sage/35 bg-sage/15 text-sage" : "bg-cream/[0.06] text-cream/60"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${checkedIn ? "bg-sage" : "bg-cream/40"}`} />
      {checkedIn
        ? `${outcome.name} checked in.`
        : `${outcome.name} was already checked in.`}
      {outcome.offline && checkedIn && (
        <span className="text-xs text-cream/45">· saved offline</span>
      )}
    </p>
  );
}

export default function CheckinPage() {
  return (
    <AuthGuard>
      <CheckinTool />
    </AuthGuard>
  );
}
