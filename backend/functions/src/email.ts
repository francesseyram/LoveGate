import { Resend } from "resend";
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

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "Love Inc <tickets@loveinc.org>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEventDate(startsAt: Date): string {
  return startsAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
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
  const whereLine = event.location ? ` at ${escapeHtml(event.location)}` : "";

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `You're registered for ${event.name}`,
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
  const whereLine = event.location ? ` at ${escapeHtml(event.location)}` : "";

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Reminder: ${event.name} is coming up`,
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
