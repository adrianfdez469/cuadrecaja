"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  Chip,
} from '@mui/material';
import {
  GetApp as InstallIcon,
  Close as CloseIcon,
  Smartphone,
  OfflineBolt,
  Speed,
  Security,
} from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Marcar que estamos en el cliente
    setIsClient(true);
    
    // Verificar si ya está instalado
    const checkIfInstalled = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isInstalled = isStandaloneMode || isIOSStandalone;
      
      setIsInstalled(isInstalled);
      
      return isInstalled;
    };

    checkIfInstalled();

    // Listener para el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Mostrar nuestro prompt personalizado después de un tiempo
      setTimeout(() => {
        if (!checkIfInstalled()) {
          setShowInstallPrompt(true);
        }
      }, 30000); // 30 segundos después de cargar
    };

    // Listener para cuando se instala la app
    const handleAppInstalled = () => {
      console.log('🎉 PWA instalada exitosamente');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Mostrar instrucciones manuales
      setShowInstallPrompt(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ Usuario aceptó instalar la PWA');
      } else {
        console.log('❌ Usuario rechazó instalar la PWA');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error al mostrar prompt de instalación:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // No mostrar de nuevo por 24 horas
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  // No mostrar si ya está instalado o si fue rechazado recientemente
  const dismissedTimestamp = typeof window !== 'undefined' ? localStorage.getItem('pwa-install-dismissed') : null;
  if (isInstalled || (dismissedTimestamp && Date.now() - parseInt(dismissedTimestamp) < 24 * 60 * 60 * 1000)) {
    return null;
  }

  // No renderizar nada hasta que estemos en el cliente
  if (!isClient) {
    return null;
  }

  const benefits = [
    {
      icon: <OfflineBolt color="primary" />,
      title: "Funciona Offline",
      description: "Usa el POS sin conexión a internet"
    },
    {
      icon: <Speed color="primary" />,
      title: "Carga Rápida",
      description: "Acceso instantáneo desde tu dispositivo"
    },
    {
      icon: <Smartphone color="primary" />,
      title: "Como App Nativa",
      description: "Instala en tu teléfono o computadora"
    },
    {
      icon: <Security color="primary" />,
      title: "Datos Seguros",
      description: "Información protegida localmente"
    }
  ];

  return (
    <>
      {/* Botón flotante para instalar */}
      {!isInstalled && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            startIcon={<InstallIcon />}
            onClick={handleInstallClick}
            sx={{
              borderRadius: 8,
              px: 3,
              py: 1.5,
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.6)',
              }
            }}
          >
            Instalar App
          </Button>
        </Box>
      )}

      {/* Dialog de instalación */}
      <Dialog
        open={showInstallPrompt}
        onClose={handleDismiss}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <InstallIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Instalar Cuadre de Caja
                </Typography>
                <Chip 
                  label="PWA - Funciona Offline" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
            </Box>
            <IconButton onClick={handleDismiss} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Instala la aplicación para acceder rápidamente y usar el POS incluso sin conexión a internet.
            </Typography>
          </Alert>

          <Typography variant="subtitle1" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
            Beneficios de instalar:
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
            {benefits.map((benefit, index) => (
              <Box key={index} display="flex" alignItems="center" gap={2}>
                {benefit.icon}
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {benefit.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {benefit.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {!deferredPrompt && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Instalación manual:</strong> Busca la opción &quot;Instalar aplicación&quot; o &quot;Agregar a pantalla de inicio&quot; en el menú de tu navegador.
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={handleDismiss} variant="outlined">
            Ahora no
          </Button>
          <Button 
            onClick={handleInstallClick} 
            variant="contained"
            startIcon={<InstallIcon />}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              }
            }}
          >
            {deferredPrompt ? 'Instalar Ahora' : 'Ver Instrucciones'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}; 