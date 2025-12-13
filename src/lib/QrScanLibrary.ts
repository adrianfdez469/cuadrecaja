import {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeSupportedFormats,
  QrcodeErrorCallback,
  QrcodeSuccessCallback,
  Html5QrcodeScannerState
} from 'html5-qrcode';

/**
 * Extended interfaces for experimental camera features (Torch, Focus)
 */
interface MediaTrackCapabilitiesWithTorch extends MediaTrackCapabilities {
  torch?: boolean;
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step: number };
}

interface MediaTrackSettingsWithTorch extends MediaTrackSettings {
  torch?: boolean;
  focusMode?: string;
  focusDistance?: number;
}

interface MediaTrackConstraintSetWithTorch extends MediaTrackConstraintSet {
  torch?: boolean;
  focusMode?: string;
  focusDistance?: number;
}

/**
 * Performance preset options
 */
export type PerformancePreset = 'high-quality' | 'balanced' | 'performance';

/**
 * Scanner configuration options
 */
export interface ScannerOptions {
  fps?: number;
  resolution?: { width: number; height: number };
  performancePreset?: PerformancePreset;
  cameraId?: string;
}

/**
 * All supported barcode formats for maximum compatibility
 */
const supportedFormats = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
];

/**
 * Performance presets
 */
const PERFORMANCE_PRESETS = {
  'high-quality': {
    fps: 15,
    resolution: { width: 1080, height: 1080 }
  },
  'balanced': {
    fps: 10,
    resolution: { width: 720, height: 720 }
  },
  'performance': {
    fps: 5,
    resolution: { width: 480, height: 480 }
  }
};

let html5QrCodeInstance: Html5Qrcode | null = null;
let currentVideoTrack: MediaStreamTrack | null = null;
let torchEnabled = false;

/**
 * Get optimized camera configuration with enhanced autofocus
 */
const getCameraConfig = (options: ScannerOptions = {}) => {
  const preset = options.performancePreset || 'balanced';
  const resolution = options.resolution || PERFORMANCE_PRESETS[preset].resolution;

  // Advanced constraints for better autofocus and small barcode reading
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: resolution.width },
    height: { ideal: resolution.height },
    // Advanced focus settings for better small barcode reading
    focusMode: { ideal: 'continuous' }, // Continuous autofocus
    focusDistance: { ideal: 0.15 }, // Optimal focus distance ~15cm
    // Additional constraints for better quality
    aspectRatio: { ideal: 1.0 },
    frameRate: { ideal: PERFORMANCE_PRESETS[preset].fps },
    // Request better image quality
    exposureMode: { ideal: 'continuous' },
    whiteBalanceMode: { ideal: 'continuous' }
  } as MediaTrackConstraints;
};

/**
 * Create scanning configuration based on options
 */
const createConfig = (options: ScannerOptions = {}): Html5QrcodeCameraScanConfig => {
  const preset = options.performancePreset || 'balanced';
  const fps = options.fps || PERFORMANCE_PRESETS[preset].fps;
  const resolution = options.resolution || PERFORMANCE_PRESETS[preset].resolution;

  return {
    fps,
    qrbox: function (viewfinderWidth, viewfinderHeight) {
      // Improved dynamic qrbox for better small barcode reading
      // Use larger percentage for high-quality preset
      const isHighQuality = preset === 'high-quality';
      const minEdgePercentage = isHighQuality ? 0.8 : 0.7;

      const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
      const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);

      // For small barcodes, ensure minimum readable size
      const minWidth = 250; // Minimum width for barcode readability
      const minHeight = 120; // Minimum height for barcode readability

      // Return wider box for better barcode scanning
      return {
        width: Math.max(minWidth, Math.min(qrboxSize * 1.2, viewfinderWidth * 0.9)),
        height: Math.max(minHeight, Math.min(qrboxSize * 0.6, viewfinderHeight * 0.5))
      };
    },
    aspectRatio: 1.0, // 1:1 ratio (Square)
    disableFlip: false,
    videoConstraints: {
      width: { ideal: resolution.width },
      height: { ideal: resolution.height },
      facingMode: { ideal: 'environment' },
      aspectRatio: { ideal: 1.0 }
    }
  };
};

/**
 * Initialize the QR/Barcode scanner
 * @param containerId - The ID of the HTML element to render the scanner
 * @param verbose - Enable verbose logging for debugging (default: false)
 */
export async function init(containerId: string, verbose: boolean = false) {
  // Logic to handle cleanup of previous instance if it exists
  if (html5QrCodeInstance) {
    try {
      // If scanning, stop first
      if (html5QrCodeInstance.getState() === Html5QrcodeScannerState.SCANNING ||
        html5QrCodeInstance.getState() === Html5QrcodeScannerState.PAUSED) {
        await stop();
      }

      // Clear the instance to unmount from DOM
      html5QrCodeInstance.clear();
    } catch (e) {
      console.warn('Cleanup error in init:', e);
    }

    // Nullify to ensure fresh start
    html5QrCodeInstance = null;
  }

  html5QrCodeInstance = new Html5Qrcode(containerId, {
    formatsToSupport: supportedFormats,
    verbose: verbose
  });
  return html5QrCodeInstance;
}

/**
 * Get list of available cameras
 */
export async function getCameras() {
  return await Html5Qrcode.getCameras();
}

/**
 * Start scanning with optimized configuration
 */
export async function start(
  qrCodeSuccessCallback: QrcodeSuccessCallback,
  qrCodeErrorCallback: QrcodeErrorCallback,
  options: ScannerOptions = {}
) {
  try {
    if (!html5QrCodeInstance) {
      throw new Error("Scanner not initialized. Call init() first.");
    }

    const instance = html5QrCodeInstance;

    // Safety check: if already scanning, stop first
    if (instance.getState() === Html5QrcodeScannerState.SCANNING) {
      await stop();
    }

    const cameraConfig = options.cameraId ? options.cameraId : getCameraConfig(options);
    const config = createConfig(options);

    const result = await instance.start(
      cameraConfig,
      config,
      qrCodeSuccessCallback,
      qrCodeErrorCallback
    );

    // Store video track for torch control
    await storeVideoTrack();

    return result;
  } catch (err) {
    console.error('Error starting QR/Barcode scanning:', err);
    throw err;
  }
}

/**
 * Store the current video track for torch/flashlight control
 */
async function storeVideoTrack() {
  try {
    const videoElement = document.querySelector('#qrTest video') as HTMLVideoElement;
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        currentVideoTrack = tracks[0];
      }
    }
  } catch (err) {
    console.warn('Could not access video track:', err);
  }
}

/**
 * Check if torch/flashlight is supported
 */
export async function isTorchSupported(): Promise<boolean> {
  if (!currentVideoTrack) {
    return false;
  }

  try {
    const capabilities = currentVideoTrack.getCapabilities() as MediaTrackCapabilitiesWithTorch;
    return capabilities.torch === true;
  } catch (err) {
    console.error('Could not access video track:', err);
    return false;
  }
}

/**
 * Toggle torch/flashlight on or off
 * @returns true if torch was toggled successfully
 */
export async function toggleTorch(): Promise<boolean> {
  if (!currentVideoTrack) {
    console.warn('No video track available');
    return false;
  }

  try {
    const capabilities = currentVideoTrack.getCapabilities() as MediaTrackCapabilitiesWithTorch;
    if (!capabilities.torch) {
      console.warn('Torch not supported on this device');
      return false;
    }

    torchEnabled = !torchEnabled;

    // Create constraints with proper type - advanced is an array of constraint sets
    const constraints = {
      advanced: [{ torch: torchEnabled } as MediaTrackConstraintSetWithTorch]
    };

    await currentVideoTrack.applyConstraints(constraints);

    console.log(`🔦 Torch ${torchEnabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (err) {
    console.error('Error toggling torch:', err);
    return false;
  }
}

/**
 * Get current torch state
 */
export function isTorchEnabled(): boolean {
  return torchEnabled;
}

/**
 * Force camera to refocus
 * Useful when focus is lost while scanning small barcodes
 * @returns true if refocus was successful
 */
export async function refocus(): Promise<boolean> {
  if (!currentVideoTrack) {
    console.warn('No video track available for refocus');
    return false;
  }

  try {
    const capabilities = currentVideoTrack.getCapabilities() as MediaTrackCapabilitiesWithTorch;

    // Try to trigger autofocus by toggling focus mode
    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
      await currentVideoTrack.applyConstraints({
        advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSetWithTorch]
      });

      // Wait a bit then switch back to continuous
      await new Promise(resolve => setTimeout(resolve, 100));

      await currentVideoTrack.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSetWithTorch]
      });

      console.log('📷 Camera refocused');
      return true;
    }

    // Alternative: try adjusting focus distance
    if (capabilities.focusDistance) {
      const currentSettings = currentVideoTrack.getSettings() as MediaTrackSettingsWithTorch;
      const currentDistance = currentSettings.focusDistance || 0.15;

      // Slightly adjust focus distance to trigger refocus
      await currentVideoTrack.applyConstraints({
        advanced: [{ focusDistance: currentDistance + 0.01 } as MediaTrackConstraintSetWithTorch]
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await currentVideoTrack.applyConstraints({
        advanced: [{ focusDistance: 0.15 } as MediaTrackConstraintSetWithTorch] // Back to optimal 15cm
      });

      console.log('📷 Camera refocused via distance adjustment');
      return true;
    }

    console.warn('Refocus not supported on this device');
    return false;
  } catch (err) {
    console.error('Error refocusing camera:', err);
    return false;
  }
}

/**
 * Stop the scanner and release camera
 */
export async function stop() {
  if (!html5QrCodeInstance) {
    console.warn('Scanner not initialized');
    return;
  }

  const instance = html5QrCodeInstance;

  // Check if we are actually scanning or paused
  try {
    const state = instance.getState();
    if (state !== Html5QrcodeScannerState.SCANNING && state !== Html5QrcodeScannerState.PAUSED) {
      console.log('Scanner not running, skipping stop()');
      return;
    }
  } catch (_e) {
    console.error(_e)
    // If getState fails, just try to stop
  }

  try {
    // Turn off torch before stopping
    if (torchEnabled && currentVideoTrack) {
      await toggleTorch();
    }

    await instance.stop();
    // Also clear the canvas to remove the video element
    try {
      instance.clear();
    } catch (_e) {
      console.error(_e)
    }

    currentVideoTrack = null;
    torchEnabled = false;
    console.log('✅ Scanner stopped successfully');
  } catch (err) {
    console.error('❌ Error stopping scanner:', err);
    // Don't throw here to avoid unhandled rejections in cleanup effects
  }
}

/**
 * Get the current scanner state
 */
export function getState() {
  return html5QrCodeInstance?.getState();
}

/**
 * Pause scanning (keeps camera active but stops processing)
 */
export async function pause() {
  if (html5QrCodeInstance) {
    await html5QrCodeInstance.pause();
  }
}

/**
 * Resume scanning after pause
 */
export async function resume() {
  if (html5QrCodeInstance) {
    await html5QrCodeInstance.resume();
  }
}

/**
 * Get recommended performance preset based on device
 */
export function getRecommendedPreset(): PerformancePreset {
  // Check if device is low-end
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isLowEnd) {
    return 'performance';
  } else if (isMobile) {
    return 'balanced';
  } else {
    return 'high-quality';
  }
}
