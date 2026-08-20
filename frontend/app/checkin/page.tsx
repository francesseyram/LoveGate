"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Anton, Oswald } from "next/font/google";
import { AuthGuard } from "@/components/AuthGuard";
import { CheckinScanner } from "@/components/CheckinScanner";
import { CheckinSearch } from "@/components/CheckinSearch";
import { FireBackground } from "@/components/FireBackground";
import { StaffNav } from "@/components/StaffNav";
import { getPublishedEvents } from "@/lib/functions";
import { useOfflineCheckin, type CheckinOutcome } from "@/lib/useOfflineCheckin";
import type { RosterEntry } from "@/lib/offlineStore";
import type { EventSummary } from "@/lib/types";

/**
 * The check-in console.
 *
 * Scanning and name search are two halves of one job — the camera handles most
 * people and search handles the exceptions — so on a desk they sit side by side
 * rather than behind a tab switch. Phones get the tabs, since there isn't room
 * for both. The right pane falls back to who just walked in, which is what an
 * operator glances at between scans.
 */

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

type Tab = "scan" | "search";

/* -------------------------------------------------------------------------
   Viewport
   ---------------------------------------------------------------------- */

/**
 * Both panes are on screen from `lg` up, so the scanner must not be paused for
 * tab reasons there. Read as an external store to keep render pure and to stay
 * correct when a window is resized across the breakpoint mid-shift.
 */
const DESKTOP_QUERY = "(min-width: 1024px)";
let desktopSnapshot = false;

function subscribeToViewport(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY);
  desktopSnapshot = mq.matches;
  const handler = () => {
    desktopSnapshot = mq.matches;
    onChange();
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToViewport,
    () => desktopSnapshot,
    () => false
  );
}

/* -------------------------------------------------------------------------
   Pieces
   ---------------------------------------------------------------------- */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "gold" | "sage";
}) {
  const tone =
    accent === "gold"
      ? "border-gold/40 bg-gold/10"
      : accent === "sage"
        ? "border-sage/35 bg-sage/12"
        : "border-cream/12 bg-cream/[0.04]";
  const figure =
    accent === "gold" ? "text-gold" : accent === "sage" ? "text-sage" : "text-cream";

  return (
    <div className={`flex-1 rounded-xl border px-4 py-3 ${tone}`}>
      <div
        className={`font-[family-name:var(--font-anton)] text-[26px] leading-none tabular-nums sm:text-[30px] ${figure}`}
      >
        {value}
      </div>
      <div className="mt-1.5 font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-cream/50 uppercase">
        {label}
      </div>
    </div>
  );
}

/** How full the room is — the number staff are actually tracking all night. */
function RoomFill({ checkedIn, total }: { checkedIn: number; total: number }) {
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 uppercase">
          Arrived
        </span>
        <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 tabular-nums uppercase">
          {pct}%
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream/10"
        role="progressbar"
        aria-valuenow={checkedIn}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Attendees checked in"
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#D9A441,#B23A48)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OutcomeBanner({ outcome }: { outcome: CheckinOutcome }) {
  if (outcome.result === "not_found") {
    return (
      <p className="mt-4 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-center text-sm text-[#F2C1C6]">
        No ticket found for this code.
      </p>
    );
  }

  const checkedIn = outcome.result === "checked_in";
  return (
    <p
      className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
        checkedIn ? "border border-sage/35 bg-sage/15 text-sage" : "bg-cream/[0.06] text-cream/60"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${checkedIn ? "bg-sage" : "bg-cream/40"}`} />
      {checkedIn ? `${outcome.name} checked in.` : `${outcome.name} was already checked in.`}
      {outcome.offline && checkedIn && <span className="text-xs text-cream/45">· saved offline</span>}
    </p>
  );
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
}

/**
 * Fills the search pane before anyone types. Most recent first, so the last
 * person through the door is always at the top.
 */
function RecentArrivals({ entries }: { entries: RosterEntry[] }) {
  const recent = entries
    .filter((entry) => entry.status === "checked_in" && entry.checkedInAt)
    .sort((a, b) => (a.checkedInAt! < b.checkedInAt! ? 1 : -1))
    .slice(0, 8);

  if (recent.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-cream/15 px-5 py-10 text-center">
        <p className="text-sm text-cream/55">Nobody has checked in yet.</p>
        <p className="mt-1 text-[13px] text-cream/35">
          Scan a ticket, or search for someone by name.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/45 uppercase">
        Just arrived
      </p>
      <ul className="mt-2.5 divide-y divide-cream/8 overflow-hidden rounded-xl border border-cream/12 bg-cream/[0.03]">
        {recent.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-cream">{entry.name}</p>
              <p className="truncate text-[12.5px] text-cream/40">{entry.ticketRef}</p>
            </div>
            <span className="shrink-0 font-[family-name:var(--font-oswald)] text-[12px] tracking-wide text-sage tabular-nums">
              {entry.checkedInAt ? timeOfDay(entry.checkedInAt) : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Page
   ---------------------------------------------------------------------- */

function CheckinTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("scan");
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  const checkin = useOfflineCheckin(eventId);
  const isDesktop = useIsDesktop();

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
  const selectedEvent = events.find((e) => e.id === eventId);
  const yetToArrive = Math.max(0, checkin.attendeeCount - checkin.checkedInCount);

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Full-width operations bar: context and connection state, always visible. */}
        <StaffNav
          events={events}
          eventId={eventId}
          onEventChange={setEventId}
          status={
            <>
              {checkin.pendingCount > 0 && (
                <span className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.12em] text-gold uppercase">
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
            </>
          }
        />

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-8 sm:py-9">
          {/* Title left, live numbers right — the two things worth a glance. */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-anton)] text-[clamp(38px,7vw,60px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
                Check-in
              </h1>
              {selectedEvent && (
                <p className="mt-1.5 font-[family-name:var(--font-oswald)] text-[13px] tracking-[0.1em] text-cream/50 uppercase">
                  {selectedEvent.name}
                  {selectedEvent.location ? ` · ${selectedEvent.location}` : ""}
                </p>
              )}
            </div>

            {rosterReady && (
              <div className="w-full lg:max-w-[480px]">
                <div className="flex items-stretch gap-3">
                  <Stat label="In the room" value={checkin.checkedInCount} accent="sage" />
                  <Stat label="Registered" value={checkin.attendeeCount} />
                  <Stat label="Yet to arrive" value={yetToArrive} accent="gold" />
                </div>
                <div className="mt-3.5">
                  <RoomFill checkedIn={checkin.checkedInCount} total={checkin.attendeeCount} />
                </div>
              </div>
            )}
          </div>

          {checkin.error && (
            <p className="mt-6 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
              {checkin.error}
            </p>
          )}

          {!eventId && <p className="mt-8 text-sm text-cream/50">No events available.</p>}

          {/* Tabs are a phone affordance only; both panes are live from lg up. */}
          <div className="mt-7 flex gap-7 border-b border-cream/12 lg:hidden">
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

          {eventId && (
            <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-2 lg:gap-6">
              {/* Scanner stays mounted across tab switches — remounting it
                  restarts the camera and wipes the video element. */}
              <section
                className={`rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-4 sm:p-5 lg:block ${
                  tab === "scan" ? "block" : "hidden"
                }`}
              >
                <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
                  Scan a ticket
                </h2>
                <div className="relative mx-auto mt-4 w-full max-w-sm lg:max-w-none">
                  <div className="pointer-events-none absolute -top-2 -left-2 z-10 h-6 w-6 rounded-tl-lg border-t-2 border-l-2 border-gold" />
                  <div className="pointer-events-none absolute -top-2 -right-2 z-10 h-6 w-6 rounded-tr-lg border-t-2 border-r-2 border-gold" />
                  <div className="pointer-events-none absolute -bottom-2 -left-2 z-10 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-gold" />
                  <div className="pointer-events-none absolute -right-2 -bottom-2 z-10 h-6 w-6 rounded-br-lg border-r-2 border-b-2 border-gold" />
                  <CheckinScanner
                    onScan={handleScan}
                    paused={scanLocked || (!isDesktop && tab !== "scan")}
                  />
                </div>
                {outcome && <OutcomeBanner outcome={outcome} />}
              </section>

              <section
                className={`rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-4 sm:p-5 lg:block ${
                  tab === "search" ? "block" : "hidden"
                }`}
              >
                <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
                  Find someone
                </h2>
                <div className="mt-4">
                  <CheckinSearch
                    search={checkin.search}
                    onCheckIn={checkin.checkIn}
                    onUndoCheckIn={checkin.undoCheckIn}
                    disabled={!rosterReady}
                    emptyState={<RecentArrivals entries={checkin.roster?.entries ?? []} />}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
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
