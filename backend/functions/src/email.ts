import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import { RESEND_FROM_EMAIL } from "./secrets";
import type { EventDoc } from "./types";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Resend's SDK does NOT throw on API errors — it resolves with
 * `{ data: null, error }`. Awaiting it bare therefore swallows every failure
 * (unverified sending domain, rate limit, bad recipient) and reports success,
 * which is exactly how an unverified domain silently ate every confirmation
 * email. Always route sends through here so failures actually surface.
 */
async function send(options: CreateEmailOptions): Promise<void> {
  const { error } = await getResend().emails.send(options);
  if (error) {
    throw new Error(`Resend rejected the email (${error.name}): ${error.message}`);
  }
}

/**
 * Venue line for the email body. When a map link exists the venue name becomes
 * the link — the email is what people open on the way to the event, so
 * "how do I get there" should be one tap, not a copy-paste.
 */
function venueHtml(event: EventDoc): string {
  if (!event.location) return "";
  const name = escapeHtml(event.location);
  if (!event.locationUrl) return ` at ${name}`;
  return ` at <a href="${escapeHtml(event.locationUrl)}">${name}</a>`;
}

function venuePlain(event: EventDoc): string {
  if (!event.location) return "";
  const base = ` at ${event.location}`;
  return event.locationUrl ? `${base}\nDirections: ${event.locationUrl}` : base;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Events are physically in Accra, so always render local time, never the server's. */
export const EVENT_TIME_ZONE = "Africa/Accra";

function formatEventDate(startsAt: Date): string {
  return startsAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });
}

export async function sendConfirmationEmail(params: {
  to: string;
  attendeeName: string;
  event: EventDoc;
  qrPng: Buffer;
}): Promise<void> {
  const { to, attendeeName, event, qrPng } = params;
  const when = formatEventDate(event.startsAt.toDate());
  const wherePlain = venuePlain(event);
  const whereLine = venueHtml(event);

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: `You're registered for ${event.name}`,
    text: `Hi ${attendeeName},\n\nYou're confirmed for ${event.name} on ${when}${wherePlain}.\n\nYour QR ticket is attached — show it at check-in.\n\nSee you there!`,
    html: `
      <p>Hi ${escapeHtml(attendeeName)},</p>
      <p>You're confirmed for <strong>${escapeHtml(event.name)}</strong> on ${when}${whereLine}.</p>
      <p>Show this QR code at check-in — see you there!</p>
      <img src="cid:ticket-qr" alt="Your ticket QR code" width="240" height="240" />
    `,
    attachments: [
      {
        filename: "ticket.png",
        content: qrPng,
        contentId: "ticket-qr",
      },
    ],
  });
}

export async function sendReminderEmail(params: {
  to: string;
  attendeeName: string;
  event: EventDoc;
  qrPng: Buffer;
}): Promise<void> {
  const { to, attendeeName, event, qrPng } = params;
  const when = formatEventDate(event.startsAt.toDate());
  const wherePlain = venuePlain(event);
  const whereLine = venueHtml(event);

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: `Reminder: ${event.name} is coming up`,
    text: `Hi ${attendeeName},\n\nJust a reminder that ${event.name} is happening ${when}${wherePlain}.\n\nYour QR ticket is attached — bring it for check-in.`,
    html: `
      <p>Hi ${escapeHtml(attendeeName)},</p>
      <p>Just a reminder that <strong>${escapeHtml(event.name)}</strong> is happening ${when}${whereLine}.</p>
      <p>Bring this QR code for check-in:</p>
      <img src="cid:ticket-qr" alt="Your ticket QR code" width="240" height="240" />
    `,
    attachments: [
      {
        filename: "ticket.png",
        content: qrPng,
        contentId: "ticket-qr",
      },
    ],
  });
}
