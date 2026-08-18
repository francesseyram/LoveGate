"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import type { EventSummary } from "@/lib/types";

/**
 * The staff toolbar, shared by every page behind sign-in.
 *
 * The three tools used to link to each other ad hoc — a back arrow here, a
 * "Reminders →" there — so where you could go depended on where you happened to
 * be, and nothing told you where you were. This puts the same three
 * destinations in the same place on every page with the current one marked, and
 * hoists the event picker out of each page so switching event doesn't mean
 * finding a different control on each screen.
 *
 * Sticky because the event picker is the thing you reach for mid-task, and on
 * the dashboard that means after scrolling past a long roster.
 */

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/checkin", label: "Check-in" },
  { href: "/admin/reminders", label: "Reminders" },
];

function GateMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 21V11a8 8 0 0 1 16 0v10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function StaffNav({
  events,
  eventId,
  onEventChange,
  status,
}: {
  events: EventSummary[];
  eventId: string;
  onEventChange: (eventId: string) => void;
  /** Page-specific state — the check-in desk's connection and queue badges. */
  status?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cream/10 bg-[#0D0705]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 sm:px-8">
        <Link
          href="/"
          title="Back to the public site"
          className="flex shrink-0 items-center gap-2 rounded-lg text-cream transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral text-cream">
            <GateMark className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-extrabold tracking-[-0.03em]">LoveGate</span>
        </Link>

        {/* Scrolls rather than wraps on a phone, so the row keeps its shape. */}
        <nav
          aria-label="Staff tools"
          className="order-last -mx-1 w-full overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:px-0"
        >
          <div className="flex w-max gap-1 rounded-xl border border-cream/10 bg-cream/[0.04] p-1">
            {TABS.map((tab) => {
              // Exact match: /admin/reminders must not also light up /admin.
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3.5 py-1.5 font-[family-name:var(--font-oswald)] text-[12px] tracking-[0.1em] whitespace-nowrap uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                    active
                      ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(217,164,65,0.28)]"
                      : "text-cream/45 hover:bg-cream/[0.05] hover:text-cream"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {status}

          {events.length > 0 && (
            <select
              value={eventId}
              onChange={(event) => onEventChange(event.target.value)}
              aria-label="Event"
              className="max-w-[46vw] truncate rounded-lg border border-gold/35 bg-cream/[0.06] px-3 py-1.5 font-sans text-[14px] text-cream outline-none focus:border-gold sm:max-w-none"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id} className="bg-[#22090a] text-cream">
                  {event.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleSignOut}
            className="rounded font-[family-name:var(--font-oswald)] text-[11px] tracking-[0.12em] whitespace-nowrap text-cream/40 uppercase transition hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
