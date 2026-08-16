import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import * as logger from "firebase-functions/logger";
import { RESEND_FROM_EMAIL, SITE_URL } from "./secrets";
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

function formatDatePart(startsAt: Date): string {
  return startsAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });
}

function formatTimePart(startsAt: Date): string {
  return startsAt.toLocaleString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });
}

function formatEventDate(startsAt: Date): string {
  return `${formatDatePart(startsAt)} at ${formatTimePart(startsAt)}`;
}

function venuePlain(event: EventDoc): string {
  if (!event.location) return "";
  const base = ` at ${event.location}`;
  return event.locationUrl ? `${base}\nDirections: ${event.locationUrl}` : base;
}

/* -------------------------------------------------------------------------
   Flyer
   ---------------------------------------------------------------------- */

const FLYER_MAX_BYTES = 900_000;

/**
 * Cached per process. A reminder blast sends to every registrant of one event,
 * so without this the same flyer would be refetched hundreds of times.
 * `null` is cached too — a missing flyer shouldn't be retried on every send.
 */
const flyerCache = new Map<string, Buffer | null>();

/**
 * The flyer as bytes, for inlining into the email. Events store
 * `coverPhotoUrl` as a site-relative path, so this needs SITE_URL to resolve.
 * Every failure path returns null: artwork is a nice-to-have and must never
 * take down a confirmation email.
 */
async function fetchFlyer(event: EventDoc): Promise<Buffer | null> {
  const site = SITE_URL.value().replace(/\/$/, "");
  if (!site || !event.coverPhotoUrl) return null;

  const url = event.coverPhotoUrl.startsWith("http")
    ? event.coverPhotoUrl
    : `${site}${event.coverPhotoUrl.startsWith("/") ? "" : "/"}${event.coverPhotoUrl}`;

  const cached = flyerCache.get(url);
  if (cached !== undefined) return cached;

  let result: Buffer | null = null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      logger.warn("Flyer fetch returned a non-OK status", { url, status: response.status });
    } else {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > FLYER_MAX_BYTES) {
        logger.warn("Flyer too large to attach; sending without it", {
          url,
          bytes: bytes.byteLength,
        });
      } else {
        result = bytes;
      }
    }
  } catch (err) {
    logger.warn("Flyer fetch failed; sending without it", { url, err });
  }

  flyerCache.set(url, result);
  return result;
}

function flyerFilename(event: EventDoc): string {
  const ext = event.coverPhotoUrl?.split(".").pop()?.toLowerCase();
  return ext && /^(jpg|jpeg|png|webp|gif)$/.test(ext) ? `flyer.${ext}` : "flyer.jpg";
}

/* -------------------------------------------------------------------------
   Shared shell
   ---------------------------------------------------------------------- */

const INK = "#191512";
const CORAL = "#B23A48";
const GOLD = "#D9A441";
const CREAM = "#FBF3E7";
const DARK = "#120807";
const CANVAS = "#FAF7F2";

/**
 * Table-based, inline-styled shell. Email clients (Outlook especially) do not
 * support flexbox, grid, or external stylesheets, so structure has to be
 * tables and every rule has to live on the element.
 */
function shell(params: {
  preheader: string;
  eyebrow: string;
  eyebrowColor: string;
  heading: string;
  body: string;
  footerNote: string;
}): string {
  const { preheader, eyebrow, eyebrowColor, heading, body, footerNote } = params;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Inbox preview line; hidden in the body itself. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E9E2D7;">

            <tr>
              <td style="background:${DARK};padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:19px;font-weight:800;letter-spacing:-0.4px;color:${CREAM};">
                      Love<span style="color:${CORAL};">Gate</span>
                    </td>
                    <td align="right" style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(251,243,231,0.5);">
                      Love Inc Global
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 28px 0 28px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${eyebrowColor};">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 style="margin:10px 0 0 0;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-1px;color:${INK};">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>

            ${body}

            <tr>
              <td style="padding:8px 28px 30px 28px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:rgba(25,21,18,0.45);">
                  ${footerNote}
                </p>
              </td>
            </tr>

            <tr>
              <td style="background:${CANVAS};border-top:1px solid #E9E2D7;padding:18px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(25,21,18,0.45);">
                  Love Inc Global · University of Ghana, Legon<br />
                  You're receiving this because you registered for an event with LoveGate.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The flyer, full width at the top of the card. Omitted when unavailable. */
function flyerBlock(hasFlyer: boolean, event: EventDoc): string {
  if (!hasFlyer) return "";
  return `
            <tr>
              <td style="padding:26px 28px 0 28px;">
                <img src="cid:event-flyer" alt="${escapeHtml(event.name)}" width="544"
                     style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;border:1px solid #E9E2D7;" />
              </td>
            </tr>`;
}

/** Label/value rows for when and where. */
function detailsBlock(event: EventDoc): string {
  const startsAt = event.startsAt.toDate();
  const venue = event.location
    ? `
                  <tr>
                    <td style="padding:14px 0 0 0;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(25,21,18,0.4);">Where</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:600;color:${INK};">${escapeHtml(event.location)}</div>
                      ${
                        event.locationUrl
                          ? `<a href="${escapeHtml(event.locationUrl)}" style="font-size:14px;color:${CORAL};text-decoration:underline;">Open in Maps</a>`
                          : ""
                      }
                    </td>
                  </tr>`
    : "";

  return `
            <tr>
              <td style="padding:22px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:${CANVAS};border:1px solid #E9E2D7;border-radius:12px;padding:18px;">
                  <tr>
                    <td>
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(25,21,18,0.4);">When</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:600;color:${INK};">${escapeHtml(formatDatePart(startsAt))}</div>
                      <div style="font-size:15px;color:rgba(25,21,18,0.6);">${escapeHtml(formatTimePart(startsAt))}</div>
                    </td>
                  </tr>${venue}
                </table>
              </td>
            </tr>`;
}

/** The QR, on its own high-contrast panel so it scans off a screen. */
function ticketBlock(params: { ticketRef?: string; caption: string }): string {
  const { ticketRef, caption } = params;
  return `
            <tr>
              <td style="padding:22px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:${DARK};border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:26px 20px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD};">
                        Admit one
                      </div>
                      <img src="cid:ticket-qr" alt="Your ticket QR code" width="200" height="200"
                           style="display:block;margin:14px auto 0 auto;width:200px;height:200px;background:#ffffff;padding:12px;border-radius:10px;" />
                      ${
                        ticketRef
                          ? `<div style="margin-top:14px;font-size:15px;font-weight:700;letter-spacing:2.5px;color:${CREAM};">${escapeHtml(ticketRef)}</div>`
                          : ""
                      }
                      <div style="margin-top:6px;font-size:12px;color:rgba(251,243,231,0.5);">${escapeHtml(caption)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function ticketLinkBlock(event: EventDoc): string {
  const site = SITE_URL.value().replace(/\/$/, "");
  if (!site) return "";
  const url = `${site}/events/${encodeURIComponent(event.slug)}`;
  return `
            <tr>
              <td align="center" style="padding:20px 28px 0 28px;">
                <a href="${escapeHtml(url)}"
                   style="display:inline-block;background:${CORAL};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;">
                  View the event page
                </a>
              </td>
            </tr>`;
}

function paragraph(html: string): string {
  return `
            <tr>
              <td style="padding:16px 28px 0 28px;">
                <p style="margin:0;font-size:16px;line-height:1.65;color:rgba(25,21,18,0.7);">${html}</p>
              </td>
            </tr>`;
}

/* -------------------------------------------------------------------------
   Confirmation — sent once, at registration
   ---------------------------------------------------------------------- */

/**
 * Reads as an arrival: the flyer first, then the ticket, then the practical
 * details. Deliberately different in structure and tone from the reminder —
 * this one is a keepsake people scroll back to, so the artwork leads.
 */
export async function sendConfirmationEmail(params: {
  to: string;
  attendeeName: string;
  event: EventDoc;
  qrPng: Buffer;
  ticketRef?: string;
}): Promise<void> {
  const { to, attendeeName, event, qrPng, ticketRef } = params;
  const startsAt = event.startsAt.toDate();
  const flyer = await fetchFlyer(event);
  const firstName = attendeeName.trim().split(/\s+/)[0] || attendeeName;

  const attachments: NonNullable<CreateEmailOptions["attachments"]> = [
    { filename: "ticket.png", content: qrPng, contentId: "ticket-qr" },
  ];
  if (flyer) {
    attachments.push({ filename: flyerFilename(event), content: flyer, contentId: "event-flyer" });
  }

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: `You're in — ${event.name}`,
    text: [
      `Hi ${firstName},`,
      ``,
      `You're registered for ${event.name}.`,
      ``,
      `When: ${formatEventDate(startsAt)}${venuePlain(event)}`,
      ticketRef ? `Ticket: ${ticketRef}` : ``,
      ``,
      `Your QR ticket is attached — show it at the door and you're in.`,
      `Entry is free, and the ticket is just for you. If you're bringing someone,`,
      `send them the link so they can get their own.`,
      ``,
      `See you there.`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: shell({
      preheader: `Your ticket for ${event.name} on ${formatDatePart(startsAt)}.`,
      eyebrow: "You're registered",
      eyebrowColor: CORAL,
      heading: `See you at ${event.name}`,
      body: [
        flyerBlock(Boolean(flyer), event),
        paragraph(
          `Hi ${escapeHtml(firstName)}, you're on the list. Show the code below at the door — that's the whole check-in.`
        ),
        ticketBlock({ ticketRef, caption: "Show this at the entrance" }),
        detailsBlock(event),
        ticketLinkBlock(event),
      ].join(""),
      footerNote:
        "Entry is free and this ticket is just for you. Bringing someone? Send them the event link so they get their own.",
    }),
    attachments,
  });
}

/* -------------------------------------------------------------------------
   Reminder — sent the day before
   ---------------------------------------------------------------------- */

/**
 * Read on the way out the door, so it inverts the confirmation: time and place
 * first, artwork demoted to a small strip, and the copy assumes they already
 * know what the event is.
 */
export async function sendReminderEmail(params: {
  to: string;
  attendeeName: string;
  event: EventDoc;
  qrPng: Buffer;
  ticketRef?: string;
}): Promise<void> {
  const { to, attendeeName, event, qrPng, ticketRef } = params;
  const startsAt = event.startsAt.toDate();
  const flyer = await fetchFlyer(event);
  const firstName = attendeeName.trim().split(/\s+/)[0] || attendeeName;

  const attachments: NonNullable<CreateEmailOptions["attachments"]> = [
    { filename: "ticket.png", content: qrPng, contentId: "ticket-qr" },
  ];
  if (flyer) {
    attachments.push({ filename: flyerFilename(event), content: flyer, contentId: "event-flyer" });
  }

  // Small and to one side — the reminder is about logistics, not the poster.
  const flyerStrip = flyer
    ? `
            <tr>
              <td style="padding:22px 28px 0 28px;">
                <img src="cid:event-flyer" alt="${escapeHtml(event.name)}" width="544"
                     style="display:block;width:100%;max-width:544px;height:150px;object-fit:cover;border-radius:12px;border:1px solid #E9E2D7;" />
              </td>
            </tr>`
    : "";

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: `Tomorrow: ${event.name} at ${formatTimePart(startsAt)}`,
    text: [
      `Hi ${firstName},`,
      ``,
      `${event.name} is tomorrow.`,
      ``,
      `When: ${formatEventDate(startsAt)}${venuePlain(event)}`,
      ticketRef ? `Ticket: ${ticketRef}` : ``,
      ``,
      `Your QR ticket is attached — have it ready at the door.`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: shell({
      preheader: `${event.name} is tomorrow at ${formatTimePart(startsAt)}. Your ticket is inside.`,
      eyebrow: "Happening tomorrow",
      eyebrowColor: GOLD,
      heading: `${event.name} is tomorrow`,
      body: [
        detailsBlock(event),
        paragraph(
          `Hi ${escapeHtml(firstName)}, have this ready at the door and you'll be straight in.`
        ),
        ticketBlock({ ticketRef, caption: "Have this open when you arrive" }),
        flyerStrip,
        ticketLinkBlock(event),
      ].join(""),
      footerNote: "Can't make it any more? No action needed — just don't check in.",
    }),
    attachments,
  });
}
