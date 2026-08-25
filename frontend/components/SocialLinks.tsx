import { SOCIALS } from "@/lib/socials";

/**
 * Where Love Inc lives between gatherings.
 *
 * Sits at the end of a finished event, which is the one place on this site
 * where the natural next action is not "get a ticket" — there is nothing left
 * to register for, so the page has to offer somewhere else to go or it just
 * stops. Each tile names what you actually get there rather than repeating
 * "follow us" three times.
 */

type IconProps = { className?: string };

function InstagramGlyph({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.4" cy="6.7" r="1.15" fill="currentColor" />
    </svg>
  );
}

function TikTokGlyph({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.82-2.47v-3.1a5.66 5.66 0 1 0 4.91 5.6V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TelegramGlyph({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M9.78 15.6 9.6 19.2c.4 0 .58-.17.79-.38l1.9-1.82 3.94 2.89c.72.4 1.24.19 1.44-.67l2.6-12.2c.24-1.07-.38-1.5-1.09-1.23L3.2 10.7c-1.05.4-1.03.98-.18 1.25l4.2 1.3 9.75-6.1c.46-.3.88-.14.53.17L9.78 15.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

const GLYPHS: Record<string, (props: IconProps) => React.ReactElement> = {
  Instagram: InstagramGlyph,
  TikTok: TikTokGlyph,
  Telegram: TelegramGlyph,
};

export function SocialLinks() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {SOCIALS.map((social) => {
        const Glyph = GLYPHS[social.platform];
        return (
          <li key={social.platform}>
            <a
              href={social.url}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col rounded-2xl border border-cream/12 bg-cream/[0.03] p-4 transition hover:border-gold/45 hover:bg-cream/[0.06] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold sm:p-5"
            >
              <span className="flex items-center justify-between">
                {Glyph && <Glyph className="h-6 w-6 text-gold" />}
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-plex-mono)] text-[13px] text-cream/25 transition group-hover:translate-x-0.5 group-hover:text-gold motion-reduce:transition-none"
                >
                  &#8599;
                </span>
              </span>
              <span className="mt-3.5 block text-[16.5px] font-bold tracking-[-0.01em] text-cream">
                {social.platform}
              </span>
              <span className="mt-0.5 block font-[family-name:var(--font-plex-mono)] text-[12.5px] text-cream/40">
                {social.handle}
              </span>
              <span className="mt-2 block text-[13.5px] leading-relaxed text-cream/55">
                {social.blurb}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
