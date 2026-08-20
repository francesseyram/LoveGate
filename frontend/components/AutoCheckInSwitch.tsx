"use client";

import { useEffect, useState } from "react";
import { getCallableErrorMessage, getEventSettings, setEventAutoCheckIn } from "@/lib/functions";

/**
 * Late-arrival mode.
 *
 * Once the programme has started, the queue at the door is people who never
 * registered at all — they fill the form on their phone standing in front of a
 * volunteer, then get told to wait for an email so they can be scanned in.
 * Flipping this on collapses that: registering *is* the check-in, and the door
 * stops handling anyone who is already visibly there.
 *
 * Written as a real switch (`role="switch"`) rather than a checkbox because it
 * takes effect the moment it moves — there is no form to submit, and treating
 * it like a setting to be saved later would leave staff unsure whether it was
 * live.
 */

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
}

/**
 * Every piece of state here is tagged with the event it describes, and read back
 * only when that tag still matches. Switching events mid-flight is the whole
 * hazard — an in-flight response for the previous event must not land on the new
 * one's switch, and the tag makes that impossible rather than merely unlikely.
 */
interface Settings {
  eventId: string;
  autoCheckIn: boolean;
  since: string | null;
}

/**
 * Applies a settings write only while the slot still holds the event it was
 * made for.
 *
 * `loaded` is one slot shared by every event, so a save for the event you just
 * navigated away from must not land on top of the one now on screen. Tagging
 * the value is not enough by itself: the tag stops a stale value being *read*,
 * but a stale write still overwrites the fresh one, and the effect that
 * fetched it will not run again — leaving the switch stuck disabled and
 * reading "off" while late-arrival mode is in fact still on, quietly checking
 * in every walk-up registration.
 *
 * Written as a functional update rather than a ref so the check happens against
 * whatever React actually holds at commit time.
 */
function keepIfStillOn(eventId: string, value: Settings | null) {
  return (current: Settings | null) => (current?.eventId === eventId ? value : current);
}

export function AutoCheckInSwitch({
  eventId,
  /** Lets the page it sits on re-pull its numbers — the room count moves the moment this is on. */
  onChanged,
}: {
  eventId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const [loaded, setLoaded] = useState<Settings | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ eventId: string; message: string } | null>(null);

  const settings = loaded?.eventId === eventId ? loaded : null;
  const saving = savingFor === eventId;
  const error = failure?.eventId === eventId ? failure.message : null;
  const enabled = settings?.autoCheckIn ?? false;
  const since = settings?.since ?? null;
  const ready = settings !== null;

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void (async () => {
      try {
        const fresh = await getEventSettings({ eventId });
        if (!active) return;
        setLoaded({ eventId, autoCheckIn: fresh.autoCheckIn, since: fresh.autoCheckInSince });
      } catch (err) {
        if (active) setFailure({ eventId, message: getCallableErrorMessage(err) });
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  async function toggle() {
    if (!settings || saving) return;
    const requestedId = eventId;
    const previous = settings;
    const next = !settings.autoCheckIn;

    // Move the switch first: it is the one control on this page whose position
    // *is* the state, so it should never lag behind the tap that moved it.
    setLoaded({
      eventId: requestedId,
      autoCheckIn: next,
      since: next ? new Date().toISOString() : null,
    });
    setSavingFor(requestedId);
    setFailure(null);
    try {
      const fresh = await setEventAutoCheckIn({ eventId: requestedId, enabled: next });
      setLoaded(keepIfStillOn(requestedId, { eventId: requestedId, autoCheckIn: fresh.autoCheckIn, since: fresh.autoCheckInSince }));
      await onChanged?.();
    } catch (err) {
      setLoaded(keepIfStillOn(requestedId, previous));
      setFailure((current) =>
        current && current.eventId !== requestedId
          ? current
          : { eventId: requestedId, message: getCallableErrorMessage(err) }
      );
    } finally {
      setSavingFor((current) => (current === requestedId ? null : current));
    }
  }

  const live = ready && enabled;

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        live ? "border-sage/40 bg-sage/[0.08]" : "border-cream/12 bg-[#0D0705]/50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-[62ch]">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.16em] text-gold/85 uppercase">
              Late arrivals
            </h2>
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-sage/15 px-2.5 py-0.5 font-[family-name:var(--font-oswald)] text-[10px] tracking-[0.12em] text-sage uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                On{since ? ` since ${timeOfDay(since)}` : ""}
              </span>
            )}
          </div>

          <p className="mt-3 text-[15px] leading-relaxed text-cream/65">
            {live ? (
              <>
                Anyone who registers from now on is marked{" "}
                <span className="text-sage">checked in</span> straight away and does not need to be
                scanned at the door. They still get their ticket by email.
              </>
            ) : (
              <>
                Registering issues a ticket to be scanned at the door, as normal. Switch this on
                once the doors are open and everyone still signing up is standing in front of you.
              </>
            )}
          </p>

          {live && (
            <p className="mt-2 text-[13px] leading-relaxed text-cream/40">
              Remember to switch it off after the event, or the next person to open the link from
              home counts as being in the room. Anyone marked in error can be reverted from the
              roster below.
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Check people in as they register"
          onClick={() => void toggle()}
          disabled={!eventId || !ready || saving}
          className={`relative h-10 w-[68px] shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold disabled:opacity-40 ${
            enabled ? "border-sage/50 bg-sage/35" : "border-cream/15 bg-cream/[0.08]"
          }`}
        >
          <span
            className={`absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-[left,background-color] duration-200 ${
              enabled ? "left-[calc(100%-2.25rem)] bg-sage" : "left-1 bg-cream/55"
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-coral/40 bg-coral/15 px-4 py-3 text-sm text-[#F2C1C6]">
          {error}
        </p>
      )}
    </section>
  );
}
