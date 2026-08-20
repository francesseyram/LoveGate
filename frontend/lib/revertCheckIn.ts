"use client";

import { undoCheckIn } from "./functions";
import {
  markRosterEntryNotCheckedIn,
  removeFromQueue,
  settleQueueFlushes,
} from "./offlineStore";

/**
 * Puts someone back to "not arrived", from wherever staff noticed the mistake.
 *
 * Shared by the check-in console and the dashboard roster because the ordering
 * below is the whole correctness of the operation, and it was previously
 * written out once per surface — the dashboard copy was missing step 2, so a
 * scan already on its way to the server could land after the revert and put the
 * person straight back in the room.
 *
 * The steps have to happen in this order:
 *   1. Drop the pending scan, so no *future* flush re-sends it.
 *   2. Wait out any flush already in progress, which has copied the queue into
 *      memory and can no longer be called back.
 *   3. Tell the server, which is the authority and stamps `revertedAt` so even
 *      a scan queued on a different device cannot resurrect this.
 *   4. Only then update the local cache — never claim locally something the
 *      server has not agreed to.
 */
export async function revertCheckIn(input: {
  eventId: string;
  registrationId: string;
}): Promise<void> {
  const { eventId, registrationId } = input;

  await removeFromQueue([`${eventId}:${registrationId}`]);
  await settleQueueFlushes();
  await undoCheckIn({ eventId, registrationId });
  await markRosterEntryNotCheckedIn(eventId, registrationId);
}
