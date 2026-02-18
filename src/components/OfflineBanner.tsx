import React, { useState, useEffect, useRef } from 'react';
import { Alert, Box, Typography, IconButton, Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline, lastStatusChange } = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [isClosedManually, setIsClosedManually] = useState(false);
  const lastStatusChangeRef = useRef<Date | null>(null);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpiar timeout anterior si existe
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }

    // Solo proceder si hay un cambio real en el estado de conexión
    if (lastStatusChange && lastStatusChange !== lastStatusChangeRef.current) {
      lastStatusChangeRef.current = lastStatusChange;

      // Resetear el estado de cierre manual cuando hay un cambio de estado de red
      setIsClosedManually(false);

      // Mostrar banner cuando cambia el estado de conexión
      if (!isOnline || (isOnline && wasOffline)) {
        setShowBanner(true);

        // Auto-ocultar después de 3 segundos
        autoHideTimeoutRef.current = setTimeout(() => {
          setShowBanner(false);
        }, 3000);
      } else if (isOnline && !wasOffline) {
        // Si estamos online y no estuvimos offline, ocultar banner
        setShowBanner(false);
      }
    }

    // Cleanup
    return () => {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
        autoHideTimeoutRef.current = null;
      }
    };
  }, [isOnline, wasOffline, lastStatusChange]);

  // Efecto separado para manejar el cierre manual
  useEffect(() => {
    if (isClosedManually) {
      setShowBanner(false);
      // Limpiar timeout si existe
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
        autoHideTimeoutRef.current = null;
      }
    }
  }, [isClosedManually]);

  const handleClose = () => {
    setIsClosedManually(true);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        zIndex: 1400,
        my: 1, // Margen vertical para separar del contenido
        mx: 'auto',
        maxWidth: 600, // Limitar ancho máximo
      }}
    >
      <Collapse in={showBanner}>
        <Alert
          severity={isOnline ? "success" : "warning"}
          sx={{
            borderRadius: 2,
            boxShadow: 2,
            '& .MuiAlert-message': {
              width: '100%',
              textAlign: 'center'
            }
          }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          <Typography variant="body2" fontWeight="bold">
            {isOnline
              ? "🟢 Conexión restaurada - Los datos se sincronizarán automáticamente"
              : "🔴 Modo Offline - Los datos se guardan localmente y se sincronizarán cuando haya conexión"
            }
          </Typography>
        </Alert>
      </Collapse>
    </Box>
  );
};

export default OfflineBanner; 