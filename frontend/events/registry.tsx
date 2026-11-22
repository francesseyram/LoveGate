import type { ComponentType } from "react";
import ReviveEventPage from "./revive/EventPage";
import type { EventSummary } from "@/lib/types";

/**
 * Hand-built pages, by event slug — the exception, not the rule.
 *
 * Every event is drawn by `EventTemplate` from its Firestore doc (sessions,
 * chapter, theme, tagline, description), so a new event needs no entry here
 * and no code at all. Add one only for an event that wants something the
 * template can't do; `EventGate` checks here first.
 *
 * Pages here are handed an already-resolved, still-open event by `EventGate`.
 */
export const eventPages: Record<string, ComponentType<{ event: EventSummary }>> = {
  revive: ReviveEventPage,
};
