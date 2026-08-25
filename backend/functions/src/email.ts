import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import * as logger from "firebase-functions/logger";
import { RESEND_FROM_EMAIL, SITE_URL } from "./secrets";
import { SOCIAL_LINKS } from "./socials";
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

/** Calendar Y-M-D in Accra, so "tomorrow" is the local day, not the server's. */
function zonedYmd(date: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return [n("year"), n("month"), n("day")];
}

function isTomorrow(startsAt: Date, now = new Date()): boolean {
  const [year, month, day] = zonedYmd(now);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const [eventYear, eventMonth, eventDay] = zonedYmd(startsAt);
  return (
    eventYear === tomorrow.getUTCFullYear() &&
    eventMonth === tomorrow.getUTCMonth() + 1 &&
    eventDay === tomorrow.getUTCDate()
  );
}

function venuePlain(event: EventDoc): string {
  if (!event.location) return "";
  const base = ` at ${event.location}`;
  return event.locationUrl ? `${base}\nDirections: ${event.locationUrl}` : base;
}

/** `null` drops a line; `""` is a blank line. `.filter(Boolean)` would eat both. */
function plainText(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line !== null).join("\n");
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

/** Resolve coverPhotoUrl against SITE_URL. Null if either is missing. */
function flyerUrl(event: EventDoc): string | null {
  const site = SITE_URL.value().replace(/\/$/, "");
  if (!site || !event.coverPhotoUrl) return null;
  return event.coverPhotoUrl.startsWith("http")
    ? event.coverPhotoUrl
    : `${site}${event.coverPhotoUrl.startsWith("/") ? "" : "/"}${event.coverPhotoUrl}`;
}

function cachedFlyer(event: EventDoc): Buffer | null {
  const url = flyerUrl(event);
  if (!url) return null;
  return flyerCache.get(url) ?? null;
}

/**
 * The flyer as bytes, for inlining into the email. Events store
 * `coverPhotoUrl` as a site-relative path, so this needs SITE_URL to resolve.
 * Every failure path returns null: artwork is a nice-to-have. Confirmation
 * must not await this — use `cachedFlyer` there and warm the cache with
 * `void fetchFlyer(event)` so a slow host cannot delay the ticket.
 */
async function fetchFlyer(event: EventDoc): Promise<Buffer | null> {
  const url = flyerUrl(event);
  if (!url) return null;

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
 * The one block of rules in this email that does not live on the element.
 *
 * Inline styles are the baseline every client understands, but they cannot be
 * conditional — and this mail is opened on a phone far more often than on a
 * desktop, so the phone layout has to come from a media query. Every rule here
 * needs `!important` to outrank the inline value it corrects.
 *
 * Outlook on Windows drops this block entirely and keeps the desktop values,
 * which is the right outcome: it is the one client that is never a phone.
 */
const MOBILE_STYLES = `
      body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }

      @media only screen and (max-width:600px) {
        /* Edge to edge. The old 12px frame plus 28px gutters left a 256px
           column on a 320px screen — narrower than the ticket inside it. */
        .frame { padding:0 !important; }
        .shell { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
        .gutter { padding-left:18px !important; padding-right:18px !important; }
        .h1 { font-size:26px !important; line-height:1.14 !important; letter-spacing:-0.4px !important; }
        /* The wordmark identifies the sender on its own in a narrow header. */
        .meta { display:none !important; }
        /* The reason the email exists, so it takes the width that frees up. */
        .qr { width:224px !important; height:224px !important; }
        .qrpad { padding:24px 12px !important; }
        /* A full-width bar is a thumb target; an inline pill is not. */
        .cta { display:block !important; }
        .maplink { display:inline-block !important; padding:12px 0 !important; }
      }`;

/**
 * Padding for the card's own gutters. Every td carrying it gets `class="gutter"`
 * so one media-query rule can narrow all of them at once.
 */
function gutter(vertical: string): string {
  return `padding:${vertical} 28px;`;
}

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
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(heading)}</title>
    <style>${MOBILE_STYLES}
    </style>
  </head>
  <body style="margin:0;padding:0;width:100%;background:${CANVAS};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Inbox preview line, then padding so the client stops before it reaches
         the body copy and repeats it back in the list view. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${"&#847;&zwnj;&nbsp;".repeat(40)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr>
        <td align="center" class="frame" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="shell" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E9E2D7;">

            <tr>
              <td class="gutter" style="background:${DARK};${gutter("20px")}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:19px;font-weight:800;letter-spacing:-0.4px;color:${CREAM};">
                      Love<span style="color:${CORAL};">Gate</span>
                    </td>
                    <td align="right" class="meta" style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(251,243,231,0.5);">
                      Love Inc Global
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="gutter" style="${gutter("30px")}padding-bottom:0;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${eyebrowColor};">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 class="h1" style="margin:10px 0 0 0;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-1px;color:${INK};">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>

            ${body}

            <tr>
              <td class="gutter" style="${gutter("8px")}padding-top:22px;padding-bottom:28px;">
                <p style="margin:0;font-size:13px;line-height:1.65;color:rgba(25,21,18,0.45);">
                  ${footerNote}
                </p>
              </td>
            </tr>

            <tr>
              <td class="gutter" style="background:${CANVAS};border-top:1px solid #E9E2D7;${gutter("18px")}">
                <p style="margin:0;font-size:12.5px;line-height:1.65;color:rgba(25,21,18,0.45);">
                  Love Inc Global &middot; University of Ghana, Legon<br />
                  You&rsquo;re receiving this because you registered for an event with LoveGate.
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
              <td class="gutter" style="${gutter("24px")}padding-bottom:0;">
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
                    <td style="padding:16px 18px 0 18px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(25,21,18,0.4);">Where</div>
                      <div style="margin-top:5px;font-size:16px;font-weight:600;line-height:1.4;color:${INK};">${escapeHtml(event.location)}</div>
                      ${
                        event.locationUrl
                          ? `<a href="${escapeHtml(event.locationUrl)}" class="maplink" style="display:inline-block;padding:8px 0;font-size:14.5px;font-weight:600;color:${CORAL};text-decoration:underline;">Open in Maps &rarr;</a>`
                          : ""
                      }
                    </td>
                  </tr>`
    : "";

  // Padding sits on the inner cells, not on the <table>: Outlook ignores
  // padding on a table element and the panel collapses onto its own text.
  return `
            <tr>
              <td class="gutter" style="${gutter("20px")}padding-bottom:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:${CANVAS};border:1px solid #E9E2D7;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 18px 18px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(25,21,18,0.4);">When</div>
                      <div style="margin-top:5px;font-size:16px;font-weight:600;line-height:1.4;color:${INK};">${escapeHtml(formatDatePart(startsAt))}</div>
                      <div style="margin-top:2px;font-size:15px;color:rgba(25,21,18,0.6);">${escapeHtml(formatTimePart(startsAt))}</div>
                    </td>
                  </tr>${venue}
                </table>
              </td>
            </tr>`;
}

/**
 * The QR, on its own high-contrast panel so it scans off a screen.
 *
 * The brightness line is not filler. This ticket gets held up in a dim hall to
 * a volunteer with a phone camera, and a QR on a screen dimmed for a dark room
 * is the way a scan actually fails — so the ticket says so, at the moment
 * someone is looking straight at it.
 */
function ticketBlock(params: { ticketRef?: string; caption: string }): string {
  const { ticketRef, caption } = params;
  return `
            <tr>
              <td class="gutter" style="${gutter("20px")}padding-bottom:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:${DARK};border-radius:12px;">
                  <tr>
                    <td align="center" class="qrpad" style="padding:26px 20px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD};">
                        Admit one
                      </div>
                      <img src="cid:ticket-qr" alt="Your ticket QR code" width="200" height="200" class="qr"
                           style="display:block;margin:14px auto 0 auto;width:200px;height:200px;background:#ffffff;padding:14px;border-radius:10px;" />
                      ${
                        ticketRef
                          ? `<div style="margin-top:16px;font-size:16px;font-weight:700;letter-spacing:2.5px;color:${CREAM};">${escapeHtml(ticketRef)}</div>`
                          : ""
                      }
                      <div style="margin-top:6px;font-size:12.5px;color:rgba(251,243,231,0.55);">${escapeHtml(caption)}</div>
                      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(251,243,231,0.14);font-size:12.5px;line-height:1.5;color:rgba(251,243,231,0.45);">
                        Turn your screen brightness up before you reach the door.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function ctaBlock(url: string, label: string): string {
  return `
            <tr>
              <td align="center" class="gutter" style="${gutter("20px")}padding-bottom:0;">
                <a href="${escapeHtml(url)}" class="cta"
                   style="display:inline-block;background:${CORAL};color:#ffffff;font-size:15.5px;font-weight:700;text-decoration:none;padding:15px 26px;border-radius:999px;text-align:center;">
                  ${escapeHtml(label)}
                </a>
              </td>
            </tr>`;
}

/** Absolute URL of an event's own page, or null when SITE_URL is unset. */
function eventUrl(event: EventDoc): string | null {
  const site = SITE_URL.value().replace(/\/$/, "");
  if (!site) return null;
  return `${site}/events/${encodeURIComponent(event.slug)}`;
}

function ticketLinkBlock(event: EventDoc): string {
  const url = eventUrl(event);
  return url ? ctaBlock(url, "View the event page") : "";
}

/* -------------------------------------------------------------------------
   Socials
   ---------------------------------------------------------------------- */

/**
 * Where to find Love Inc between gatherings.
 *
 * One link per row rather than three buttons side by side: a row gives the
 * handle room to sit under the platform name, and it is already the full width
 * of the card on a phone, where three inline pills would either wrap raggedly
 * or shrink below a thumb. The arrow is decoration on its own cell — making it
 * a second link to the same place would read the destination out twice.
 */
function socialsBlock(): string {
  const rows = SOCIAL_LINKS.map(
    (social, index) => `
                  <tr>
                    <td style="padding:13px 18px;${index > 0 ? `border-top:1px solid #E9E2D7;` : ""}">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <a href="${escapeHtml(social.url)}"
                               style="font-size:15.5px;font-weight:700;color:${INK};text-decoration:none;">
                              ${escapeHtml(social.platform)}
                            </a>
                            <div style="margin-top:2px;font-size:13.5px;color:rgba(25,21,18,0.5);">
                              ${escapeHtml(social.handle)}
                            </div>
                          </td>
                          <td align="right" width="24" style="font-size:15px;font-weight:700;color:${CORAL};">&rarr;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
  ).join("");

  return `
            <tr>
              <td class="gutter" style="${gutter("20px")}padding-bottom:0;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(25,21,18,0.4);">
                  Follow Love Inc
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="margin-top:10px;background:${CANVAS};border:1px solid #E9E2D7;border-radius:12px;">${rows}
                </table>
              </td>
            </tr>`;
}

function paragraph(html: string): string {
  return `
            <tr>
              <td class="gutter" style="${gutter("16px")}padding-bottom:0;">
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
  // Confirmation is on the registration hot path. Use a flyer only if this
  // process already has one; otherwise send without it and warm the cache
  // in the background so later mail (reminders, the next signup) can attach it.
  const flyer = cachedFlyer(event);
  void fetchFlyer(event);
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
    subject: `You're in: ${event.name}`,
    text: plainText([
      `Hi ${firstName},`,
      ``,
      `You're registered for ${event.name}.`,
      ``,
      `When: ${formatEventDate(startsAt)}${venuePlain(event)}`,
      ticketRef ? `Ticket: ${ticketRef}` : null,
      ``,
      `Your QR ticket is attached. Show it at the door and you're in.`,
      `Turn your screen brightness up before you reach the door so it scans first time.`,
      `Entry is free, and the ticket is just for you. If you're bringing someone,`,
      `send them the link so they can get their own.`,
      ``,
      `See you there.`,
    ]),
    html: shell({
      preheader: `Your ticket for ${event.name} on ${formatDatePart(startsAt)}.`,
      eyebrow: "You're registered",
      eyebrowColor: CORAL,
      heading: `See you at ${event.name}`,
      body: [
        flyerBlock(Boolean(flyer), event),
        paragraph(
          `Hi ${escapeHtml(firstName)}, you're on the list. Show the code below at the door. That's the whole check-in.`
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
   Reminder — automatic (day-before) and staff manual blasts
   ---------------------------------------------------------------------- */

/**
 * Read on the way out the door, so it inverts the confirmation: time and place
 * first, artwork demoted to a small strip, and the copy assumes they already
 * know what the event is. "Tomorrow" is only used when the event is actually
 * the next Accra calendar day — manual blasts can go out earlier.
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
  const tomorrow = isTomorrow(startsAt);

  const attachments: NonNullable<CreateEmailOptions["attachments"]> = [
    { filename: "ticket.png", content: qrPng, contentId: "ticket-qr" },
  ];
  if (flyer) {
    attachments.push({ filename: flyerFilename(event), content: flyer, contentId: "event-flyer" });
  }

  // Demoted to a small centred poster — the reminder is about logistics, not
  // the artwork. Sized rather than cropped: `object-fit` is unsupported in
  // Gmail and Outlook, so the old fixed height just squashed the flyer.
  const flyerStrip = flyer
    ? `
            <tr>
              <td align="center" class="gutter" style="${gutter("22px")}padding-bottom:0;">
                <img src="cid:event-flyer" alt="${escapeHtml(event.name)}" width="180"
                     style="display:block;width:180px;max-width:60%;height:auto;border-radius:10px;border:1px solid #E9E2D7;" />
              </td>
            </tr>`
    : "";

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: tomorrow
      ? `Tomorrow: ${event.name} at ${formatTimePart(startsAt)}`
      : `Reminder: ${event.name} on ${formatDatePart(startsAt)}`,
    text: plainText([
      `Hi ${firstName},`,
      ``,
      tomorrow ? `${event.name} is tomorrow.` : `${event.name} is coming up.`,
      ``,
      `When: ${formatEventDate(startsAt)}${venuePlain(event)}`,
      ticketRef ? `Ticket: ${ticketRef}` : null,
      ``,
      `Your QR ticket is attached. Have it ready at the door, with your screen`,
      `brightness turned up so it scans first time.`,
    ]),
    html: shell({
      preheader: tomorrow
        ? `${event.name} is tomorrow at ${formatTimePart(startsAt)}. Your ticket is inside.`
        : `${event.name} is on ${formatDatePart(startsAt)} at ${formatTimePart(startsAt)}. Your ticket is inside.`,
      eyebrow: tomorrow ? "Happening tomorrow" : "Coming up",
      eyebrowColor: GOLD,
      heading: tomorrow ? `${event.name} is tomorrow` : `${event.name} is coming up`,
      body: [
        detailsBlock(event),
        paragraph(
          `Hi ${escapeHtml(firstName)}, have this ready at the door and you'll be straight in.`
        ),
        ticketBlock({ ticketRef, caption: "Have this open when you arrive" }),
        flyerStrip,
        ticketLinkBlock(event),
      ].join(""),
      footerNote: "Can't make it any more? No action needed, just don't check in.",
    }),
    attachments,
  });
}

/* -------------------------------------------------------------------------
   Thank-you — sent once, after the event
   ---------------------------------------------------------------------- */

/**
 * The note that closes an event out.
 *
 * Goes to everyone who registered, which means it is read both by someone who
 * stood in that room and by someone who signed up and never made it — so the
 * copy thanks people for being part of it without ever claiming they were
 * there, and the thing it actually asks for (follow us) is true for both.
 *
 * Structurally it is the confirmation run backwards: the flyer leads again,
 * because at this point the artwork is the only part worth keeping, and where
 * the ticket used to sit there is now the one link that still goes somewhere.
 * No QR — the ticket is spent, and attaching a dead one would invite someone
 * to turn up at a door that isn't open.
 */
export async function sendThankYouEmail(params: {
  to: string;
  attendeeName: string;
  event: EventDoc;
}): Promise<void> {
  const { to, attendeeName, event } = params;
  // A blast, not the registration hot path, so this can wait for the artwork.
  const flyer = await fetchFlyer(event);
  const firstName = attendeeName.trim().split(/\s+/)[0] || attendeeName;
  const url = eventUrl(event);

  const attachments: NonNullable<CreateEmailOptions["attachments"]> = [];
  if (flyer) {
    attachments.push({ filename: flyerFilename(event), content: flyer, contentId: "event-flyer" });
  }

  await send({
    from: RESEND_FROM_EMAIL.value(),
    to,
    subject: `That was ${event.name}`,
    text: plainText([
      `Hi ${firstName},`,
      ``,
      `${event.name} is done. Thank you for being part of it.`,
      ``,
      `A gathering ends, the family doesn't. Here's where Love Inc is`,
      `between events:`,
      ``,
      ...SOCIAL_LINKS.map((social) => `${social.platform} (${social.handle}): ${social.url}`),
      ``,
      url ? `Look back at the event: ${url}` : null,
      ``,
      `The next one shows up on LoveGate first. See you there.`,
    ]),
    html: shell({
      preheader: `Thank you for being part of it. Here's where to find Love Inc between gatherings.`,
      eyebrow: "Until next time",
      eyebrowColor: GOLD,
      heading: `That was ${event.name}`,
      body: [
        flyerBlock(Boolean(flyer), event),
        paragraph(
          `Hi ${escapeHtml(firstName)}, that's ${escapeHtml(event.name)} done. Thank you for being part of it.`
        ),
        paragraph(`A gathering ends, the family doesn't. Here's where we are in the meantime.`),
        socialsBlock(),
        url ? ctaBlock(url, "Look back at the event") : "",
      ].join(""),
      footerNote:
        "No ticket this time, just a thank you. The next gathering is announced on LoveGate first.",
    }),
    attachments,
  });
}
