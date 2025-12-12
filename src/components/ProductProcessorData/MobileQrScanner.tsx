import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  Skeleton,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FlashlightOnIcon from '@mui/icons-material/FlashlightOn';
import FlashlightOffIcon from '@mui/icons-material/FlashlightOff';
import SpeedIcon from '@mui/icons-material/Speed';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import BoltIcon from '@mui/icons-material/Bolt';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import {
  init,
  start,
  stop,
  toggleTorch,
  isTorchSupported,
  isTorchEnabled,
  refocus,
  getRecommendedPreset,
  getCameras,
  PerformancePreset
} from '@/lib/QrScanLibrary';
import { QrcodeErrorCallback, QrcodeSuccessCallback } from 'html5-qrcode';
import audioService from '@/utils/audioService';
import ScannerTips from './ScannerTips';
import { useScannerOptimization } from '@/hooks/useScannerOptimization';

type MobileQrScannerProps = {
  qrCodeSuccessCallback: QrcodeSuccessCallback;
  qrCodeErrorCallback?: QrcodeErrorCallback;
  buttonLabel?: string;
  showTips?: boolean;
  showPerformanceSelector?: boolean;
  defaultPreset?: PerformancePreset;
};

export interface MobileQrScannerRef {
  openScanner: () => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

const MobileQrScanner = forwardRef<MobileQrScannerRef, MobileQrScannerProps>(
  ({
    qrCodeSuccessCallback,
    qrCodeErrorCallback,
    buttonLabel,
    showTips = true,
    showPerformanceSelector = true,
    defaultPreset
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchActive, setTorchActive] = useState(false);
    const [performancePreset, setPerformancePreset] = useState<PerformancePreset>(
      defaultPreset || getRecommendedPreset()
    );
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');

    // Use scanner optimization hook
    const scannerStats = useScannerOptimization();

    // Activar audio context cuando se abre el scanner
    useEffect(() => {
      if (isOpen) {
        audioService.resumeAudioContext();
        scannerStats.startSession(); // Changed from startScan
        scannerStats.recordAttempt();
        // Don't fetch cameras here, do it after start to avoid race conditions
      }
    }, [isOpen]);

    const fetchCameras = async () => {
      try {
        const devices = await getCameras();
        setCameras(devices);
      } catch (err) {
        console.error('Error fetching cameras:', err);
      }
    };

    // Check torch support after scanner starts
    useEffect(() => {
      if (!loading && isOpen && !error) {
        checkTorchSupport();
      }
    }, [loading, isOpen, error]);

    const checkTorchSupport = async () => {
      const supported = await isTorchSupported();
      setTorchSupported(supported);
    };

    useImperativeHandle(ref, () => ({
      openScanner: () => {
        setIsOpen(true);
      }
    }));

    function handleOpen() {
      setIsOpen(true);
    }

    // State for visual feedback
    const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'warning', message: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Callback de éxito personalizado con sonido
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSuccess = async (qrText: string, result: any) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        // Try to handle the success callback
        // We await it to see if the parent component accepts the code or throws an error (e.g. "Product not found")
        await Promise.resolve(qrCodeSuccessCallback(qrText, result));

        // SUCCESS CASE
        audioService.playSuccessSound();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200);
        }

        scannerStats.recordSuccess();

        // Show green success message
        // Replaces any existing warning
        setScanFeedback({
          type: 'success',
          message: `Código detectado: ${qrText}`
        });

        // Hide success message after 3 seconds
        setTimeout(() => {
          setScanFeedback(prev => prev?.type === 'success' ? null : prev);
        }, 3000);

      } catch (error) {
        // FAIL/NOT FOUND CASE
        console.warn("Scan processing error:", error);

        audioService.playErrorSound();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          // Error vibration: double pulse
          navigator.vibrate([100, 50, 100]);
        }

        scannerStats.recordFailure();

        // Show warning message
        // This persists until a successful scan ("que se quite solo cuando se agregue")
        setScanFeedback({
          type: 'warning',
          message: error instanceof Error ? error.message : "Producto no encontrado"
        });
      } finally {
        // Cooldown period before allowing next scan
        setTimeout(() => {
          setIsProcessing(false);
        }, 2000); // 2 second delay between scans
      }
    };

    // Callback de error personalizado para rastrear intentos fallidos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleError = (errorMessage: string, error: any) => {
      // Solo contar como intento fallido si realmente intentó decodificar
      // (no contar errores de configuración o permisos)
      if (errorMessage && !errorMessage.includes('NotAllowed') && !errorMessage.includes('NotFound')) {
        scannerStats.recordFailure();
      }

      // Llamar al callback del usuario si existe
      if (qrCodeErrorCallback) {
        qrCodeErrorCallback(errorMessage, error);
      }
    };

    async function startScannerWithConfig(preset: PerformancePreset, cameraId: string) {
      try {
        await init('qrTest', false); // Set to true for debugging
        setLoading(true);
        setError(null);

        await start(
          handleSuccess,
          handleError, // Use custom error callback
          {
            performancePreset: preset,
            cameraId: cameraId
          }
        );

        setLoading(false);
      } catch (e) {
        console.error('Scanner initialization error:', e);
        setLoading(false);

        // Better error messages
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission')) {
          setError(
            'Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.'
          );
        } else if (errorMessage.includes('NotFoundError')) {
          setError('No se encontró ninguna cámara en tu dispositivo.');
        } else if (errorMessage.includes('NotReadableError')) {
          setError(
            'La cámara está siendo usada por otra aplicación. Por favor, cierra otras apps que usen la cámara.'
          );
        } else {
          setError(
            'Error al iniciar el escáner. Asegúrate de estar usando HTTPS y que tu navegador soporte acceso a la cámara.'
          );
        }

        audioService.playErrorSound();
      }
    }

    async function handleStartScanner() {
      await startScannerWithConfig(performancePreset, selectedCameraId);
      // Fetch cameras AFTER finding the stream to ensure permissions are granted and no conflict
      fetchCameras();
    }

    async function handleToggleTorch() {
      const success = await toggleTorch();
      if (success) {
        setTorchActive(isTorchEnabled());
      }
    }

    async function handleRefocus() {
      const success = await refocus();
      if (success) {
        console.log('Camera refocused successfully');
      }
    }

    function handleStop() {
      setIsOpen(false);
      setError(null);
      setTorchActive(false);
      setScanFeedback(null);
      setIsProcessing(false);
      stop();
    }

    const handlePresetChange = (_event: React.MouseEvent<HTMLElement>, newPreset: PerformancePreset | null) => {
      if (newPreset !== null) {
        setPerformancePreset(newPreset);

        // Restart scanner if open to apply changes immediately
        if (isOpen && !loading) {
          setLoading(true);
          stop().then(() => {
            setTimeout(() => {
              startScannerWithConfig(newPreset, selectedCameraId);
            }, 100);
          }).catch(err => {
            console.error("Error stopping scanner for preset change", err);
            // Try to start anyway
            startScannerWithConfig(newPreset, selectedCameraId);
          });
        }
      }
    };

    const handleCameraChange = async (event: SelectChangeEvent) => {
      const newCameraId = event.target.value;
      setSelectedCameraId(newCameraId);

      // Restart scanner with new camera
      setLoading(true);
      try {
        await stop();
        // Small delay to ensure clean stop
        setTimeout(() => {
          startScannerWithConfig(performancePreset, newCameraId);
        }, 100);
      } catch (err) {
        console.error("Error changing camera", err);
        startScannerWithConfig(performancePreset, newCameraId);
      }
    };

    return (
      <>
        <Button size="large" startIcon={<QrCode2Icon />} onClick={handleOpen} variant="contained" color="info">
          {buttonLabel}
        </Button>

        <Dialog
          open={isOpen}
          onClose={handleStop}
          fullWidth
          maxWidth="sm"
          slotProps={{
            transition: { onEntered: handleStartScanner }
          }}
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1}>
                <QrCodeScannerIcon />
                <Typography variant="h6">Escaner</Typography>
              </Box>
            </Box>
          </DialogTitle>

          <DialogContent>


            {/* Scanner container */}
            <Box
              id="qrTest"
              sx={{
                width: '100%',
                minHeight: 200,
                marginBottom: 2,
                borderRadius: 1,
                overflow: 'hidden',
                backgroundColor: '#000',
                position: 'relative', // For absolute positioning of feedback
                '& video': {
                  borderRadius: 1
                }
              }}
            >
              {/* Visual Feedback Overlay */}
              {scanFeedback && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    p: 2
                  }}
                >
                  <Alert
                    severity={scanFeedback.type}
                    variant="filled"
                    onClose={scanFeedback.type === 'success' ? () => setScanFeedback(null) : undefined}
                    sx={{
                      boxShadow: 3,
                      animation: 'fadeIn 0.3s ease-out',
                      '@keyframes fadeIn': {
                        '0%': { opacity: 0, transform: 'translateY(-20px)' },
                        '100%': { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    {scanFeedback.message}
                  </Alert>
                </Box>
              )}
            </Box>

            {/* Camera Controls - Below Scanner */}
            {!loading && !error && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                {/* Camera Selector */}
                <FormControl size="small" fullWidth>
                  <InputLabel id="camera-select-label">Cámara</InputLabel>
                  <Select
                    labelId="camera-select-label"
                    value={selectedCameraId}
                    label="Cámara"
                    onChange={handleCameraChange}
                    startAdornment={<CameraswitchIcon sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    <MenuItem value="">
                      <em>Automática (Recomendada)</em>
                    </MenuItem>
                    {cameras.map((camera) => (
                      <MenuItem key={camera.id} value={camera.id}>
                        {camera.label || `Cámara ${camera.id.substring(0, 5)}...`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Torch Button */}
                {torchSupported && (
                  <Tooltip title={torchActive ? 'Apagar linterna' : 'Encender linterna'}>
                    <IconButton
                      onClick={handleToggleTorch}
                      color={torchActive ? 'warning' : 'default'}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        width: 40,
                        height: 40
                      }}
                    >
                      {torchActive ? <FlashlightOnIcon /> : <FlashlightOffIcon />}
                    </IconButton>
                  </Tooltip>
                )}

                {/* Refocus Button */}
                <Tooltip title="Reenfocar cámara">
                  <IconButton
                    onClick={handleRefocus}
                    color="primary"
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      width: 40,
                      height: 40
                    }}
                  >
                    <CameraAltIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}

            {loading && (
              <Box sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Iniciando cámara...
                </Typography>
              </Box>
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            {/* Performance Preset Selector */}
            {showPerformanceSelector && !loading && !error && (
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                  Modo de rendimiento:
                </Typography>
                <ToggleButtonGroup
                  value={performancePreset}
                  exclusive
                  onChange={handlePresetChange}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="performance">
                    <BoltIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Rápido
                  </ToggleButton>
                  <ToggleButton value="balanced">
                    <SpeedIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Balanceado
                  </ToggleButton>
                  <ToggleButton value="high-quality">
                    <HighQualityIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Alta Calidad
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}

            {/* Scanner optimization suggestions */}
            {scannerStats.suggestions.length > 0 && !loading && !error && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Sugerencias:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {scannerStats.suggestions.map((suggestion, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{suggestion}</Typography>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Show tips only when not loading and no error */}
            {!loading && !error && showTips && <ScannerTips />}
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

MobileQrScanner.displayName = 'MobileQrScanner';

export default MobileQrScanner;
