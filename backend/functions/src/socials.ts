/**
 * Love Inc's public channels, in the order they are offered everywhere.
 *
 * Hand-mirrored in frontend/lib/socials.ts, the same way the DTO types are —
 * there is no shared package between the two projects. Change one, change
 * the other.
 *
 * The URLs are stored clean. The links the apps hand you from a share sheet
 * carry per-share tracking (`utm_source=ig_web_button_share_sheet`, `fbclid`,
 * `_t`/`_r`), which is scoped to whoever tapped copy — pasting those into a
 * few hundred emails would attribute every resulting visit to that one tap,
 * and TikTok's `_t` token expires, so the link would eventually stop
 * resolving. The Telegram path keeps its `+` hash: that is the invite itself,
 * not tracking.
 */
export interface SocialLink {
  platform: string;
  handle: string;
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    platform: "Instagram",
    handle: "@loveinc.global",
    url: "https://www.instagram.com/loveinc.global",
  },
  {
    platform: "TikTok",
    handle: "@loveinc.global",
    url: "https://www.tiktok.com/@loveinc.global",
  },
  {
    platform: "Telegram",
    handle: "Community channel",
    url: "https://t.me/+fdtcpEdq1KdhMGFk",
  },
];
