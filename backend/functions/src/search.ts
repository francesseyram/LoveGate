import { createHash } from "crypto";

/** Long enough for real names; caps index size on pasted junk. */
const MAX_TOKEN_LENGTH = 15;

/**
 * Every prefix of every word in a name, so staff can find someone by ANY part
 * of it. Firestore has no substring search: a range query on a single
 * `nameLower` field only matches from the start of the whole string, so
 * "Owusu" would never find "Ama Owusu" — and surname is exactly what a
 * volunteer types at the door. Storing the prefixes lets a single
 * `array-contains` do prefix-match on any token.
 *
 * "Ama Owusu" -> a, am, ama, o, ow, owu, owus, owusu
 */
export function buildSearchPrefixes(name: string, ticketRef?: string): string[] {
  const sources = [name, ...(ticketRef ? [ticketRef] : [])];
  const prefixes = new Set<string>();

  for (const source of sources) {
    const tokens = source
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    for (const token of tokens) {
      const capped = token.slice(0, MAX_TOKEN_LENGTH);
      for (let i = 1; i <= capped.length; i++) {
        prefixes.add(capped.slice(0, i));
      }
    }
  }

  return Array.from(prefixes);
}

/** Short human-quotable code printed on the ticket, e.g. "LG-4F9K2A". */
export function buildTicketRef(registrationId: string): string {
  return `LG-${registrationId.slice(-6).toUpperCase()}`;
}

/**
 * Deterministic document id so a second registration for the same phone
 * collides at the database level and `create()` rejects it atomically —
 * a read-then-write dedupe loses the race when someone double-taps submit.
 *
 * The phone is hashed rather than embedded because the document id ends up
 * inside the QR payload, and a QR code is shown publicly / forwarded around;
 * it must not carry someone's phone number.
 */
export function registrationDocId(eventId: string, phoneKey: string): string {
  const digest = createHash("sha256").update(`${eventId}:${phoneKey}`).digest("hex");
  return `${eventId}_${digest.slice(0, 20)}`;
}
