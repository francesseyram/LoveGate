"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { registerForEvent, getCallableErrorMessage } from "@/lib/functions";
import type { EventSession, EventSummary, RegisterForEventResult } from "@/lib/types";
import { dayOf, eventSessions, monthOf, shortWeekdayOf, timeOf } from "@/lib/eventShape";
import { QRTicket } from "./QRTicket";

const LEVEL_OPTIONS = ["100", "200", "300", "400", "Graduate", "Alumni", "Other"];

function formatEventDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Field key → the id of the control it belongs to, for focusing the first miss. */
const FIELD_IDS: Record<string, string> = {
  name: "reg-name",
  email: "reg-email",
  school: "reg-school",
  phone: "reg-phone",
  level: "reg-level",
};

/**
 * One labelled control plus its error line.
 *
 * Defined at module scope on purpose. Declared inside RegistrationForm it would
 * be a new component type on every render, so React would unmount and remount
 * the input under it after each keystroke — the field would lose focus and, on
 * a phone, the keyboard would close on every character typed.
 */
function Field({
  id,
  label,
  labelClass,
  error,
  errorTextClass,
  className = "",
  children,
}: {
  id: string;
  label: string;
  labelClass: string;
  error?: string;
  errorTextClass: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className={errorTextClass}>
          {error}
        </p>
      )}
    </div>
  );
}

/** "Sun 29 Nov · 11:00 AM" */
function whenOf(session: EventSession): string {
  return `${shortWeekdayOf(session.startsAt)} ${dayOf(session.startsAt)} ${monthOf(session.startsAt)} · ${timeOf(session.startsAt)}`;
}

/**
 * The tick-box for a sister event, with that event's flyer beside it so
 * nobody signs up for something they haven't seen. Once ticked it spells out
 * exactly what they're getting: both events, one ticket.
 */
function CompanionOptIn({
  companion,
  thisEventName,
  thisWhen,
  checked,
  onChange,
  isRevive,
}: {
  companion: EventSummary;
  thisEventName: string;
  thisWhen?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  isRevive: boolean;
}) {
  const [flyerFailed, setFlyerFailed] = useState(false);
  const session = eventSessions(companion)[0];
  const showFlyer = Boolean(companion.coverPhotoUrl) && !flyerFailed;

  const frame = isRevive
    ? checked
      ? "border-gold bg-gold/[0.12]"
      : "border-gold/30 bg-cream/[0.04] hover:border-gold/60"
    : checked
      ? "border-coral bg-coral/[0.06]"
      : "border-charcoal/15 bg-cream hover:border-coral/50";
  const ink = isRevive ? "text-cream" : "text-charcoal";
  const muted = isRevive ? "text-cream/60" : "text-charcoal/60";

  return (
    <div className="mt-8">
      <label
        className={`flex cursor-pointer gap-4 rounded-[14px] border-[1.5px] p-4 font-sans transition sm:gap-5 sm:p-5 ${frame}`}
      >
        {showFlyer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={companion.coverPhotoUrl}
            alt={`${companion.name} flyer`}
            onError={() => setFlyerFailed(true)}
            className="aspect-[4/5] w-[96px] shrink-0 rounded-[8px] object-cover sm:w-[132px]"
          />
        ) : (
          <div
            aria-hidden
            className={`flex aspect-[4/5] w-[96px] shrink-0 flex-col items-center justify-center rounded-[8px] sm:w-[132px] ${
              isRevive
                ? "bg-[linear-gradient(165deg,#FBE3B4_0%,#F4B46A_55%,#E7804A_100%)] text-[#2A0A0E]"
                : "bg-coral text-cream"
            }`}
          >
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase">
              {shortWeekdayOf(session.startsAt)}
            </span>
            <span className="font-[family-name:var(--font-anton)] text-[46px] leading-none sm:text-[56px]">
              {dayOf(session.startsAt)}
            </span>
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase">{monthOf(session.startsAt)}</span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className={`text-[12px] font-semibold tracking-[0.14em] uppercase ${isRevive ? "text-gold" : "text-coral-dark"}`}>
            Also coming to
          </div>
          <div className={`mt-1 text-[20px] leading-tight font-semibold sm:text-[22px] ${ink}`}>{companion.name}</div>
          <div className={`mt-1.5 text-[14px] leading-snug ${muted}`}>
            {whenOf(session)}
            {session.location && (
              <>
                <br />
                {session.location}
              </>
            )}
          </div>
          {companion.description && (
            <p className={`mt-2 line-clamp-3 text-[13.5px] leading-snug ${muted}`}>{companion.description}</p>
          )}

          <div className="mt-auto flex items-start gap-3 pt-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              className={`mt-0.5 h-5 w-5 shrink-0 ${isRevive ? "accent-[#D9A441]" : "accent-[#B23A48]"}`}
            />
            <span className={`text-[15px] leading-snug font-semibold ${ink}`}>
              Register me for {companion.name} too
            </span>
          </div>
        </div>
      </label>

      <p aria-live="polite" className={`mt-3 px-1 font-sans text-[13.5px] leading-snug ${muted}`}>
        {checked
          ? `You'll be registered for ${thisEventName}${thisWhen ? ` (${thisWhen})` : ""} and ${companion.name} (${whenOf(session)}) with the details above. One ticket gets you into both.`
          : `Uses the details above. You'll get one ticket that works at both.`}
      </p>
    </div>
  );
}

/**
 * Shared registration mechanics (validation, duplicate check, QR + email trigger)
 * embedded in every event's custom themed page. `theme` picks the visual skin —
 * "neutral" for the plain LoveGate look, "revive" (or a future event's own skin)
 * for a fully event-branded card. Logic and fields are identical either way.
 *
 * Validation reports per field rather than as one banner at the top. This form
 * is taller than a phone screen, so a single banner above the fold meant
 * tapping "Get ticket" and watching nothing happen — the message was real, it
 * was just scrolled off-screen. Now the first offending field is scrolled to
 * and focused, and each message sits under the input it is about.
 */
export function RegistrationForm({
  eventId,
  eventName,
  eventStartsAt,
  eventLocation,
  eventLocationUrl,
  sessions,
  companion,
  schoolDefault = "",
  theme = "neutral",
}: {
  eventId: string;
  eventName: string;
  eventStartsAt?: string;
  eventLocation?: string;
  eventLocationUrl?: string;
  /** Every session the ticket covers; when there's more than one the ticket lists them all. */
  sessions?: EventSession[];
  /** A sister event to offer with a tick-box; see `EventSummary.companionSlug`. */
  companion?: EventSummary;
  /** Pre-filled into School and still editable; see `EventSummary.schoolDefault`. */
  schoolDefault?: string;
  theme?: "neutral" | "revive";
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState(schoolDefault);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [invitedBy, setInvitedBy] = useState("");
  const [level, setLevel] = useState("");
  const [alsoCompanion, setAlsoCompanion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RegisterForEventResult | null>(null);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Tell us who the ticket is for.";
    if (!email.includes("@")) next.email = "Your ticket is emailed here, so it needs a real address.";
    if (!school.trim()) next.school = "Let us know which school you're coming from.";
    // Count digits only, matching the server's check in
    // backend/functions/src/registration.ts — counting punctuation here let
    // through numbers the server then rejected.
    if (phone.replace(/\D/g, "").length < 9) next.phone = "That's not a full phone number yet.";
    if (!level) next.level = "Pick your level.";
    return next;
  }

  /** Clears one field's message as soon as the person starts fixing it. */
  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBannerError(null);

    const errors = validate();
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) {
      const el = document.getElementById(FIELD_IDS[first]);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      // Focusing raises the keyboard over the field we just scrolled to, so
      // let the scroll settle first.
      setTimeout(() => el?.focus({ preventScroll: true }), 320);
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
        invitedBy: invitedBy.trim() || undefined,
        alsoEventId: companion && alsoCompanion ? companion.id : undefined,
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
    setSchool(schoolDefault);
    setPhone("");
    setWhatsapp("");
    setInvitedBy("");
    setLevel("");
    setAlsoCompanion(false);
    setBannerError(null);
    setFieldErrors({});
    setResult(null);
  }

  const eventDate = formatEventDate(eventStartsAt);

  // What this event's ticket covers on its own, as sessions.
  const ownSessions: EventSession[] =
    sessions ??
    (eventStartsAt
      ? [{ name: eventName, startsAt: eventStartsAt, location: eventLocation, locationUrl: eventLocationUrl }]
      : []);
  const ticketCoversCompanion = Boolean(companion && result?.companion?.sharesTicket);
  const ticketSessions =
    ticketCoversCompanion && companion ? [...ownSessions, ...eventSessions(companion)] : sessions;
  const isRevive = theme === "revive";

  // Padding steps up with the viewport instead of starting at 36px. On a 390px
  // phone the old value left a 248px column inside the card; this leaves 310.
  const cardClass = isRevive
    ? "w-full max-w-[760px] rounded-[20px] border border-gold/35 bg-[linear-gradient(155deg,rgba(58,15,18,0.92),rgba(13,7,5,0.97))] p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] font-[family-name:var(--font-oswald)] box-border sm:p-9 lg:p-11"
    : "w-full max-w-[760px] rounded-[20px] border border-charcoal/12 bg-white p-5 shadow-[0_20px_40px_-20px_rgba(178,58,72,0.25)] box-border sm:p-9 lg:p-11";

  const labelClass = isRevive
    ? "text-[13.5px] font-semibold tracking-[0.08em] text-gold/85 uppercase"
    : "text-[13.5px] font-semibold tracking-wide text-charcoal/60 uppercase";

  const inputBase =
    "h-[58px] w-full rounded-[10px] border-[1.5px] px-4 font-sans text-[17px] outline-none transition";
  const inputClass = isRevive
    ? `${inputBase} border-gold/40 bg-cream/[0.06] text-cream focus:border-gold focus:ring-[3px] focus:ring-gold/25`
    : `${inputBase} border-charcoal/18 bg-cream text-charcoal focus:border-coral focus:ring-[3px] focus:ring-coral/15`;
  const inputErrorClass = isRevive
    ? `${inputBase} border-coral bg-coral/10 text-cream focus:border-coral focus:ring-[3px] focus:ring-coral/30`
    : `${inputBase} border-coral bg-coral/5 text-charcoal focus:border-coral focus:ring-[3px] focus:ring-coral/20`;

  const errorTextClass = isRevive
    ? "font-sans text-[13px] leading-snug text-[#F2C1C6]"
    : "font-sans text-[13px] leading-snug text-coral-dark";

  const bannerClass = isRevive
    ? "mb-6 rounded-[10px] border border-coral/45 bg-coral/18 px-4 py-3 font-sans text-[13.5px] leading-snug text-[#F2C1C6]"
    : "mb-6 rounded-[10px] border border-coral/25 bg-coral/8 px-4 py-3 text-[13.5px] leading-snug text-coral-dark";

  const alreadyBannerClass = isRevive
    ? "mb-5 rounded-[10px] border border-gold/45 bg-gold/15 px-4 py-3 font-sans text-[13.5px] leading-snug text-gold"
    : "mb-5 rounded-[10px] border border-coral/25 bg-coral/8 px-4 py-3 text-[13.5px] leading-snug text-coral-dark";

  /** Shared wiring for a control that can show an error. */
  function errorProps(field: string) {
    const invalid = Boolean(fieldErrors[field]);
    return {
      className: invalid ? inputErrorClass : inputClass,
      "aria-invalid": invalid,
      "aria-describedby": invalid ? `${FIELD_IDS[field]}-error` : undefined,
    };
  }

  return (
    <div className={cardClass}>
      {result ? (
        <div className="flex flex-col items-center">
          {result.alreadyRegistered && !result.companion && (
            <p className={`${alreadyBannerClass} w-full max-w-[420px] text-center`}>
              You&apos;re already registered for this event. Here&apos;s your ticket.
            </p>
          )}
          {result.companion && companion && (
            <p className={`${alreadyBannerClass} w-full max-w-[420px] text-center`}>
              {result.companion.sharesTicket
                ? result.alreadyRegistered && result.companion.alreadyRegistered
                  ? `You were already registered for ${eventName} and ${companion.name}. This one ticket gets you into both.`
                  : `You're registered for ${eventName} and ${companion.name}. This one ticket gets you into both.`
                : `You're registered for both, with a separate ticket for ${companion.name} from when you signed up for it. Check your email for it.`}
            </p>
          )}
          <QRTicket
            theme={theme}
            registration={result.registration}
            qrImage={result.qrImage}
            eventName={ticketCoversCompanion && companion ? `${eventName} + ${companion.name}` : eventName}
            eventStartsAt={eventStartsAt}
            eventLocation={eventLocation}
            eventLocationUrl={eventLocationUrl}
            sessions={ticketSessions}
          />
          <button
            type="button"
            onClick={reset}
            className={
              isRevive
                ? "mt-5 min-h-11 px-3 font-sans text-sm text-cream/45 underline hover:text-cream/70"
                : "mt-5 min-h-11 px-3 font-sans text-sm text-charcoal/50 underline hover:text-charcoal/70"
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
                ? "mb-2 text-[clamp(28px,7.5vw,36px)] leading-tight font-semibold tracking-wide text-cream uppercase"
                : "mb-2 font-display text-[clamp(27px,7vw,36px)] leading-tight font-bold text-charcoal"
            }
          >
            Get your ticket
          </h3>
          <p
            className={
              isRevive
                ? "mb-7 text-[15.5px] tracking-wide text-cream/60"
                : "mb-7 text-[15.5px] text-charcoal/65"
            }
          >
            {sessions && sessions.length > 1
              ? sessions.map((session) => session.name).join(" + ")
              : `${eventName}${eventDate ? ` · ${eventDate}` : ""}`}
          </p>

          {bannerError && (
            <p role="alert" className={bannerClass}>
              {bannerError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="reg-name" label="Full name" labelClass={labelClass} errorTextClass={errorTextClass} error={fieldErrors.name}>
              <input
                id="reg-name"
                placeholder="Ama Owusu"
                required
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                {...errorProps("name")}
              />
            </Field>

            <Field id="reg-email" label="Email" labelClass={labelClass} errorTextClass={errorTextClass} error={fieldErrors.email}>
              <input
                id="reg-email"
                type="email"
                placeholder="ama@email.com"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                {...errorProps("email")}
              />
            </Field>

            <Field id="reg-school" label="School" labelClass={labelClass} errorTextClass={errorTextClass} error={fieldErrors.school}>
              <input
                id="reg-school"
                placeholder="University of Ghana"
                required
                autoComplete="organization"
                autoCapitalize="words"
                enterKeyHint="next"
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  clearError("school");
                }}
                {...errorProps("school")}
              />
            </Field>

            <Field id="reg-phone" label="Phone number" labelClass={labelClass} errorTextClass={errorTextClass} error={fieldErrors.phone}>
              <input
                id="reg-phone"
                type="tel"
                placeholder="020 000 0000"
                required
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
                {...errorProps("phone")}
              />
            </Field>

            <Field id="reg-whatsapp" label="WhatsApp number" labelClass={labelClass} errorTextClass={errorTextClass}>
              <input
                id="reg-whatsapp"
                type="tel"
                placeholder="Leave blank if same as phone"
                autoComplete="off"
                inputMode="tel"
                enterKeyHint="next"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field id="reg-level" label="Level" labelClass={labelClass} errorTextClass={errorTextClass} error={fieldErrors.level}>
              <select
                id="reg-level"
                required
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  clearError("level");
                }}
                {...errorProps("level")}
              >
                <option value="" disabled>
                  Select your level
                </option>
                {LEVEL_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                    className={isRevive ? "bg-[#22090a]" : undefined}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="reg-invited-by"
              label="Who invited you?"
              labelClass={labelClass}
              errorTextClass={errorTextClass}
              className="sm:col-span-2 sm:max-w-[calc(50%-10px)]"
            >
              <input
                id="reg-invited-by"
                placeholder="Optional"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="done"
                value={invitedBy}
                onChange={(e) => setInvitedBy(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {companion && (
            <CompanionOptIn
              companion={companion}
              thisEventName={eventName}
              thisWhen={ownSessions[0] ? whenOf(ownSessions[0]) : undefined}
              checked={alsoCompanion}
              onChange={setAlsoCompanion}
              isRevive={isRevive}
            />
          )}

          <button
            type="submit"
            disabled={submitting}
            className={
              isRevive
                ? "mt-8 h-[60px] w-full rounded-xl bg-[linear-gradient(135deg,#D9A441,#B23A48)] text-[17px] font-bold tracking-wide text-[#1A0D0A] uppercase shadow-[0_12px_24px_-8px_rgba(217,164,65,0.4)] transition hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold active:translate-y-px active:shadow-none disabled:opacity-50 sm:text-[18px]"
                : "mt-8 h-[60px] w-full rounded-xl bg-coral font-display text-[18px] font-bold text-cream shadow-[0_10px_20px_-8px_rgba(178,58,72,0.5)] transition hover:bg-coral-dark focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-coral active:translate-y-px active:shadow-none disabled:opacity-50 sm:text-[19px]"
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
