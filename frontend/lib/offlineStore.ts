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

/**
 * Queue flushes that have started but not finished.
 *
 * `syncCheckIns` reads the queue into memory before it awaits the server, so
 * deleting a row from IndexedDB cannot recall a flush already in progress.
 * Anything that needs the queue to be settled — reverting a check-in — waits
 * these out first.
 *
 * Module scope because the queue is per-origin: the dashboard and the check-in
 * console are separate pages that share one IndexedDB, and a revert triggered
 * from one has to account for a flush started by the other. It cannot see
 * another *tab* or another device, which is why the server also stamps
 * `revertedAt` — see backend/functions/src/roster.ts.
 */
const inflightFlushes = new Set<Promise<void>>();

export function trackQueueFlush<T>(run: () => Promise<T>): Promise<T> {
  const work = run();
  // Never rejects, so one failed flush can't reject an unrelated waiter.
  const gate = work.then(
    () => {},
    () => {}
  );
  inflightFlushes.add(gate);
  void gate.then(() => inflightFlushes.delete(gate));
  return work;
}

export async function settleQueueFlushes(): Promise<void> {
  await Promise.all([...inflightFlushes]);
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

/**
 * Reverts someone to "not arrived" in the cached roster.
 *
 * The counterpart to markRosterEntryCheckedIn, and only ever reached with a
 * connection: undoing has to be dequeued and confirmed by the server, so unlike
 * a check-in it is never recorded offline for later.
 */
export async function markRosterEntryNotCheckedIn(
  eventId: string,
  registrationId: string
): Promise<void> {
  const roster = await loadRoster(eventId);
  if (!roster) return;
  const next = roster.entries.map((entry) =>
    entry.id === registrationId
      ? { ...entry, status: "going" as const, checkedInAt: null }
      : entry
  );
  await saveRoster({ ...roster, entries: next });
}
