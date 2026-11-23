import { themeFor } from "@/events/themes";
import type { EventSummary } from "@/lib/types";

/** The ground every staff page sits on; the backdrop fades into it. */
export const STAFF_GROUND = "#0D0705";

/**
 * The selected event's own atmosphere, drawn across the top of a staff page
 * behind the toolbar and the page title: Fire Night's dashboard burns, an
 * Embers event's drifts. It is the event page's hero, cut down to a band and
 * faded into the page ground before the tables and charts start, so nothing
 * that has to be read sits on moving flame.
 *
 * Switching event in the picker swaps it, which also makes the selected
 * event hard to mistake for another.
 */
export function StaffBackdrop({ event }: { event?: Pick<EventSummary, "theme"> | null }) {
  const theme = themeFor(event?.theme);
  return (
    <div
      aria-hidden
      // Keyed so a change of theme remounts the canvas rather than leaving the
      // previous event's animation loop running underneath.
      key={event?.theme ?? "none"}
      className="pointer-events-none absolute inset-x-0 top-0 h-[min(520px,70svh)] overflow-hidden"
    >
      {event && theme.heroBackground}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${STAFF_GROUND}80 0%, transparent 16%, transparent 62%, ${STAFF_GROUND} 100%)`,
        }}
      />
    </div>
  );
}
