import type { Registration } from "@/lib/types";

export function QRTicket({
  registration,
  qrImage,
  eventName,
}: {
  registration: Registration;
  qrImage: string;
  eventName: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
      <p className="text-sm text-gray-500">Your ticket for</p>
      <p className="text-lg font-semibold text-gray-900">{eventName}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrImage} alt="Your ticket QR code" className="mx-auto mt-4 h-56 w-56" />
      <dl className="mt-4 space-y-1 text-sm text-gray-600">
        <div>
          <dt className="inline font-medium">Name: </dt>
          <dd className="inline">{registration.name}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Email: </dt>
          <dd className="inline">{registration.email}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-gray-400">
        A copy of this ticket has been emailed to you. Show this QR code at check-in.
      </p>
    </div>
  );
}
