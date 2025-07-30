import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import audioService from '@/utils/audioService';

// Función para detectar dispositivos móviles/tablets
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
};

type HardwareQrScannerProps = {
  qrCodeSuccessCallback: (qrData: string) => void;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  keepFocus?: boolean; // Nueva prop para controlar si mantener el foco
  forceKeepFocus?: boolean; // Forzar mantener foco incluso en móviles (para escáneres Bluetooth)
};

function HardwareQrScanner({ 
  qrCodeSuccessCallback, 
  style, 
  value, 
  onChange, 
  keepFocus = true, // Por defecto mantiene el comportamiento original
  forceKeepFocus // Prop para forzar el foco en móviles
}: HardwareQrScannerProps) {
  const [internalQrData, setInternalQrData] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determinar si debe mantener el foco basándose en múltiples factores
  const shouldKeepFocus = () => {
    if (!keepFocus) return false; // Si keepFocus es false, nunca mantener foco
    if (forceKeepFocus) return true; // Si se fuerza, siempre mantener foco
    return !isMobileDevice(); // Solo en dispositivos no móviles por defecto
  };

  // Put the focus in the qr input
  useEffect(() => {
    // En dispositivos móviles, no forzar el foco para evitar el teclado virtual
    if (inputRef.current && shouldKeepFocus()) {
      inputRef.current.focus();
    }
  }, [keepFocus, forceKeepFocus]);

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
        try {
          qrCodeSuccessCallback(data);
          audioService.playSuccessSound();
        } catch (error) {
          console.log(error);
          audioService.playErrorSound();
        }
        // Limpiar el campo y mantener el foco para continuar escaneando
        if (typeof value !== 'string') {
          setInternalQrData('');
        }
        // Asegurar que el foco se mantenga en el campo solo si keepFocus es true
        if (inputRef.current && shouldKeepFocus()) {
          inputRef.current.focus();
        }
      }, 100);
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
      // Propiedades para evitar el teclado virtual en móviles
      inputMode="none"
      autoComplete="off"
      InputProps={{
        readOnly: false, // Permitir entrada pero sin mostrar teclado
        inputProps: {
          inputMode: 'none', // Evita el teclado virtual
          autoComplete: 'off',
          'data-testid': 'hardware-scanner-input'
        }
      }}
      // Asegurar que el campo siempre esté enfocado solo si keepFocus es true
      onBlur={shouldKeepFocus() ? () => {
        // Pequeño delay para evitar conflictos con otros eventos
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 10);
      } : undefined}
    />
  );
}

export default HardwareQrScanner;
