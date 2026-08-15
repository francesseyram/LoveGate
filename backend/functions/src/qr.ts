import QRCode from "qrcode";

/**
 * The registration id already encodes the event (see registrationDocId), so
 * the ticket payload stays `ticket_<eventId>_<hash>` — the same shape older
 * tickets use, which matters because check-in resolves a scan by matching
 * this stored string exactly.
 */
export function makeQrValue(registrationId: string): string {
  return `ticket_${registrationId}`;
}

/** PNG buffer, used as an email attachment. */
export async function generateQrPngBuffer(qrValue: string): Promise<Buffer> {
  return QRCode.toBuffer(qrValue, { type: "png", margin: 2, width: 320 });
}

/** data: URL, returned to the frontend so it can render the ticket without a second round trip. */
export async function generateQrDataUrl(qrValue: string): Promise<string> {
  return QRCode.toDataURL(qrValue, { margin: 2, width: 320 });
}
