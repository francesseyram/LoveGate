import { Timestamp } from "firebase-admin/firestore";

/**
 * True when a queued scan predates the revert that already answered for it.
 *
 * A phone that was offline at the door flushes its queue whenever it
 * reconnects, which can be long after a staff member has undone that person's
 * check-in — and from a different device, where no client-side coordination
 * can reach. Comparing the moment of the scan against the moment of the revert
 * is what lets the server tell "this is the check-in they undid" apart from
 * "they were scanned again afterwards".
 *
 * The comparison is inclusive: a scan and a revert landing on the same
 * millisecond means the revert is the later decision, so it wins.
 */
export function isSupersededByRevert(
  checkedInAt: Timestamp,
  revertedAt?: Timestamp | null
): boolean {
  if (!revertedAt) return false;
  return checkedInAt.toMillis() <= revertedAt.toMillis();
}
