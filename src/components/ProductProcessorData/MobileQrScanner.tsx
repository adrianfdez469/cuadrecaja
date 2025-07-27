import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, Alert, Skeleton } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { init, start, stop } from '@/lib/QrScanLibrary';
import { QrcodeErrorCallback, QrcodeSuccessCallback } from 'html5-qrcode';
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

    // Activar audio context cuando se abre el scanner
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

    // Callback de éxito personalizado con sonido
    const handleSuccess = (qrText: string, result: any) => {
      audioService.playSuccessSound();
      qrCodeSuccessCallback(qrText, result);
      handleStop();
    };

    async function handleStartScanner() {
      init('qrTest');
      setLoading(true);
      await start(
        handleSuccess,
        qrCodeErrorCallback || (() => {})
      ).catch((e) => {
        console.error(e);
        setError(true);
        audioService.playErrorSound();
      });

      setLoading(false);
    }

    function handleStop() {
      setIsOpen(false);
      setError(false);
      stop();
    }

    return (
      <>
        <Button size="large" startIcon={<QrCode2Icon />} onClick={handleOpen} variant="contained" color='info'>
          {buttonLabel}
        </Button>

        <Dialog
          open={isOpen}
          onClose={handleStop}
          fullWidth
          maxWidth="xs"
          slotProps={{
            transition: { onEntered: handleStartScanner }
          }}
        >
          <DialogTitle>Escanear QR</DialogTitle>
          <DialogContent>
            <div id="qrTest" style={{ width: '100%', minHeight: 200, marginBottom: 16 }} />
            {loading && <Skeleton variant="rectangular" width="100%" height={118} />}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Ha ocurrido un error al cargar QR scanner. Solo los dispositivos móviles son permitidos.
              </Alert>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

MobileQrScanner.displayName = 'MobileQrScanner';

export default MobileQrScanner;
