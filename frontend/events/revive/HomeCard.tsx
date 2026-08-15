import Link from "next/link";
import { Anton } from "next/font/google";
import type { EventSummary } from "@/lib/types";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Flyer-style teaser for the Revive event card on the LoveGate homepage. */
export function ReviveHomeCard({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className={`${anton.variable} group block overflow-hidden rounded-[20px] border border-charcoal/10 bg-white shadow-[0_16px_32px_-18px_rgba(46,42,38,0.25)] transition hover:-translate-y-0.5`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(circle_at_50%_110%,#6b1a1f_0%,#2a0d10_45%,#0d0705_85%)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(217,88,58,0.35) 0, transparent 3%), radial-gradient(circle at 75% 20%, rgba(217,88,58,0.3) 0, transparent 2.5%), radial-gradient(circle at 85% 65%, rgba(217,88,58,0.4) 0, transparent 2%), radial-gradient(circle at 15% 75%, rgba(217,88,58,0.3) 0, transparent 2%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="scale-y-[1.15] font-[family-name:var(--font-anton)] text-[56px] tracking-[-0.02em] text-cream uppercase">
            {event.name}
          </div>
        </div>
        <div className="absolute right-0 bottom-3.5 left-0 text-center text-[11px] font-semibold tracking-[0.15em] text-cream/75 uppercase">
          The Fire of God
        </div>
      </div>
      <div className="px-5 pt-4.5 pb-5.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-[7px] w-[7px] rounded-full bg-coral" />
          <div className="text-xs font-semibold tracking-wide text-coral uppercase">
            Registration open
          </div>
        </div>
        <div className="mb-1 font-display text-xl font-bold text-charcoal">{event.name}</div>
        <div className="text-sm text-charcoal/65">{formatDateTime(event.startsAt)}</div>
        {event.location && <div className="mb-3.5 text-sm text-charcoal/65">{event.location}</div>}
        <div className="text-sm font-bold text-coral">View event →</div>
      </div>
    </Link>
  );
}
