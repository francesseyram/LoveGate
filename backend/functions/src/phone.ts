/** Ghana. Every number we handle is assumed local unless dialled with a "+". */
export const DEFAULT_COUNTRY_CODE = "233";

/** Strips everything but digits, e.g. "+1 (234) 567-8901" -> "12345678901". */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Canonical key used for duplicate detection — NOT for display.
 *
 * The same person writes their number several ways ("020 000 0000",
 * "+233 20 000 0000", "233200000000"); keying dedupe off raw digits treats
 * those as three different people and issues three tickets. Collapse them all
 * to country-code + national number instead.
 *
 * Numbers explicitly dialled with a "+" and a non-Ghanaian country code are
 * left as dialled rather than being wrongly rewritten as Ghanaian.
 */
export function toPhoneKey(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const hadPlus = raw.trim().startsWith("+");
  const digits = normalizePhone(raw);
  if (!digits) return "";

  // Explicit international number for another country — keep as dialled.
  if (hadPlus && !digits.startsWith(countryCode)) {
    return digits;
  }

  // Drop the country code if present, then the national trunk "0".
  const withoutCountry = digits.startsWith(countryCode)
    ? digits.slice(countryCode.length)
    : digits;
  const national = withoutCountry.replace(/^0+/, "");

  return countryCode + national;
}
