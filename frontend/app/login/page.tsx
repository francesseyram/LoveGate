"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

/**
 * Staff sign-in.
 *
 * A lone centred card on a wide screen wastes the whole viewport, so this is a
 * split: a dark brand panel that says what the tool behind the door actually
 * does, and the form itself on the right. On mobile the panel collapses to a
 * compact header so the form is reachable without scrolling.
 */

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

function GateMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
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

/** What staff actually do once they're through — grounded in the real tools. */
const CAPABILITIES = [
  {
    title: "Scan people in",
    body: "Point the camera at a ticket QR and the door queue keeps moving.",
  },
  {
    title: "Find a ticket by name",
    body: "Phone died or the code won't scan? Search the guest list and check them in by hand.",
  },
  {
    title: "Send a reminder",
    body: "Nudge everyone still marked as going, right before the doors open.",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/admin");
    } catch {
      setError("That email and password don't match a staff account.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-2 h-13 w-full rounded-xl border-[1.5px] border-line bg-canvas px-4 text-[15.5px] text-ink outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/12";
  const labelClass = "text-[12.5px] font-bold tracking-[0.06em] text-ink/55 uppercase";

  return (
    <div
      className={`${jakarta.variable} min-h-screen font-[family-name:var(--font-plus-jakarta)] lg:grid lg:grid-cols-[1.05fr_1fr]`}
    >
      {/* Brand panel */}
      <section className="relative isolate overflow-hidden bg-[#120807] px-6 py-10 sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(178,58,72,0.45)_0%,transparent_58%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_95%,rgba(217,164,65,0.18)_0%,transparent_55%)]"
        />

        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral text-cream">
              <GateMark className="h-5 w-5" />
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.035em]">LoveGate</span>
          </Link>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-gold uppercase">
            Front desk
          </p>
          <h1 className="mt-3 max-w-[16ch] text-[clamp(30px,5.5vw,52px)] leading-[1.02] font-extrabold tracking-[-0.04em] text-cream">
            The door, handled.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-cream/60">
            Sign in to check people in, look up tickets and send reminders. Everything here is for
            Love Inc volunteers working an event.
          </p>

          <ul className="mt-9 hidden max-w-[46ch] flex-col gap-5 lg:flex">
            {CAPABILITIES.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                />
                <div>
                  <p className="text-[15px] font-bold text-cream">{item.title}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-cream/50">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 hidden items-center gap-3 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/love-inc-globe-white.png"
            alt=""
            className="h-10 w-10 object-contain opacity-80"
          />
          <p className="text-[13.5px] text-cream/45">Love Inc Global · University of Ghana, Legon</p>
        </div>
      </section>

      {/* Form */}
      <section className="flex flex-1 items-center justify-center bg-canvas px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-[420px]">
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink sm:text-[30px]">
            Staff sign-in
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/55">
            Use the account you were given. There&apos;s no sign-up, so ask a lead if you need one.
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-coral/25 bg-coral/8 px-4 py-3 text-[14px] leading-snug text-coral-dark"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-7 h-13 w-full rounded-full bg-coral text-[16px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(178,58,72,0.8)] transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-coral active:translate-y-px disabled:opacity-55"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <Link
            href="/"
            className="mt-8 inline-block rounded text-[14px] font-semibold text-ink/50 underline-offset-4 transition hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            ← Back to events
          </Link>
        </div>
      </section>
    </div>
  );
}
