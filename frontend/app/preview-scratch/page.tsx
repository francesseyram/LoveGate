"use client";
// TEMPORARY scratch route for visual checks. Delete before committing.
import { QRTicket } from "@/components/QRTicket";
import type { Registration } from "@/lib/types";

const reg = {
  id: "evt_revive_4f9k2a",
  eventId: "evt_revive",
  name: "Ama Owusu",
  phone: "0200000000",
  email: "ama@example.com",
  dob: "",
  school: "University of Ghana",
  level: "300",
  whatsapp: "0200000000",
  invitedBy: "Kwame",
  qrValue: "ticket_evt_revive_4f9k2a",
  status: "going",
  registeredAt: new Date().toISOString(),
  checkedInAt: null,
} satisfies Registration;

const QR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" shape-rendering="crispEdges">${
      Array.from({ length: 33 * 33 })
        .map((_, i) => {
          const x = i % 33;
          const y = Math.floor(i / 33);
          const finder =
            (x < 7 && y < 7) || (x > 25 && y < 7) || (x < 7 && y > 25);
          const on = finder
            ? (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5))
            : (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
          return on ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "";
        })
        .join("")
    }</svg>`
  );

export default function PreviewPage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center gap-8 bg-[#170807] p-5">
      <QRTicket
        theme="revive"
        registration={reg}
        qrImage={QR}
        eventName="Revive"
        eventStartsAt="2026-08-22T18:30:00Z"
        eventLocation="Anglican Church Hall, University of Ghana, Legon"
        eventLocationUrl="https://maps.google.com/?q=Legon"
      />
    </main>
  );
}
