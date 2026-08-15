"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

const ELEMENT_ID = "qr-reader";

/**
 * html5-qrcode's start() opens by wiping the container (`innerHTML = ""`), and
 * the <video> it then creates is played through a bare `surface.play()` whose
 * promise it never handles. So two instances overlapping on the same element
 * is doubly destructive: the second one's start() rips the first one's video
 * out of the document while its play() is still pending — an AbortError we
 * have no promise to catch — and the first one's eventual teardown then clears
 * the container again, leaving the second with a dead black preview.
 *
 * React remounts this component routinely: StrictMode invokes the effect,
 * cleans up, and invokes it again on every dev mount, and Fast Refresh repeats
 * that on each edit. This lock serializes camera setup and teardown across
 * those remounts so a new instance never starts until the previous one has
 * fully stopped. ELEMENT_ID is a page singleton, so module scope is the right
 * scope for the lock. Tasks are chained through a catch so one failed teardown
 * can't wedge the queue or surface as its own unhandled rejection.
 */
let cameraLock: Promise<void> = Promise.resolve();

function enqueueCameraTask(task: () => Promise<void>): void {
  cameraLock = cameraLock.then(task).catch(() => {});
}

export function CheckinScanner({
  onScan,
  paused,
}: {
  onScan: (decodedText: string) => void;
  paused: boolean;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  // The scanner starts once and holds whatever callback it was given forever,
  // so it has to read through a ref — a captured closure would keep checking
  // people into whichever event was selected when the camera first came up.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(ELEMENT_ID);

    enqueueCameraTask(async () => {
      // Unmounted while queued behind an earlier teardown — never open the
      // camera at all. This is the common path under StrictMode.
      if (cancelled) return;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText) => onScanRef.current(decodedText),
          undefined
        );
        // Published only on success, so teardown can tell "running" apart
        // from "never started" without inspecting scanner state.
        scannerRef.current = scanner;
      } catch {
        if (!cancelled) {
          setError("Couldn't access the camera. Check permissions and try again.");
        }
      }
    });

    return () => {
      cancelled = true;
      enqueueCameraTask(async () => {
        if (scannerRef.current !== scanner) return;
        scannerRef.current = null;
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            await scanner.stop();
          }
        } catch {
          // stop() can reject if the stream already died; still clear below.
        } finally {
          try {
            scanner.clear();
          } catch {
            // ignore
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const state = scanner.getState();
      if (paused && state === Html5QrcodeScannerState.SCANNING) {
        scanner.pause(true);
      } else if (!paused && state === Html5QrcodeScannerState.PAUSED) {
        scanner.resume();
      }
    } catch {
      // Raced with teardown; the scanner is going away regardless.
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
