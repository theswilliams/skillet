"use client";

import { useEffect, useRef, useState } from "react";
import { X, CameraOff } from "lucide-react";

/**
 * Camera-based barcode scanner using the browser's native BarcodeDetector
 * API (Shape Detection API — supported on Chrome/Edge, including Android).
 * Falls back to manual number entry everywhere else, so the feature always
 * works even where camera scanning isn't available.
 */
export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    setSupported(hasDetector);
    if (!hasDetector) return;

    let cancelled = false;
    let rafId: number;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DetectorCtor = (window as any).BarcodeDetector;
        const detector = new DetectorCtor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // Detection can throw transiently (e.g. video not ready yet) — just retry next frame.
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        setCameraError("Camera access denied or unavailable. Enter the barcode number instead.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-lg font-bold text-white">Scan Barcode</h3>
        <button onClick={onClose} className="text-white">
          <X size={22} strokeWidth={2.25} />
        </button>
      </div>

      {supported && !cameraError ? (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
          <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/80">Point your camera at a barcode</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <CameraOff size={36} strokeWidth={1.5} className="text-white/80" />
          <p className="text-sm text-white/80">
            {cameraError ?? "Live camera scanning isn't supported in this browser. Enter the barcode number instead."}
          </p>
        </div>
      )}

      <div className="flex gap-2 bg-white p-4">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && manualCode && onDetected(manualCode)}
          placeholder="Or type the barcode number"
          inputMode="numeric"
          className="flex-1 rounded-xl border border-[var(--color-line)] px-4 py-3 text-sm outline-none focus:border-[var(--color-coral)]"
        />
        <button
          onClick={() => manualCode && onDetected(manualCode)}
          disabled={!manualCode}
          className="rounded-xl bg-[var(--color-coral)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
