"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getEventRoster, syncCheckIns, getCallableErrorMessage } from "./functions";
import {
  saveRoster,
  loadRoster,
  enqueueCheckIn,
  getQueue,
  removeFromQueue,
  markRosterEntryCheckedIn,
  type CachedRoster,
  type RosterEntry,
} from "./offlineStore";

export type CheckinOutcome =
  | { result: "checked_in"; name: string; offline: boolean }
  | { result: "already_checked_in"; name: string; offline: boolean }
  | { result: "not_found" };

/** Connectivity is external browser state, so subscribe to it rather than mirroring it into an effect. */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOfflineCheckin(eventId: string) {
  const [roster, setRoster] = useState<CachedRoster | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const online = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true // assume online during SSR; corrected on hydration
  );

  const refreshPendingCount = useCallback(async () => {
    if (!eventId) return;
    setPendingCount((await getQueue(eventId)).length);
  }, [eventId]);

  /** Flushes anything recorded while offline. Safe to call repeatedly. */
  const sync = useCallback(async () => {
    if (!eventId || !navigator.onLine) return;
    const queue = await getQueue(eventId);
    if (queue.length === 0) return;

    try {
      const result = await syncCheckIns({
        eventId,
        checkIns: queue.map((q) => ({ registrationId: q.registrationId, checkedInAt: q.checkedInAt })),
      });
      // Drop anything the server has now accounted for — including rows it
      // says were already checked in, otherwise they'd retry forever.
      const settled = new Set([
        ...result.applied,
        ...result.alreadyCheckedIn,
        ...result.notFound,
      ]);
      await removeFromQueue(queue.filter((q) => settled.has(q.registrationId)).map((q) => q.key));
      await refreshPendingCount();
    } catch (err) {
      setError(getCallableErrorMessage(err));
    }
  }, [eventId, refreshPendingCount]);

  /** Pulls the attendee list down for offline use. */
  const loadEventRoster = useCallback(
    async (force = false) => {
      if (!eventId) return;
      // Read the cache first so nothing below runs synchronously inside an effect.
      const cached = await loadRoster(eventId);
      setLoading(true);
      setError(null);
      try {
        if (cached && !force) setRoster(cached);

        if (navigator.onLine) {
          const fresh = await getEventRoster({ eventId });
          const next: CachedRoster = {
            eventId,
            entries: fresh.roster,
            fetchedAt: fresh.fetchedAt,
          };
          await saveRoster(next);
          setRoster(next);
        } else if (!cached) {
          setError("No attendee list saved for offline use — connect once to download it.");
        }
      } catch (err) {
        setError(getCallableErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      await loadEventRoster();
      await refreshPendingCount();
    })();
  }, [eventId, loadEventRoster, refreshPendingCount]);

  // Flush the moment connectivity returns.
  useEffect(() => {
    if (!online) return;
    void (async () => {
      await sync();
    })();
  }, [online, sync]);

  const findByQr = useCallback(
    (qrValue: string): RosterEntry | undefined =>
      roster?.entries.find((entry) => entry.qrValue === qrValue),
    [roster]
  );

  const search = useCallback(
    (query: string): RosterEntry[] => {
      const q = query.trim().toLowerCase();
      if (!q || !roster) return [];
      return roster.entries
        .filter(
          (entry) =>
            entry.name.toLowerCase().includes(q) ||
            entry.ticketRef.toLowerCase().includes(q.replace(/[^a-z0-9]/g, ""))
        )
        .slice(0, 20);
    },
    [roster]
  );

  /**
   * Records a check-in against the local roster and queues it for the server.
   * Deliberately never awaits the network: the person is standing at the door,
   * so the desk confirms immediately and reconciliation happens in the
   * background.
   */
  const checkIn = useCallback(
    async (entry: RosterEntry): Promise<CheckinOutcome> => {
      if (entry.status === "checked_in") {
        return { result: "already_checked_in", name: entry.name, offline: !navigator.onLine };
      }

      const checkedInAt = new Date().toISOString();
      await enqueueCheckIn({
        key: `${eventId}:${entry.id}`,
        eventId,
        registrationId: entry.id,
        name: entry.name,
        checkedInAt,
      });
      await markRosterEntryCheckedIn(eventId, entry.id, checkedInAt);

      setRoster((prev) =>
        prev
          ? {
              ...prev,
              entries: prev.entries.map((e) =>
                e.id === entry.id ? { ...e, status: "checked_in" as const, checkedInAt } : e
              ),
            }
          : prev
      );
      await refreshPendingCount();

      void sync();
      return { result: "checked_in", name: entry.name, offline: !navigator.onLine };
    },
    [eventId, refreshPendingCount, sync]
  );

  return {
    roster,
    online,
    loading,
    error,
    pendingCount,
    attendeeCount: roster?.entries.length ?? 0,
    checkedInCount: roster?.entries.filter((e) => e.status === "checked_in").length ?? 0,
    findByQr,
    search,
    checkIn,
    sync,
    reloadRoster: () => loadEventRoster(true),
  };
}
