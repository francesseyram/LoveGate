"use client";

import { useState, type FormEvent } from "react";
import { registerForEvent, getCallableErrorMessage } from "@/lib/functions";
import type { RegisterForEventResult } from "@/lib/types";
import { QRTicket } from "./QRTicket";

const LEVEL_OPTIONS = ["100", "200", "300", "400", "Graduate", "Alumni", "Other"];

function formatEventDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Shared registration mechanics (validation, duplicate check, QR + email trigger)
 * embedded in every event's custom themed page. `theme` picks the visual skin —
 * "neutral" for the plain LoveGate look, "revive" (or a future event's own skin)
 * for a fully event-branded card. Logic and fields are identical either way.
 */
export function RegistrationForm({
  eventId,
  eventName,
  eventStartsAt,
  eventLocation,
  eventLocationUrl,
  theme = "neutral",
}: {
  eventId: string;
  eventName: string;
  eventStartsAt?: string;
  eventLocation?: string;
  eventLocationUrl?: string;
  theme?: "neutral" | "revive";
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [level, setLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterForEventResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBannerError(null);

    const trimmedName = name.trim();
    // Count digits only, matching the server's check in
    // backend/functions/src/registration.ts — counting punctuation here let
    // through numbers the server then rejected.
    const phoneDigits = phone.replace(/\D/g, "");
    if (
      !trimmedName ||
      !email.includes("@") ||
      !school.trim() ||
      phoneDigits.length < 9 ||
      !level
    ) {
      setBannerError("Please fill in all required fields to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerForEvent({
        eventId,
        name,
        phone,
        email,
        school,
        level,
        whatsapp: whatsapp.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setBannerError(getCallableErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setName("");
    setEmail("");
    setSchool("");
    setPhone("");
    setWhatsapp("");
    setLevel("");
    setBannerError(null);
    setResult(null);
  }

  const eventDate = formatEventDate(eventStartsAt);
  const isRevive = theme === "revive";

  const cardClass = isRevive
    ? "w-full max-w-[760px] rounded-[20px] border border-gold/35 bg-[linear-gradient(155deg,rgba(58,15,18,0.92),rgba(13,7,5,0.97))] p-9 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] font-[family-name:var(--font-oswald)] box-border sm:p-11"
    : "w-full max-w-[760px] rounded-[20px] border border-charcoal/12 bg-white p-9 shadow-[0_20px_40px_-20px_rgba(178,58,72,0.25)] box-border sm:p-11";

  const labelClass = isRevive
    ? "text-[14px] font-semibold tracking-[0.08em] text-gold/85 uppercase"
    : "text-[14px] font-semibold tracking-wide text-charcoal/60 uppercase";

  const inputClass = isRevive
    ? "h-[60px] w-full rounded-[10px] border-[1.5px] border-gold/40 bg-cream/[0.06] px-4 font-sans text-[17px] text-cream outline-none focus:border-gold focus:ring-[3px] focus:ring-gold/25"
    : "h-[60px] w-full rounded-[10px] border-[1.5px] border-charcoal/18 bg-cream px-4 font-sans text-[17px] text-charcoal outline-none focus:border-coral focus:ring-[3px] focus:ring-coral/15";

  const bannerClass = isRevive
    ? "mb-6 rounded-[10px] border border-coral/45 bg-coral/18 px-4 py-3 font-sans text-[13px] leading-snug text-[#F2C1C6]"
    : "mb-6 rounded-[10px] border border-coral/25 bg-coral/8 px-4 py-3 text-[13px] leading-snug text-coral-dark";

  const alreadyBannerClass = isRevive
    ? "mb-5 rounded-[10px] border border-gold/45 bg-gold/15 px-4 py-3 font-sans text-[13px] leading-snug text-gold"
    : "mb-5 rounded-[10px] border border-coral/25 bg-coral/8 px-4 py-3 text-[13px] leading-snug text-coral-dark";

  return (
    <div className={cardClass}>
      {result ? (
        <div className="flex flex-col items-center">
          {result.alreadyRegistered && (
            <p className={`${alreadyBannerClass} w-full max-w-sm text-center`}>
              You&apos;re already registered for this event — here&apos;s your ticket.
            </p>
          )}
          <QRTicket
            theme={theme}
            registration={result.registration}
            qrImage={result.qrImage}
            eventName={eventName}
            eventStartsAt={eventStartsAt}
            eventLocation={eventLocation}
            eventLocationUrl={eventLocationUrl}
          />
          <button
            type="button"
            onClick={reset}
            className={
              isRevive
                ? "mt-5 font-sans text-sm text-cream/45 underline hover:text-cream/70"
                : "mt-5 font-sans text-sm text-charcoal/50 underline hover:text-charcoal/70"
            }
          >
            Register another person
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <h3
            className={
              isRevive
                ? "mb-2 text-[36px] font-semibold tracking-wide text-cream uppercase"
                : "mb-2 font-display text-[36px] font-bold text-charcoal"
            }
          >
            Get your ticket
          </h3>
          <p
            className={
              isRevive
                ? "mb-8 text-[16px] tracking-wide text-cream/60"
                : "mb-8 text-[16px] text-charcoal/65"
            }
          >
            {eventName}
            {eventDate ? ` · ${eventDate}` : ""}
          </p>

          {bannerError && <p className={bannerClass}>{bannerError}</p>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-name" className={labelClass}>
                Full name
              </label>
              <input
                id="reg-name"
                placeholder="Ama Owusu"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-email" className={labelClass}>
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="ama@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-school" className={labelClass}>
                School
              </label>
              <input
                id="reg-school"
                placeholder="University of Ghana"
                required
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reg-phone" className={labelClass}>
                Phone number
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="020 000 0000"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reg-whatsapp" className={labelClass}>
                WhatsApp number
              </label>
              <input
                id="reg-whatsapp"
                type="tel"
                placeholder="Leave blank if same as phone"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reg-level" className={labelClass}>
                Level
              </label>
              <select
                id="reg-level"
                required
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Select your level
                </option>
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option} className={isRevive ? "bg-[#22090a]" : undefined}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={
              isRevive
                ? "mt-8 h-[60px] w-full rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] text-[18px] font-bold tracking-wide text-[#1A0D0A] uppercase shadow-[0_12px_24px_-8px_rgba(217,164,65,0.4)] transition hover:brightness-[1.08] active:translate-y-px active:shadow-none disabled:opacity-50"
                : "mt-8 h-[60px] w-full rounded-xl bg-coral font-display text-[19px] font-bold text-cream shadow-[0_10px_20px_-8px_rgba(178,58,72,0.5)] transition hover:bg-coral-dark active:translate-y-px active:shadow-none disabled:opacity-50"
            }
          >
            {submitting ? "Getting your ticket…" : "Get ticket"}
          </button>
          <p
            className={
              isRevive
                ? "mt-4 text-center font-sans text-[13px] text-cream/40"
                : "mt-4 text-center text-[13px] text-charcoal/50"
            }
          >
            One ticket per person · free entry
          </p>
        </form>
      )}
    </div>
  );
}
