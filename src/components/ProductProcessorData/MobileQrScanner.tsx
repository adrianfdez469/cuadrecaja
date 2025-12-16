import React, { useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { Button, Dialog, DialogContent, Alert, Skeleton, IconButton, Box, Typography, Menu, MenuItem } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FlashOffIcon from '@mui/icons-material/FlashOff';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';

import {
  init,
  start,
  stop,
  getCameras,
  toggleTorch,
  isTorchSupported,
  PerformancePreset,
  QrcodeSuccessCallback,
  QrcodeErrorCallback
} from '@/lib/QrScanLibrary';
import audioService from '@/utils/audioService';

type MobileQrScannerProps = {
  qrCodeSuccessCallback: QrcodeSuccessCallback;
  qrCodeErrorCallback?: QrcodeErrorCallback;
  buttonLabel?: string;
};

export interface MobileQrScannerRef {
  openScanner: () => void;
}

const MobileQrScanner = forwardRef<MobileQrScannerRef, MobileQrScannerProps>(
  ({ qrCodeSuccessCallback, qrCodeErrorCallback, buttonLabel }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // Scanner State
    const [cameras, setCameras] = useState<{ id: string, label: string }[]>([]);
    const [cameraId, setCameraId] = useState<string | undefined>(undefined);
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [preset, setPreset] = useState<PerformancePreset>('balanced');

    // Settings Menu
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    // Audio context on open
    useEffect(() => {
      if (isOpen) {
        audioService.resumeAudioContext();
      }
    }, [isOpen]);

    useImperativeHandle(ref, () => ({
      openScanner: () => {
        setIsOpen(true);
      }
    }));

    function handleOpen() {
      setIsOpen(true);
    }

    const handleStop = useCallback(() => {
      setIsOpen(false);
      setError(false);
      stop().then(() => {
        setTorchOn(false);
      });
    }, []);

    const handleSuccess: QrcodeSuccessCallback = useCallback((qrText, result) => {
      audioService.playSuccessSound();
      qrCodeSuccessCallback(qrText, result);
      handleStop();
    }, [qrCodeSuccessCallback, handleStop]);

    const handleStartScanner = useCallback(async () => {
      try {
        setLoading(true);
        setError(false);

        await init('qrTest');

        await start(
          handleSuccess,
          (err, result) => {
            if (qrCodeErrorCallback) qrCodeErrorCallback(err, result);
          },
          {
            cameraId,
            performancePreset: preset
          }
        );

        // Post-start checks
        const canTorch = isTorchSupported();
        setHasTorch(canTorch);
        setTorchOn(false); // Reset torch state

        // Load cameras if not already loaded
        if (cameras.length === 0) {
          const cams = await getCameras();
          setCameras(cams);
          // If we didn't have a specific camera and now we see some, 
          // we might want to set the current one, but start() picks default 'environment'
        }
      } catch (e) {
        console.error("Scanner failed to start", e);
        setError(true);
        audioService.playErrorSound();
      } finally {
        setLoading(false);
      }
    }, [cameraId, preset, qrCodeSuccessCallback, qrCodeErrorCallback, cameras.length, handleSuccess]);

    // Restart scanner when settings change (if already open and not loading)
    useEffect(() => {
      if (isOpen && !loading && !error) {
        // Debounce slightly or just restart? 
        // Calling start() again safely restarts it.
        handleStartScanner();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraId, preset]);

    // handleStop is now defined above

    const onToggleTorch = async () => {
      const newState = await toggleTorch();
      setTorchOn(newState);
    };

    const onSwitchCamera = () => {
      if (cameras.length < 2) return;

      const currentIndex = cameras.findIndex(c => c.id === cameraId);
      // If current not found (undefined), default was likely last one (environment). 
      // Let's just cycle next.

      let nextIndex = 0;
      if (currentIndex >= 0) {
        nextIndex = (currentIndex + 1) % cameras.length;
      }

      setCameraId(cameras[nextIndex].id);
    };

    return (
      <>
        <Button size="large" startIcon={<QrCode2Icon />} onClick={handleOpen} variant="contained" color='info'>
          {buttonLabel}
        </Button>

        <Dialog
          open={isOpen}
          onClose={handleStop}
          fullWidth
          maxWidth="sm"
          fullScreen
          PaperProps={{
            sx: {
              backgroundColor: 'black',
              color: 'white'
            }
          }}
          slotProps={{
            transition: { onEntered: handleStartScanner }
          }}
        >
          <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Controls */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              p: 2,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)'
            }}>
              <IconButton onClick={handleStop} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>

              <Box>
                {/* Resolution Menu */}
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  sx={{ color: 'white', mr: 1 }}
                >
                  <SettingsIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                >
                  <MenuItem onClick={() => { setPreset('performance'); setAnchorEl(null); }}>Rendimiento (480p)</MenuItem>
                  <MenuItem onClick={() => { setPreset('balanced'); setAnchorEl(null); }}>Balanceado (720p)</MenuItem>
                  <MenuItem onClick={() => { setPreset('high-quality'); setAnchorEl(null); }}>Alta Calidad (1080p)</MenuItem>
                </Menu>

                {/* Torch Toggle */}
                {hasTorch && (
                  <IconButton onClick={onToggleTorch} sx={{ color: torchOn ? '#ffeb3b' : 'white' }}>
                    {torchOn ? <FlashOnIcon /> : <FlashOffIcon />}
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Viewfinder Area */}
            <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
              <div id="qrTest" style={{ width: '100%', height: '100%' }} />

              {/* Scan Overlay Guide */}
              {!loading && !error && (
                <Box sx={{
                  position: 'absolute',
                  border: '2px solid rgba(255, 255, 255, 0.5)',
                  boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                  borderRadius: 2,
                  width: '70%',
                  aspectRatio: '1/1',
                  zIndex: 5,
                  pointerEvents: 'none'
                }}>
                  <Box sx={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderLeft: '4px solid #00e676', borderTop: '4px solid #00e676', borderRadius: '4px 0 0 0' }} />
                  <Box sx={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRight: '4px solid #00e676', borderTop: '4px solid #00e676', borderRadius: '0 4px 0 0' }} />
                  <Box sx={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderLeft: '4px solid #00e676', borderBottom: '4px solid #00e676', borderRadius: '0 0 0 4px' }} />
                  <Box sx={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRight: '4px solid #00e676', borderBottom: '4px solid #00e676', borderRadius: '0 0 4px 0' }} />
                </Box>
              )}

              {loading && (
                <Box sx={{ position: 'absolute', zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Skeleton variant="circular" width={60} height={60} sx={{ bgcolor: 'grey.800' }} />
                  <Typography variant="caption" sx={{ mt: 2, color: 'white' }}>Iniciando cámara...</Typography>
                </Box>
              )}

              {error && (
                <Box sx={{ position: 'absolute', zIndex: 6, p: 3 }}>
                  <Alert severity="error">
                    No se pudo acceder a la cámara. Asegúrate de dar permisos o intenta con otro dispositivo.
                  </Alert>
                </Box>
              )}
            </Box>

            {/* Bottom Controls */}
            <Box sx={{
              p: 3,
              display: 'flex',
              justifyContent: 'center',
              background: 'black',
              minHeight: 80
            }}>
              {cameras.length > 1 && (
                <Button
                  variant="outlined"
                  onClick={onSwitchCamera}
                  startIcon={<CameraswitchIcon />}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  Cambiar Cámara
                </Button>
              )}
            </Box>

          </DialogContent>
        </Dialog>
      </>
    );
  }
);

MobileQrScanner.displayName = 'MobileQrScanner';

export default MobileQrScanner;
