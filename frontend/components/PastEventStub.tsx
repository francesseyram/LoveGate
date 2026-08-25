import Link from "next/link";
import Image from "next/image";
import type { EventSummary } from "@/lib/types";

/**
 * A finished event, as the thing you'd have left over from it.
 *
 * Everywhere else on this site an event is a poster you can still act on. Once
 * it's over there is nothing to act on, so it becomes the other artifact this
 * system produces: a torn ticket stub. The flyer sits above the perforation,
 * the printed line below it, and the whole card is cut by two real notches —
 * the same shape the door left in it.
 *
 * The artwork is desaturated until you hover or tab onto it, which is the one
 * bit of motion here: past-ness reads as colour drained out and coming back.
 * It is never the only signal — the printed line says HELD, in words.
 */

/** The ground these stubs are cut out of. The notches are punched in this colour. */
export const STUB_GROUND = "#0D0705";

const ACCRA = "Africa/Accra";

function stubDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: ACCRA,
    })
    .toUpperCase();
}

/** Punched half-circles either side of the perforation. */
function Notch({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ${
        side === "left" ? "-left-[7px]" : "-right-[7px]"
      }`}
      style={{ background: STUB_GROUND }}
    />
  );
}

export function PastEventStub({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative flex flex-col rounded-[18px] bg-[#1A100E] ring-1 ring-cream/10 transition duration-300 hover:-translate-y-1 hover:ring-gold/40 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-t-[18px]">
        {event.coverPhotoUrl ? (
          <Image
            src={event.coverPhotoUrl}
            alt={`${event.name} flyer`}
            fill
            sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, 300px"
            className="object-cover brightness-[0.72] saturate-[0.35] transition duration-500 group-hover:brightness-100 group-hover:saturate-100 group-focus-visible:brightness-100 group-focus-visible:saturate-100 motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(150deg,#3A0F12,#1A100E)] p-4 text-center">
            <span className="font-[family-name:var(--font-anton)] text-[36px] leading-none text-cream/35 uppercase">
              {event.name}
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,#1A100E)]"
        />
      </div>

      {/* The tear. Zero height so it sits exactly on the seam. */}
      <div className="relative h-0">
        <Notch side="left" />
        <Notch side="right" />
      </div>

      <div className="border-t border-dashed border-cream/18 px-4 pt-4 pb-4.5 sm:px-5 sm:pb-5">
        <p className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.08em] text-gold/75">
          HELD &middot; {stubDate(event.startsAt)}
        </p>
        <h3 className="mt-1.5 truncate font-[family-name:var(--font-anton)] text-[26px] leading-none tracking-[-0.01em] text-cream uppercase sm:text-[30px]">
          {event.name}
        </h3>
        {event.location && (
          <p className="mt-2 truncate text-[13.5px] text-cream/45">{event.location}</p>
        )}
        <p className="mt-3.5 font-[family-name:var(--font-plex-mono)] text-[12px] tracking-[0.06em] text-cream/40 transition group-hover:text-gold motion-reduce:transition-none">
          LOOK BACK &rarr;
        </p>
      </div>
    </Link>
  );
}
