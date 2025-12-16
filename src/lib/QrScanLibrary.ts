import {
  BarcodeDetector
} from '@sec-ant/barcode-detector/pure';

// @sec-ant/barcode-detector uses ZXing WASM by default, which is highly performant.
// We do not need to register an engine.

// --- Compatible Types ---

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

export interface DetectedBarcode {
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
  format: string;
  rawValue: string;
}

export interface ScanResult {
  rawValue: string;
  result: DetectedBarcode;
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
let activeStream: MediaStream | null = null;
let activeVideoElement: HTMLVideoElement | null = null;
let barcodeDetector: BarcodeDetector | null = null;
let scanController: AbortController | null = null;
let isScanning = false;

/**
 * Initialize the scanner environment
 * (Compatible signature, but mostly just prepares the container)
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
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('playsinline', 'true'); // For iOS

  container.appendChild(video);
  activeVideoElement = video;

  // Initialize detector
  try {
    barcodeDetector = new BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e']
    });
    console.log('✅ ZXing Detector initialized');
  } catch (e) {
    console.error('Failed to init ZXing detector', e);
  }
}

/**
 * Start Scanning
 */
export async function start(
  successCallback: QrcodeSuccessCallback,
  errorCallback: QrcodeErrorCallback,
  options: ScannerOptions = {}
) {
  if (isScanning) await stop();

  try {
    if (!activeVideoElement) {
      throw new Error("Scanner not initialized. Call init() first.");
    }

    const preset = options.performancePreset || 'balanced';
    const resolution = options.resolution || PRESETS[preset];

    // 1. Get Camera Stream
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: options.cameraId ? { exact: options.cameraId } : undefined,
        facingMode: options.cameraId ? undefined : { ideal: 'environment' },
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
        aspectRatio: { ideal: 1.0 }
        // Note: focusMode is handled via applyConstraints after opening
      }
    };

    activeStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Apply advanced constraints if possible (Focus, etc)
    await applyAdvancedConstraints(activeStream);

    // 2. Attach to Video
    activeVideoElement.srcObject = activeStream;

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      if (!activeVideoElement) return resolve();
      activeVideoElement.onloadedmetadata = () => {
        activeVideoElement?.play().then(resolve).catch(resolve);
      };
    });

    isScanning = true;
    scanController = new AbortController();

    // 3. Start Loop
    // 3. Start Loop
    startScanLoop(successCallback, errorCallback, options.fps || 15, scanController!.signal);

    return "started";

  } catch (err) {
    console.error("❌ Failed to start scanner:", err);
    errorCallback("Failed to start scanner", err);
    throw err;
  }
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

async function startScanLoop(
  successCb: QrcodeSuccessCallback,
  errorCb: QrcodeErrorCallback,
  fps: number,
  signal: AbortSignal
) {
  if (!barcodeDetector || !activeVideoElement) return;

  const intervalMs = 1000 / fps;

  const loop = async () => {
    if (signal.aborted) return;
    if (!activeVideoElement || activeVideoElement.paused || activeVideoElement.ended) {
      // Wait and retry if paused but not aborted
      if (!signal.aborted) setTimeout(loop, 100);
      return;
    }

    const start = performance.now();

    try {
      const barcodes = await barcodeDetector.detect(activeVideoElement);

      if (barcodes.length > 0) {
        // Return the first one
        const code = barcodes[0];
        successCb(code.rawValue, { rawValue: code.rawValue, result: code });
      }
    } catch {
      // errorCb("Scan detection error", err); 
      // Don't spam error callback for every frame failure, detection failures are normal
    }

    const duration = performance.now() - start;
    const delay = Math.max(0, intervalMs - duration);

    setTimeout(loop, delay);
  };

  loop();
}

/**
 * Stop Scanning
 */
export async function stop() {
  isScanning = false;
  if (scanController) {
    scanController.abort();
    scanController = null;
  }

  // Stop Stream
  if (activeStream) {
    activeStream.getTracks().forEach(track => {
      track.stop();
      // Turn off torch if manual control used
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
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(d => d.kind === 'videoinput')
    .map(d => ({
      id: d.deviceId,
      label: d.label || `Camera ${d.deviceId.substr(0, 5)}`
    }));
}

/**
 * Utilities for Torch and Focus
 */
function getVideoTrack(): MediaStreamTrack | null {
  return activeStream ? activeStream.getVideoTracks()[0] : null;
}

export async function toggleTorch(): Promise<boolean> {
  const track = getVideoTrack();
  if (!track) return false;

  // Check support
  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  if (!caps.torch) return false;

  // Toggle
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
  const track = getVideoTrack();
  if (!track) return false;
  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  return !!caps.torch;
}

export function isTorchEnabled(): boolean {
  const track = getVideoTrack();
  if (!track) return false;
  const settings = track.getSettings() as ExtendedMediaTrackSettings;
  return !!settings.torch;
}

export async function refocus(): Promise<boolean> {
  const track = getVideoTrack();
  if (!track) return false;

  const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
  if (!caps.focusMode || !caps.focusMode.includes('manual')) return false;

  try {
    // Manual focus cycle
    const constraintsManual: ExtendedMediaTrackConstraintSet = { focusMode: 'manual' };
    const constraintsContinuous: ExtendedMediaTrackConstraintSet = { focusMode: 'continuous' };

    await track.applyConstraints({ advanced: [constraintsManual] } as MediaTrackConstraints);

    await new Promise(r => setTimeout(r, 200));

    await track.applyConstraints({ advanced: [constraintsContinuous] } as MediaTrackConstraints);
    return true;
  } catch { return false; }
}

export function getRecommendedPreset(): PerformancePreset {
  // ZBar is fast, default to balanced or high
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  return isLowEnd ? 'balanced' : 'high-quality';
}
