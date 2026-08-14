import type { ComponentType } from "react";
import ReviveEventPage from "./revive/EventPage";

/**
 * Maps an event's URL slug to its hand-built page component. Add a new
 * entry (and a new folder under /events) each time a new event ships —
 * there is no staff-facing event-creation tool by design.
 */
export const eventPages: Record<string, ComponentType> = {
  revive: ReviveEventPage,
};
