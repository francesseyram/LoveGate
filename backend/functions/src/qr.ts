import QRCode from "qrcode";

export function makeQrValue(eventId: string, registrationId: string): string {
  return `ticket_${eventId}_${registrationId}`;
}

/** PNG buffer, used as an email attachment. */
export async function generateQrPngBuffer(qrValue: string): Promise<Buffer> {
  return QRCode.toBuffer(qrValue, { type: "png", margin: 2, width: 320 });
}

/** data: URL, returned to the frontend so it can render the ticket without a second round trip. */
export async function generateQrDataUrl(qrValue: string): Promise<string> {
  return QRCode.toDataURL(qrValue, { margin: 2, width: 320 });
}
