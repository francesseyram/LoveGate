import type { ComponentType } from "react";
import ReviveEventPage from "./revive/EventPage";
import { ReviveHomeCard } from "./revive/HomeCard";
import type { EventSummary } from "@/lib/types";

/**
 * Maps an event's URL slug to its hand-built page component. Add a new
 * entry (and a new folder under /events) each time a new event ships —
 * there is no staff-facing event-creation tool by design.
 */
export const eventPages: Record<string, ComponentType> = {
  revive: ReviveEventPage,
};

/**
 * Optional per-event teaser card for the LoveGate homepage's "Live events"
 * grid. Events without an entry here fall back to a generic card.
 */
export const eventHomeCards: Record<string, ComponentType<{ event: EventSummary }>> = {
  revive: ReviveHomeCard,
};
