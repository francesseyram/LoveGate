"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

const ELEMENT_ID = "qr-reader";

/**
 * The browser itself (not our code) rejects a <video>.play() promise when its
 * element is removed from the DOM while play() is still pending — expected,
 * documented behavior (see the Chrome error's own help link), unavoidable
 * whenever this camera-owning component unmounts mid-start, and thrown deep
 * inside html5-qrcode's internals where we have no promise to catch. Mark
 * just this one known-benign rejection as handled so it doesn't surface as a
 * scary "unhandled" error; anything else still propagates normally.
 */
function isBenignPlayInterruptedRejection(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.includes("The play() request was interrupted");
}

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
    function handleRejection(event: PromiseRejectionEvent) {
      if (isBenignPlayInterruptedRejection(event.reason)) {
        event.preventDefault();
      }
    }
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;
    let unmounted = false;

    function safeStop() {
      // stop() throws synchronously (not a rejected promise) if the scanner
      // never reached a running/paused state, e.g. cleanup fires before the
      // camera permission prompt resolves — swallow that case entirely.
      try {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // ignore
            }
          });
      } catch {
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      }
    }

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => onScan(decodedText),
        undefined
      )
      .then(() => {
        // Unmounted (or switched tabs) while start() was still in flight —
        // the camera only just turned on, so stop it now instead of leaving
        // an orphaned stream running.
        if (unmounted) safeStop();
      })
      .catch(() => {
        if (!unmounted) setError("Couldn't access the camera. Check permissions and try again.");
      });

    return () => {
      unmounted = true;
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        safeStop();
      }
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
      <div
        id={ELEMENT_ID}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border-[1.5px] border-gold/40 bg-black/40"
      />
      {error && (
        <p className="mt-3 rounded-[10px] border border-coral/40 bg-coral/15 px-4 py-2.5 text-center text-sm text-[#F2C1C6]">
          {error}
        </p>
      )}
    </div>
  );
}
