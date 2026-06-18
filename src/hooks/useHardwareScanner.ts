import { useEffect, useRef } from "react";
import {
  HARDWARE_SCAN_IDLE_MS,
  isEditableTarget,
  shouldAcceptScanKey,
} from "@/utils/hardwareScanner";

type UseHardwareScannerOptions = {
  enabled: boolean;
  onScan: (rawCode: string) => void;
  idleMs?: number;
};

export function useHardwareScanner({
  enabled,
  onScan,
  idleMs = HARDWARE_SCAN_IDLE_MS,
}: UseHardwareScannerOptions) {
  const bufferRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);

  onScanRef.current = onScan;

  useEffect(() => {
    const clearBuffer = () => {
      bufferRef.current = "";
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const flushBuffer = () => {
      const code = bufferRef.current.trim();
      clearBuffer();
      if (code.length > 0) {
        onScanRef.current(code);
      }
    };

    const scheduleFlush = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(flushBuffer, idleMs);
    };

    if (!enabled) {
      clearBuffer();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        clearBuffer();
        return;
      }

      if (event.key === "Enter") {
        if (bufferRef.current.length > 0) {
          event.preventDefault();
          flushBuffer();
        }
        return;
      }

      if (!shouldAcceptScanKey(event.key)) return;

      bufferRef.current += event.key;
      scheduleFlush();
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearBuffer();
    };
  }, [enabled, idleMs]);
}
