/** Strips everything but digits, e.g. "+1 (234) 567-8901" -> "12345678901". */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
