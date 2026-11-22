import type { EventSession } from "@/lib/types";
import { dayOf, isNightSession, monthOf, timeOf, weekdayOf } from "@/lib/eventShape";

/** The colour the ticket sits on — the notches are punched out in it. */
export const TICKET_GROUND = "#120605";

const ORDINALS = ["one", "two", "three", "four", "five", "six"];

function periodOf(session: EventSession): string {
  if (isNightSession(session)) return "night";
  const hour = Number(
    new Date(session.startsAt).toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      hour: "numeric",
      hour12: false,
    })
  );
  return hour < 12 ? "morning" : "afternoon";
}

/**
 * One stub. Night sessions are drawn at night — crimson on black — and day
 * sessions in warm morning light, so a weekend of gatherings reads as one
 * weekend rather than a list of unrelated dates.
 */
function Stub({ session, label }: { session: EventSession; label: string }) {
  const night = isNightSession(session);
  const ink = night ? "text-[#FBF3E7]" : "text-[#2A0A0E]";
  const muted = night ? "text-[#FBF3E7]/60" : "text-[#2A0A0E]/65";
  const rule = night ? "border-[#FBF3E7]/15" : "border-[#2A0A0E]/15";
  const term = `w-12 shrink-0 pt-0.5 font-[family-name:var(--font-oswald)] text-[11px] font-semibold tracking-[0.16em] uppercase ${muted}`;

  return (
    <div
      className={`relative flex flex-1 flex-col px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9 ${ink} ${
        night
          ? "bg-[radial-gradient(circle_at_30%_120%,#9B1027_0%,#4A0812_45%,#1A0607_100%)]"
          : "bg-[linear-gradient(165deg,#FBE3B4_0%,#F4B46A_55%,#E7804A_100%)]"
      }`}
    >
      <div className={`font-[family-name:var(--font-oswald)] text-[12px] font-semibold tracking-[0.2em] uppercase ${muted}`}>
        {label}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="font-[family-name:var(--font-anton)] text-[92px] leading-[0.8] tracking-[-0.02em] sm:text-[112px]">
          {dayOf(session.startsAt)}
        </div>
        <div className="pb-1 font-[family-name:var(--font-oswald)] text-[15px] leading-tight font-semibold tracking-[0.08em] uppercase">
          {weekdayOf(session.startsAt)}
          <br />
          <span className={muted}>{monthOf(session.startsAt)}</span>
        </div>
      </div>

      <div className="mt-5 font-[family-name:var(--font-anton)] text-[30px] leading-none tracking-[0.01em] uppercase sm:text-[34px]">
        {session.name}
      </div>

      <dl className={`mt-6 grid gap-3 border-t pt-5 text-[15px] leading-snug ${rule}`}>
        <div className="flex gap-4">
          <dt className={term}>Time</dt>
          <dd className="font-semibold">{timeOf(session.startsAt)}</dd>
        </div>
        {session.location && (
          <div className="flex gap-4">
            <dt className={term}>Venue</dt>
            <dd>
              {session.locationUrl ? (
                <a
                  href={session.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded underline decoration-current/40 underline-offset-4 transition hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {session.location} ↗
                </a>
              ) : (
                session.location
              )}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * The tear line between two stubs: dashed, with a notch punched out of each
 * edge. Horizontal when the stubs stack on a phone, vertical side by side.
 */
function Perforation() {
  const notch = "absolute h-7 w-7 rounded-full";
  return (
    <div aria-hidden className="relative z-10 h-0 sm:h-auto sm:w-0">
      <div className="absolute inset-x-5 top-0 border-t-2 border-dashed border-[#FBF3E7]/35 sm:inset-x-auto sm:inset-y-5 sm:left-0 sm:border-t-0 sm:border-l-2" />
      <div
        className={`${notch} top-0 -left-3.5 -translate-y-1/2 sm:-top-3.5 sm:left-0 sm:-translate-x-1/2 sm:translate-y-0`}
        style={{ background: TICKET_GROUND }}
      />
      <div
        className={`${notch} top-0 -right-3.5 -translate-y-1/2 sm:top-auto sm:-bottom-3.5 sm:left-0 sm:-translate-x-1/2 sm:translate-y-0`}
        style={{ background: TICKET_GROUND }}
      />
    </div>
  );
}

/**
 * The event's sessions as one ticket with a stub per session. One registration
 * covers every session, and the page's centrepiece says so by being a single
 * ticket you could tear along the dotted lines.
 *
 * Expects the Anton and Oswald font variables to be set by an ancestor.
 */
export function SessionTicket({ sessions }: { sessions: EventSession[] }) {
  const multi = sessions.length > 1;
  return (
    <div className="overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(160,16,42,0.6)] ring-1 ring-[#FBF3E7]/10">
      <div className="flex flex-col sm:flex-row">
        {sessions.map((session, index) => {
          const when = `${weekdayOf(session.startsAt)} ${periodOf(session)}`;
          const label = multi ? `Part ${ORDINALS[index] ?? index + 1} · ${when}` : when;
          return (
            <div key={`${session.name}-${session.startsAt}`} className="contents">
              {index > 0 && <Perforation />}
              <Stub session={session} label={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
