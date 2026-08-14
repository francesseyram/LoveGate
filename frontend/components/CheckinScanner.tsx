"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

const ELEMENT_ID = "qr-reader";

export function CheckinScanner({
  onScan,
  paused,
}: {
  onScan: (decodedText: string) => void;
  paused: boolean;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => onScan(decodedText),
        undefined
      )
      .catch(() => setError("Couldn't access the camera. Check permissions and try again."));

    return () => {
      scanner
        .stop()
        .catch(() => {})
        .finally(() => scanner.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const state = scanner.getState();
    if (paused && state === Html5QrcodeScannerState.SCANNING) {
      scanner.pause(true);
    } else if (!paused && state === Html5QrcodeScannerState.PAUSED) {
      scanner.resume();
    }
  }, [paused]);

  return (
    <div>
      <div id={ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
