import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  Result
} from '@zxing/library';

// --- Types ---

// Standard MediaStream types do not yet fully support 'torch' and 'focusMode'
// We define extended interfaces to support them safely.

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  focusMode?: string[];
}

interface ExtendedMediaTrackSettings extends MediaTrackSettings {
  torch?: boolean;
  focusMode?: string;
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
  focusMode?: string;
}

export interface ScanResult {
  format: string;
  raw: Result;
}

export type QrcodeSuccessCallback = (decodedText: string, result: ScanResult) => void;
export type QrcodeErrorCallback = (errorMessage: string, result: Error | unknown) => void;

export type PerformancePreset = 'high-quality' | 'balanced' | 'performance';

export interface ScannerOptions {
  fps?: number;
  resolution?: { width: number; height: number };
  performancePreset?: PerformancePreset;
  cameraId?: string;
}

// --- Configuration ---
const PRESETS = {
  'high-quality': { width: 1080, height: 1080 },
  'balanced': { width: 720, height: 720 },
  'performance': { width: 480, height: 480 }
};

// --- Internal State ---
let codeReader: BrowserMultiFormatReader | null = null;
let activeVideoElement: HTMLVideoElement | null = null;
let activeStream: MediaStream | null = null;
let currentDeviceId: string | null = null;

/**
 * Initialize the scanner environment
 */
export async function init(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Container '${containerId}' not found`);

  // Ensure container is clean
  container.innerHTML = '';

  // Create video element
  const video = document.createElement('video');
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.borderRadius = '8px';
  video.id = 'scanner-video';
  // Important for mobile
  video.setAttribute('playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.muted = true;

  container.appendChild(video);
  activeVideoElement = video;

  // Initialize ZXing Reader
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E
  ]);

  codeReader = new BrowserMultiFormatReader(hints, 500); // 500ms delay between scans approx
  console.log('✅ @zxing/library Reader initialized');
}

/**
 * Start Scanning
 */
export async function start(
  successCallback: QrcodeSuccessCallback,
  errorCallback: QrcodeErrorCallback,
  options: ScannerOptions = {}
) {
  if (!codeReader || !activeVideoElement) {
    throw new Error("Scanner not initialized. Call init() first.");
  }

  // Stop previous if any
  await stop();

  try {
    const preset = options.performancePreset || 'balanced';
    const resolution = options.resolution || PRESETS[preset];

    // Build constraints
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
        facingMode: options.cameraId ? undefined : { ideal: 'environment' },
        deviceId: options.cameraId ? { exact: options.cameraId } : undefined
      }
    };

    // 1. Get User Media directly first to have control over the stream (Resolution, etc)
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStream = stream;

    // Apply native constraints if needed (Focus)
    await applyAdvancedConstraints(stream);

    // 2. Decode from stream
    // Note: BrowserMultiFormatReader.decodeFromStream attaches the stream to the video element for us
    // But since we created the video element manually and want full control, we can pass the stream and video element.

    // We attach the stream manually to ensure it works with our crafted video element
    activeVideoElement.srcObject = stream;

    // Wait for play (improves reliability)
    await new Promise<void>((resolve) => {
      if (!activeVideoElement) return resolve();
      activeVideoElement.onloadedmetadata = () => {
        activeVideoElement?.play().catch(() => { });
        resolve();
      };
    });

    // Start Continuous Decode
    codeReader.decodeFromVideoElementContinuously(
      activeVideoElement,
      (result: Result, err: unknown) => {
        if (result) {
          // Determine format name from enum
          const formatName = BarcodeFormat[result.getBarcodeFormat()];
          successCallback(result.getText(), { format: formatName, raw: result });
        }
        if (err) {
          // ZXing lib throws NotFoundException continuously when no code is found.
          // We only care about real errors, but for now we silence typical scan fails.
        }
      }
    );

    // Store deviceId used
    const track = stream.getVideoTracks()[0];
    if (track) {
      currentDeviceId = track.getSettings().deviceId || null;
    }

    return "started";

  } catch (err) {
    console.error("❌ Failed to start scanner:", err);
    errorCallback("Failed to start scanner", err);
    throw err;
  }
}

/**
 * Stop Scanning
 */
export async function stop() {
  if (codeReader) {
    codeReader.reset(); // Stops decoding loops
  }

  // Stop Stream manually to be sure
  if (activeStream) {
    activeStream.getTracks().forEach(track => {
      track.stop();
      track.enabled = false;
    });
    activeStream = null;
  }

  if (activeVideoElement) {
    activeVideoElement.srcObject = null;
  }

  console.log("✅ Scanner stopped");
}

/**
 * Get available cameras
 */
export async function getCameras() {
  if (!codeReader) return [];
  try {
    const devices = await codeReader.listVideoInputDevices();
    return devices.map(d => ({
      id: d.deviceId,
      label: d.label || `Camera ${d.deviceId?.substring(0, 5)}`
    }));
  } catch (e) {
    console.error("Failed to list devices", e);
    return [];
  }
}

/**
 * Get current device id
 */
export function getActiveDeviceId() {
  return currentDeviceId;
}

// --- Utilities ---

export async function toggleTorch(): Promise<boolean> {
  const track = activeStream?.getVideoTracks()[0];
  if (!track) return false;

  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  if (!caps.torch) return false;

  const current = track.getSettings() as ExtendedMediaTrackSettings;
  const nextState = !current.torch;

  try {
    const constraints: ExtendedMediaTrackConstraintSet = { torch: nextState };
    await track.applyConstraints({ advanced: [constraints] } as MediaTrackConstraints);
    return nextState;
  } catch (e) {
    console.error("Torch toggle failed", e);
    return false;
  }
}

export function isTorchSupported(): boolean {
  const track = activeStream?.getVideoTracks()[0];
  if (!track) return false;
  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  return !!caps.torch;
}

async function applyAdvancedConstraints(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;

  const capabilities = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = { advanced: [] };

  if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
    constraints.advanced.push({ focusMode: 'continuous' });
  }

  if (constraints.advanced.length > 0) {
    try {
      // Cast to MediaTrackConstraints to avoid 'any' but satisfy the interface
      await track.applyConstraints(constraints as MediaTrackConstraints);
    } catch {
      // Ignore
    }
  }
}

export function getRecommendedPreset(): PerformancePreset {
  // ZXing JS is pure JS, so it can be heavy.
  // We should be careful on low-end devices.
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  return isLowEnd ? 'performance' : 'balanced';
}
