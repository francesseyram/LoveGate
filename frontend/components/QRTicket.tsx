import type { Registration } from "@/lib/types";

function formatEventDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#B0801F" strokeWidth="1.7" />
      <path d="M3 9H21M8 3V6M16 3V6" stroke="#B0801F" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M12 21C12 21 19 14.5 19 9.5C19 5.36 15.64 2 12 2C8.36 2 5 5.36 5 9.5C5 14.5 12 21 12 21Z"
        stroke="#B0801F"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke="#B0801F" strokeWidth="1.7" />
    </svg>
  );
}

/**
 * The ticket "paper" is always cream, whatever the event's theme — real
 * tickets have their own stock regardless of what venue they're for. Only
 * the header band (and the notch color, so the punch-outs read correctly
 * against whichever card this sits inside) follow the theme.
 */
export function QRTicket({
  theme = "neutral",
  registration,
  qrImage,
  eventName,
  eventStartsAt,
  eventLocation,
}: {
  theme?: "neutral" | "revive";
  registration: Registration;
  qrImage: string;
  eventName: string;
  eventStartsAt?: string;
  eventLocation?: string;
}) {
  const ticketRef = `LG-${registration.id.slice(-6).toUpperCase()}`;
  const eventDate = formatEventDate(eventStartsAt);
  const eventTime = formatEventTime(eventStartsAt);
  const isRevive = theme === "revive";
  const notchBg = isRevive ? "bg-[#170807]" : "bg-white";

  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-charcoal/10 bg-cream text-charcoal shadow-[0_25px_50px_-20px_rgba(0,0,0,0.5)]">
      <div
        className={
          isRevive
            ? "bg-[linear-gradient(135deg,#D9A441,#B23A48)] px-6 py-4 text-[#1A0D0A]"
            : "bg-coral px-6 py-4 text-cream"
        }
      >
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase opacity-80">E-Ticket</div>
        <div className="mt-0.5 truncate text-xl font-bold">{eventName}</div>
      </div>

      <div className="px-6 pt-5 pb-6">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-charcoal/45 uppercase">
          Admit one
        </div>
        <div className="mt-1 text-2xl font-bold text-charcoal">{registration.name}</div>

        <div className="mt-4 flex flex-col gap-2 text-sm text-charcoal/70">
          {eventDate && (
            <div className="flex items-center gap-2.5">
              <CalendarIcon />
              <span>
                {eventDate}
                {eventTime ? ` · ${eventTime}` : ""}
              </span>
            </div>
          )}
          {eventLocation && (
            <div className="flex items-center gap-2.5">
              <PinIcon />
              <span>{eventLocation}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative px-6">
        <div className="h-0 border-t-2 border-dashed border-charcoal/20" />
        <span className={`absolute top-0 -left-2.5 h-5 w-5 -translate-y-1/2 rounded-full ${notchBg}`} />
        <span className={`absolute top-0 -right-2.5 h-5 w-5 -translate-y-1/2 rounded-full ${notchBg}`} />
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImage}
          alt="Your ticket QR code"
          className="h-40 w-40 rounded-lg border border-charcoal/10 bg-white p-2"
        />
        <div className="text-sm font-bold tracking-[0.15em] text-charcoal">{ticketRef}</div>
        <div className="text-[11px] tracking-[0.12em] text-charcoal/40 uppercase">Scan at entrance</div>
      </div>
    </div>
  );
}
