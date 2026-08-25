/**
 * Love Inc's public channels.
 *
 * Hand-mirrored from backend/functions/src/socials.ts, the same way the DTO
 * types are — there is no shared package. Change one, change the other. The
 * URLs are stored without the tracking parameters the apps' share sheets
 * attach; the reasoning is written out on the backend copy.
 */
export interface Social {
  platform: string;
  handle: string;
  url: string;
  /** One-line reason to tap, in the voice of what you'd actually get. */
  blurb: string;
}

export const SOCIALS: Social[] = [
  {
    platform: "Instagram",
    handle: "@loveinc.global",
    url: "https://www.instagram.com/loveinc.global",
    blurb: "Photos from the room",
  },
  {
    platform: "TikTok",
    handle: "@loveinc.global",
    url: "https://www.tiktok.com/@loveinc.global",
    blurb: "Clips from the night",
  },
  {
    platform: "Telegram",
    handle: "Community channel",
    url: "https://t.me/+fdtcpEdq1KdhMGFk",
    blurb: "Where all Love Inc messages are posted",
  },
];
