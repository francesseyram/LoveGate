import type { ReactNode } from "react";
import { FireBackground } from "@/components/FireBackground";
import { FlameField } from "@/components/FlameField";

/**
 * Visual presets for the shared event page, picked by the event doc's `theme`
 * field. A new event chooses one of these; it doesn't need its own page.
 *
 * Everything below the hero is the same dark stock in every preset, so the
 * registration form and the session ticket only ever have one background to
 * be legible on. A preset owns the hero's atmosphere and nothing else.
 *
 * Adding a preset is a frontend-only change — the backend carries `theme`
 * through as an opaque string.
 */
export interface EventTheme {
  /** Drawn behind the hero content, filling it. */
  heroBackground: ReactNode;
}

const fire: EventTheme = {
  heroBackground: (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,#4A0812_0%,#1C0507_45%,#0D0505_80%)]" />
      <FlameField className="absolute inset-0" />
      {/* Lets the fire rise out of the dark instead of stopping at a hard line. */}
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-[linear-gradient(180deg,transparent,#120605)]" />
    </>
  ),
};

/** Revive's look: a slow-breathing glow with embers drifting up through it. */
const embers: EventTheme = {
  heroBackground: (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_105%,#7a1f24_0%,#3a0f12_32%,#170807_60%,#0D0705_85%)] motion-safe:animate-[hero-glow_8s_ease-in-out_infinite]" />
      <FireBackground />
    </>
  ),
};

/** The quiet default for an event that hasn't picked anything. */
const glow: EventTheme = {
  heroBackground: (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#5A1520_0%,#1C0709_50%,#0D0505_85%)]" />
  ),
};

const THEMES: Record<string, EventTheme> = { fire, embers, glow };

export const THEME_NAMES = Object.keys(THEMES);

export function themeFor(name: string | undefined): EventTheme {
  return (name && THEMES[name]) || glow;
}
