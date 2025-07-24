import React, { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, Alert, Skeleton } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { init, start, stop } from '@/lib/QrScanLibrary';
import { QrcodeErrorCallback, QrcodeSuccessCallback } from 'html5-qrcode';

type MobileQrScannerProps = {
  qrCodeSuccessCallback: QrcodeSuccessCallback;
  qrCodeErrorCallback?: QrcodeErrorCallback;
  buttonLabel?: string;
};

function MobileQrScanner({ qrCodeSuccessCallback, qrCodeErrorCallback, buttonLabel }: MobileQrScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function handleOpen() {
    setIsOpen(true);
  }

  async function handleStartScanner() {
    init('qrTest');
    setLoading(true);
    await start(
      (qrText, result) => {
        qrCodeSuccessCallback(qrText, result);
        handleStop();
      },
      qrCodeErrorCallback || (() => {})
    ).catch((e) => {
      console.error(e);
      setError(true);
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

export default MobileQrScanner;
