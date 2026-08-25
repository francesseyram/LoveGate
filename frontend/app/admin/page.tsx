"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Anton, Oswald } from "next/font/google";
import { AuthGuard } from "@/components/AuthGuard";
import { AutoCheckInSwitch } from "@/components/AutoCheckInSwitch";
import { FireBackground } from "@/components/FireBackground";
import { StaffNav } from "@/components/StaffNav";
import {
  BarList,
  CHART_CORAL,
  CHART_GOLD,
  CHART_SAGE,
  ColumnChart,
  type Column,
} from "@/components/DashboardCharts";
import {
  deleteRegistration,
  getCallableErrorMessage,
  getEventDashboard,
  getStaffEvents,
} from "@/lib/functions";
import { revertCheckIn } from "@/lib/revertCheckIn";
import { sortStaffEvents } from "@/lib/eventWindow";
import type { Dashboard, DashboardAttendee, EventSummary } from "@/lib/types";

/**
 * The dashboard.
 *
 * The check-in console answers "who is at the door right now"; this answers
 * "how is this event going", which is a different question asked at a different
 * moment — usually not standing at the door. So the numbers live here in full
 * rather than being squeezed into the console's header, and the roster is a
 * real table you can search, filter and clean up.
 *
 * Reads go through one call: every figure on the page comes from the same
 * snapshot, so nothing on screen can disagree with anything else on screen.
 */

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ACCRA = "Africa/Accra";

/* -------------------------------------------------------------------------
   Formatting
   ---------------------------------------------------------------------- */

/** Accra is UTC+0, so midday on the key is safely inside the right day. */
function dayFromKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

function dayLabel(key: string): string {
  return dayFromKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ACCRA,
  });
}

function dayTick(key: string): string {
  return dayFromKey(key).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: ACCRA,
  });
}

function hourTick(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

function hourLabel(hour: number): string {
  return `${hourTick(hour)} to ${hourTick((hour + 1) % 24)}`;
}

function whenRegistered(iso: string): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ACCRA,
  });
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ACCRA,
  });
}

/**
 * Numbers are stored digits-only, which is unreadable in a column staff scan
 * down and awkward to read aloud. Group them the way they're written in Ghana:
 * 0XX XXX XXXX locally, +233 XX XXX XXXX when dialled internationally.
 * Anything that doesn't fit either shape is left exactly as entered rather
 * than mangled into a wrong-looking number.
 */
function formatPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith("233")) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return raw;
}

/* -------------------------------------------------------------------------
   Pieces
   ---------------------------------------------------------------------- */

function Stat({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: number;
  accent?: "gold" | "sage";
  note?: string;
}) {
  const tone =
    accent === "gold"
      ? "border-gold/40 bg-gold/10"
      : accent === "sage"
        ? "border-sage/35 bg-sage/12"
        : "border-cream/12 bg-cream/[0.04]";
  const figure = accent === "gold" ? "text-gold" : accent === "sage" ? "text-sage" : "text-cream";

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${tone}`}>
      <div
        className={`font-[family-name:var(--font-anton)] text-[30px] leading-none sm:text-[34px] ${figure}`}
      >
        {value}
      </div>
      <div className="mt-1.5 font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-cream/50 uppercase">
        {label}
      </div>
      {note && <div className="mt-0.5 text-[11.5px] text-cream/35">{note}</div>}
    </div>
  );
}

/** How full the room is — the same meter the check-in console leads with. */
function RoomFill({ checkedIn, total }: { checkedIn: number; total: number }) {
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 uppercase">
          Arrived
        </span>
        <span className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.14em] text-cream/50 tabular-nums uppercase">
          {checkedIn} of {total} · {pct}%
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

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
          {title}
        </h2>
        {hint && <span className="text-[11.5px] text-cream/30">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

type StatusFilter = "all" | "checked_in" | "going";

/**
 * The roster, and the only place a registration can be removed.
 *
 * Deletion is here rather than on the check-in console on purpose: at the door
 * the destructive action sits one mis-tap from the check-in button, and a
 * volunteer under queue pressure should not be able to reach it at all.
 *
 * Undoing a check-in sits next to it but is a different weight of action —
 * reversible by checking the person in again — so it stays a single click with
 * no confirmation, where deleting takes a selection and a confirmation.
 */
function AttendeeTable({
  attendees,
  eventId,
  onChanged,
}: {
  attendees: DashboardAttendee[];
  eventId: string;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((person) => {
      if (status !== "all" && person.status !== status) return false;
      if (!q) return true;
      // Compared digit-only so a number pasted as "024 123 4567" or
      // "+233241234567" still finds a record stored as "0241234567".
      const qDigits = q.replace(/\D/g, "");
      const phoneMatches =
        qDigits.length >= 3 && person.phone.replace(/\D/g, "").includes(qDigits);

      return (
        person.name.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q) ||
        person.ticketRef.toLowerCase().includes(q) ||
        phoneMatches ||
        // Matching the inviter turns the search box into "show me everyone
        // Ama brought", which is the question a referral field exists to answer.
        person.invitedBy.toLowerCase().includes(q)
      );
    });
  }, [attendees, query, status]);

  const visibleIds = rows.map((person) => person.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleUndoCheckIn(person: DashboardAttendee) {
    setUndoingId(person.id);
    setError(null);
    try {
      // Shared with the door console: dropping the queued scan is only half of
      // it, and this page has no hook to wait out a flush already in progress.
      await revertCheckIn({ eventId, registrationId: person.id });
      await onChanged();
    } catch (err) {
      setError(`Could not undo ${person.name}'s check-in. ${getCallableErrorMessage(err)}`);
    } finally {
      setUndoingId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    // One call each rather than a batch endpoint: a partial failure then leaves
    // the successful deletions done and names the ones that didn't take.
    const failures: string[] = [];
    for (const registrationId of selected) {
      try {
        await deleteRegistration({ eventId, registrationId });
      } catch (err) {
        failures.push(getCallableErrorMessage(err));
      }
    }

    setSelected(new Set());
    setConfirming(false);
    setDeleting(false);
    if (failures.length > 0) {
      setError(`${failures.length} could not be deleted. ${failures[0]}`);
    }
    await onChanged();
  }

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: `Everyone (${attendees.length})` },
    {
      value: "checked_in",
      label: `Checked in (${attendees.filter((p) => p.status === "checked_in").length})`,
    },
    {
      value: "going",
      label: `Not arrived (${attendees.filter((p) => p.status === "going").length})`,
    },
  ];

  return (
    <section className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
          Everyone registered
        </h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, phone, email, ticket or inviter…"
          aria-label="Search attendees"
          className="h-11 w-full rounded-xl border border-cream/15 bg-cream/[0.04] px-4 text-[16px] text-cream placeholder:text-cream/30 outline-none focus:border-gold sm:w-72"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value)}
            className={`flex min-h-10 items-center rounded-full border px-4 font-[family-name:var(--font-oswald)] text-[11.5px] tracking-[0.1em] uppercase transition ${
              status === filter.value
                ? "border-gold/50 bg-gold/12 text-gold"
                : "border-cream/12 text-cream/45 hover:text-cream/75"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/12 px-4 py-3">
          {!confirming ? (
            <>
              <span className="text-[14px] text-cream">{selected.size} selected</span>
              <button
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-coral/50 bg-coral/20 px-3.5 py-1.5 text-[13px] font-medium text-[#F2C1C6] transition hover:bg-coral/30"
              >
                Delete
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[13px] text-cream/50 transition hover:text-cream"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <span className="text-[14px] text-cream">
                Permanently delete {selected.size}{" "}
                {selected.size === 1 ? "registration" : "registrations"}? Their tickets stop working
                and this can&apos;t be undone.
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-coral px-3.5 py-1.5 text-[13px] font-bold text-cream transition hover:brightness-110 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="text-[13px] text-cream/50 transition hover:text-cream disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-cream/15 px-5 py-10 text-center text-sm text-cream/45">
          {attendees.length === 0 ? "Nobody has registered yet." : "Nobody matches that."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-cream/12 sm:max-h-[560px] sm:overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#180A08]">
              <tr className="font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-cream/40 uppercase">
                <th scope="col" className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select everyone shown"
                    className="h-5 w-5 accent-[#B23A48]"
                  />
                </th>
                <th scope="col" className="w-[28%] px-3 py-2.5 font-medium">
                  Name
                </th>
                <th scope="col" className="hidden w-[16%] px-3 py-2.5 font-medium sm:table-cell">
                  Phone
                </th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">
                  Ticket
                </th>
                <th scope="col" className="hidden w-[20%] px-3 py-2.5 font-medium lg:table-cell">
                  Invited by
                </th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">
                  Registered
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/8">
              {rows.map((person) => {
                const checked = selected.has(person.id);
                return (
                  <tr
                    key={person.id}
                    className={`transition-colors ${checked ? "bg-coral/10" : "hover:bg-cream/[0.03]"}`}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(person.id)}
                        aria-label={`Select ${person.name}`}
                        className="h-5 w-5 accent-[#B23A48]"
                      />
                    </td>
                    <td className="max-w-[1px] px-3 py-2.5">
                      <p className="truncate text-[14.5px] font-medium text-cream">{person.name}</p>
                      <p className="truncate text-[12.5px] text-cream/40">{person.email}</p>
                      {/* Below sm the phone and ticket columns are hidden, so
                          they stack under the name rather than disappearing. */}
                      {person.phone && (
                        <p className="truncate text-[12.5px] text-cream/55 tabular-nums sm:hidden">
                          {formatPhone(person.phone)}
                        </p>
                      )}
                      <p className="truncate text-[12px] text-cream/35 lg:hidden">
                        {person.ticketRef}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                      {person.phone ? (
                        // Tappable: staff chase no-shows from a phone, and a
                        // number you can't dial from the list is a number you
                        // have to retype.
                        <a
                          href={`tel:${person.phone}`}
                          className="text-[13px] whitespace-nowrap text-cream/70 tabular-nums underline decoration-cream/20 underline-offset-2 transition hover:text-gold hover:decoration-gold/50"
                        >
                          {formatPhone(person.phone)}
                        </a>
                      ) : (
                        <span className="text-[13px] text-cream/25">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 align-top font-[family-name:var(--font-oswald)] text-[12.5px] text-cream/45 tabular-nums lg:table-cell">
                      {person.ticketRef}
                    </td>
                    <td className="hidden max-w-[1px] truncate px-3 py-2.5 align-top text-[12.5px] lg:table-cell">
                      {person.invitedBy ? (
                        <span className="text-cream/60">{person.invitedBy}</span>
                      ) : (
                        <span className="text-cream/25">Nobody named</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 align-top text-[12.5px] text-cream/45 tabular-nums md:table-cell">
                      {whenRegistered(person.registeredAt)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {person.status === "checked_in" ? (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-sage">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                            {person.checkedInAt ? timeOfDay(person.checkedInAt) : "In"}
                          </span>
                          <button
                            onClick={() => void handleUndoCheckIn(person)}
                            disabled={undoingId === person.id}
                            title={`Mark ${person.name} as not arrived`}
                            className="inline-flex min-h-8 items-center rounded border border-cream/15 px-2.5 text-[11.5px] whitespace-nowrap text-cream/40 transition hover:border-gold/40 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-40"
                          >
                            {undoingId === person.id ? "Undoing…" : "Undo"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12.5px] whitespace-nowrap text-cream/35">
                          Not arrived
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Page
   ---------------------------------------------------------------------- */

function DashboardTool() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsReady, setEventsReady] = useState(false);
  const [eventId, setEventId] = useState("");
  // Tagged with the event it describes, so switching events can never show the
  // previous event's numbers under the new event's name for a frame.
  const [snapshot, setSnapshot] = useState<{ eventId: string; dashboard: Dashboard } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = sortStaffEvents(await getStaffEvents());
        if (!active) return;
        setEvents(list);
        if (list.length > 0) setEventId(list[0].id);
      } catch (err) {
        if (active) setError(getCallableErrorMessage(err));
      } finally {
        if (active) setEventsReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // First paint for an event. Kept separate from refresh() below because the
  // two want opposite things: this one has nothing to show yet, while refresh
  // holds the existing render in place rather than blanking it.
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setRefreshing(false);
    setError(null);
    void (async () => {
      try {
        const dashboard = await getEventDashboard({ eventId });
        if (!active) return;
        setSnapshot({ eventId, dashboard });
        setError(null);
      } catch (err) {
        if (active) setError(getCallableErrorMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  const refresh = useCallback(async () => {
    const requestedId = eventId;
    if (!requestedId) return;
    setRefreshing(true);
    try {
      const dashboard = await getEventDashboard({ eventId: requestedId });
      if (eventIdRef.current !== requestedId) return;
      setSnapshot({ eventId: requestedId, dashboard });
      setError(null);
    } catch (err) {
      if (eventIdRef.current !== requestedId) return;
      setError(getCallableErrorMessage(err));
    } finally {
      if (eventIdRef.current === requestedId) setRefreshing(false);
    }
  }, [eventId]);

  const data = snapshot?.eventId === eventId ? snapshot.dashboard : null;
  const loading = !eventsReady || (Boolean(eventId) && data === null && error === null);
  const selectedEvent = events.find((event) => event.id === eventId);

  const dayColumns: Column[] = (data?.registrationsByDay ?? []).map((bucket) => ({
    key: bucket.date,
    label: dayLabel(bucket.date),
    tick: dayTick(bucket.date),
    value: bucket.count,
  }));

  const hourColumns: Column[] = (data?.checkInsByHour ?? []).map((bucket) => ({
    key: String(bucket.hour),
    label: hourLabel(bucket.hour),
    tick: hourTick(bucket.hour),
    value: bucket.count,
  }));

  return (
    <main
      className={`${anton.variable} ${oswald.variable} relative min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#4a1216_0%,#22090a_38%,#130807_65%,#0D0705_100%)] font-sans text-cream`}
    >
      <FireBackground />

      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <StaffNav events={events} eventId={eventId} onEventChange={setEventId} />

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))] sm:px-8 sm:pt-9 sm:pb-9">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-anton)] text-[clamp(34px,9vw,60px)] leading-[0.95] tracking-[-0.01em] text-cream uppercase">
                Dashboard
              </h1>
              {selectedEvent && (
                <p className="mt-1.5 font-[family-name:var(--font-oswald)] text-[13px] tracking-[0.1em] text-cream/50 uppercase">
                  {selectedEvent.name}
                  {selectedEvent.location ? ` · ${selectedEvent.location}` : ""}
                </p>
              )}
            </div>

            <button
              onClick={() => void refresh()}
              disabled={loading || refreshing || !eventId}
              className="self-start rounded-xl border border-cream/15 px-4 py-2 font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.12em] text-cream/55 uppercase transition hover:border-gold/40 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold disabled:opacity-40"
            >
              {refreshing
                ? "Refreshing…"
                : data
                  ? `Updated ${timeOfDay(data.generatedAt)}`
                  : "Refresh"}
            </button>
          </div>

          {error && (
            <p className="mt-6 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
              {error}
            </p>
          )}

          {!eventId && !loading && (
            <p className="mt-8 text-sm text-cream/50">No events available.</p>
          )}

          {loading && <p className="mt-8 text-sm text-cream/50">Loading…</p>}

          {data && (
            // Holding the previous render at reduced opacity keeps the numbers
            // in place while they refresh — no skeleton flash, no layout jump.
            <div
              className={`mt-7 flex flex-col gap-5 transition-opacity ${refreshing ? "opacity-60" : "opacity-100"}`}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Registered" value={data.totals.registered} />
                <Stat label="In the room" value={data.totals.checkedIn} accent="sage" />
                <Stat label="Yet to arrive" value={data.totals.yetToArrive} accent="gold" />
                <Stat
                  label="Registered today"
                  value={data.totals.registeredToday}
                  note={
                    data.totals.checkedInToday > 0
                      ? `${data.totals.checkedInToday} checked in today`
                      : undefined
                  }
                />
              </div>

              <div className="rounded-2xl border border-cream/12 bg-[#0D0705]/50 px-5 py-4">
                <RoomFill checkedIn={data.totals.checkedIn} total={data.totals.registered} />
              </div>

              <AutoCheckInSwitch eventId={eventId} onChanged={refresh} />

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Signups per day" hint="Accra time">
                  <ColumnChart
                    columns={dayColumns}
                    color={CHART_GOLD}
                    noun="signups"
                    empty="No registrations yet."
                  />
                </Card>

                <Card title="Arrivals by hour" hint="Accra time">
                  <ColumnChart
                    columns={hourColumns}
                    color={CHART_SAGE}
                    noun="arrivals"
                    empty="Nobody has checked in yet."
                  />
                </Card>
              </div>

              <Card
                title="Who is bringing people"
                hint={`${data.attendees.filter((person) => person.invitedBy).length} named someone`}
              >
                <BarList
                  items={data.inviters}
                  color={CHART_GOLD}
                  total={data.totals.registered}
                  empty="Nobody has named an inviter yet."
                />
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Schools" hint={`${data.totals.registered} registered`}>
                  <BarList
                    items={data.schools}
                    color={CHART_CORAL}
                    total={data.totals.registered}
                    empty="Nobody has given a school yet."
                  />
                </Card>

                <Card title="Levels" hint={`${data.totals.registered} registered`}>
                  <BarList
                    items={data.levels}
                    color={CHART_CORAL}
                    total={data.totals.registered}
                    empty="Nobody has given a level yet."
                  />
                </Card>
              </div>

              <AttendeeTable attendees={data.attendees} eventId={eventId} onChanged={refresh} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthGuard>
      <DashboardTool />
    </AuthGuard>
  );
}
