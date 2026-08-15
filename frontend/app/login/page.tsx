"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

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
      router.replace("/checkin");
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-4 py-16 text-charcoal">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[20px] border border-charcoal/12 bg-white px-8 py-9 shadow-[0_30px_60px_-32px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="mb-3">
            <path
              d="M4 21V11C4 6.58 7.58 3 12 3C16.42 3 20 6.58 20 11V21"
              stroke="#D9A441"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M4 21H20" stroke="#D9A441" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <h1 className="font-display text-xl font-bold">Staff sign-in</h1>
          <p className="mt-1 text-sm text-charcoal/65">LoveGate check-in &amp; admin tools</p>
        </div>
        <div className="space-y-4">
          <div>
            <label
              className="block text-xs font-semibold tracking-wide text-charcoal/60 uppercase"
              htmlFor="email"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-charcoal/18 bg-cream px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-coral focus:ring-[3px] focus:ring-coral/15"
            />
          </div>
          <div>
            <label
              className="block text-xs font-semibold tracking-wide text-charcoal/60 uppercase"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-charcoal/18 bg-cream px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-coral focus:ring-[3px] focus:ring-coral/15"
            />
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-coral px-4 py-2.5 text-sm font-display font-bold text-cream transition hover:bg-coral-dark disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
