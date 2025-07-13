import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';

type HardwareQrScannerProps = {
  qrCodeSuccessCallback: (qrData: string) => void;
  style?: React.CSSProperties;
  // qrCodeErrorCallback?: (error: Error) => void;
};

function HardwareQrScanner({ qrCodeSuccessCallback, style }: HardwareQrScannerProps) {
  const [qrData, setQrData] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Put the focus in the qr input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function handleQRDataChange(event: React.ChangeEvent<HTMLInputElement>) {
    setQrData(() => event.target.value);
  }

  function handleKeyUp() {
    if (timeoutRef?.current) clearTimeout(timeoutRef.current);
    if (qrData && qrData.length > 0) {
      timeoutRef.current = setTimeout(() => {
        qrCodeSuccessCallback(qrData);
        setQrData('');
      }, 500);
    }
  }

  return (
    <TextField
      inputRef={inputRef}
      placeholder="Hardware QR Scanner"
      onChange={handleQRDataChange}
      value={qrData}
      onKeyUp={handleKeyUp}
      variant="outlined"
      size="small"
      sx={style || { width: '80%' }}
      fullWidth={!!style?.width || !style}
    />
  );
}

export default HardwareQrScanner;
