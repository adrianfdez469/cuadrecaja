import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';

type HardwareQrScannerProps = {
  qrCodeSuccessCallback: (qrData: string) => void;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function HardwareQrScanner({ qrCodeSuccessCallback, style, value, onChange }: HardwareQrScannerProps) {
  const [internalQrData, setInternalQrData] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Put the focus in the qr input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function handleQRDataChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (typeof value === 'string' && onChange) {
      onChange(event);
    } else {
      setInternalQrData(event.target.value);
    }
  }

  function handleKeyUp() {
    if (timeoutRef?.current) clearTimeout(timeoutRef.current);
    const data = typeof value === 'string' ? value : internalQrData;
    if (data && data.length > 0) {
      timeoutRef.current = setTimeout(() => {
        qrCodeSuccessCallback(data);
        if (typeof value !== 'string') setInternalQrData('');
      }, 500);
    }
  }

  return (
    <TextField

      inputRef={inputRef}
      placeholder="Pistola de escaneo"
      onChange={handleQRDataChange}
      value={typeof value === 'string' ? value : internalQrData}
      onKeyUp={handleKeyUp}
      variant="outlined"
      size="small"
      sx={style || { width: '100%' }}
      fullWidth={!!style?.width || !style}
    />
  );
}

export default HardwareQrScanner;
