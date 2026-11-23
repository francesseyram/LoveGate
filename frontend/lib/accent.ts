import type { CSSProperties } from "react";
import type { EventSummary } from "./types";

/**
 * An event's highlight colour. Setting it as `--accent` on a wrapper re-tints
 * every `gold` utility inside (globals.css points `--color-gold` at it), so
 * the event page and the staff tools pick it up without any per-page code.
 */

export const HOUSE_GOLD = "#d9a441";

/** Offered in the editor. All light enough to read as text on the dark pages. */
export const ACCENT_SWATCHES = [
  { hex: HOUSE_GOLD, name: "House gold" },
  { hex: "#f08a3c", name: "Flame" },
  { hex: "#ef6a5a", name: "Ember" },
  { hex: "#e57ba0", name: "Rose" },
  { hex: "#b89cf0", name: "Lilac" },
  { hex: "#7fb8e0", name: "Sky" },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function isAccent(value: string | undefined): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function accentStyle(event: Pick<EventSummary, "accent"> | null | undefined): CSSProperties {
  return isAccent(event?.accent) ? ({ "--accent": event.accent } as CSSProperties) : {};
}

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * WCAG contrast against the darkest ground the accent sits on. Labels and
 * figures are drawn in the accent, so below 4.5 they stop being readable.
 */
export function accentContrast(hex: string): number {
  const ground = luminance("#0d0705");
  return (luminance(hex) + 0.05) / (ground + 0.05);
}
