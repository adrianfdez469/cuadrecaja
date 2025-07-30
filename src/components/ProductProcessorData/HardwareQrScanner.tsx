import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import audioService from '@/utils/audioService';

type HardwareQrScannerProps = {
  qrCodeSuccessCallback: (qrData: string) => void;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  keepFocus?: boolean; // Nueva prop para controlar si mantener el foco
};

function HardwareQrScanner({ 
  qrCodeSuccessCallback, 
  style, 
  value, 
  onChange, 
  keepFocus = true // Por defecto mantiene el comportamiento original
}: HardwareQrScannerProps) {
  const [internalQrData, setInternalQrData] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Put the focus in the qr input
  useEffect(() => {
    if (inputRef.current && keepFocus) {
      inputRef.current.focus();
    }
  }, [keepFocus]);

  // Función para manejar entrada de teclado (pistola escáner)
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Las pistolas escáner envían secuencias rápidas de teclas
    // No necesitamos prevenir nada, solo dejamos que funcione naturalmente
  }

  function handleInput(event: React.FormEvent<HTMLInputElement>) {
    // Esta función captura la entrada de pistolas escáner
    const target = event.target as HTMLInputElement;
    const newValue = target.value;
    
    if (typeof value === 'string' && onChange) {
      const syntheticEvent = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      setInternalQrData(newValue);
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
        if (inputRef.current && keepFocus) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }

  return (
    <TextField
      inputRef={inputRef}
      placeholder="Pistola de escaneo"
      value={typeof value === 'string' ? value : internalQrData}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onInput={handleInput}
      variant="outlined"
      size="small"
      sx={style || { width: '100%' }}
      fullWidth={!!style?.width || !style}
      // Configuración para evitar teclado virtual pero permitir pistolas escáner
      inputMode="none" // Evita teclado virtual en móviles
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      InputProps={{
        inputProps: {
          inputMode: 'none', // Refuerza no mostrar teclado
          autoComplete: 'off',
          autoCorrect: 'off',
          autoCapitalize: 'off',
          spellCheck: false,
          // Hacer que el campo sea menos "atractivo" para entrada manual
          style: { 
            caretColor: 'transparent', // Ocultar cursor
            userSelect: 'none' // Prevenir selección de texto
          },
          'data-testid': 'hardware-scanner-input'
        }
      }}
      // Asegurar que el campo siempre esté enfocado solo si keepFocus es true
      onBlur={keepFocus ? () => {
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
