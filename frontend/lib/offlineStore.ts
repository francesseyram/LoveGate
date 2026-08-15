"use client";

import type { RegistrationSummary } from "./types";

/**
 * Local persistence for the check-in desk.
 *
 * IndexedDB rather than memory so a tab refresh, a phone locking, or the
 * browser evicting a backgrounded tab mid-event doesn't lose queued check-ins
 * that were never sent.
 */
const DB_NAME = "lovegate-checkin";
const DB_VERSION = 1;
const ROSTER_STORE = "rosters";
const QUEUE_STORE = "queue";

export interface RosterEntry extends RegistrationSummary {
  qrValue: string;
}

export interface CachedRoster {
  eventId: string;
  entries: RosterEntry[];
  fetchedAt: string;
}

export interface QueuedCheckIn {
  /** `${eventId}:${registrationId}` — dedupes repeat scans of the same ticket. */
  key: string;
  eventId: string;
  registrationId: string;
  name: string;
  checkedInAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ROSTER_STORE)) {
        db.createObjectStore(ROSTER_STORE, { keyPath: "eventId" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function saveRoster(roster: CachedRoster): Promise<void> {
  await tx(ROSTER_STORE, "readwrite", (s) => s.put(roster));
}

export async function loadRoster(eventId: string): Promise<CachedRoster | undefined> {
  return tx<CachedRoster | undefined>(ROSTER_STORE, "readonly", (s) => s.get(eventId));
}

export async function enqueueCheckIn(entry: QueuedCheckIn): Promise<void> {
  await tx(QUEUE_STORE, "readwrite", (s) => s.put(entry));
}

export async function getQueue(eventId: string): Promise<QueuedCheckIn[]> {
  const all = await tx<QueuedCheckIn[]>(QUEUE_STORE, "readonly", (s) => s.getAll());
  return all.filter((entry) => entry.eventId === eventId);
}

export async function removeFromQueue(keys: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(QUEUE_STORE);
    keys.forEach((key) => store.delete(key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Marks someone checked-in in the cached roster so the UI reflects it offline. */
export async function markRosterEntryCheckedIn(
  eventId: string,
  registrationId: string,
  checkedInAt: string
): Promise<void> {
  const roster = await loadRoster(eventId);
  if (!roster) return;
  const next = roster.entries.map((entry) =>
    entry.id === registrationId ? { ...entry, status: "checked_in" as const, checkedInAt } : entry
  );
  await saveRoster({ ...roster, entries: next });
}
