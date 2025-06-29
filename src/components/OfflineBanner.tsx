import React, { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  Typography,
  Button,
  Tooltip
} from '@mui/material';
import {
  WifiOff,
  Wifi,
  ExpandMore,
  ExpandLess,
  Storage,
  Schedule,
  BugReport
} from '@mui/icons-material';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { formatDate } from '@/utils/formatters';

interface OfflineBannerProps {
  showOnOnline?: boolean;
  compact?: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  showOnOnline = false, 
  compact = false 
}) => {
  const { isOnline, connectionQuality } = useNetworkStatus();
  const { 
    hasOfflineData, 
    productos, 
    categorias, 
    lastSync, 
    getStorageStats 
  } = useOfflineStorage();
  
  const [expanded, setExpanded] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  
  // Determinar si mostrar el banner
  const shouldShow = !isOnline || (showOnOnline && hasOfflineData) || forceOffline;
  
  if (!shouldShow) return null;

  const storageStats = getStorageStats();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Función para simular desconexión (solo en desarrollo)
  const toggleOfflineSimulation = () => {
    setForceOffline(!forceOffline);
    if (!forceOffline) {
      // Simular desconexión
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      window.dispatchEvent(new Event('offline'));
    } else {
      // Restaurar conexión
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      window.dispatchEvent(new Event('online'));
    }
  };

  const getSeverity = () => {
    if (forceOffline) return 'warning';
    if (!isOnline) return 'error';
    if (connectionQuality === 'poor') return 'warning';
    return 'info';
  };

  const getIcon = () => {
    if (forceOffline || !isOnline) return <WifiOff />;
    return <Wifi />;
  };

  const getTitle = () => {
    if (forceOffline) return 'Modo Offline Simulado';
    if (!isOnline) return 'Sin Conexión';
    if (connectionQuality === 'poor') return 'Conexión Lenta';
    return 'Modo Offline Disponible';
  };

  const getDescription = () => {
    if (forceOffline) return 'Simulando desconexión para pruebas';
    if (!isOnline) return 'Trabajando con datos almacenados localmente';
    if (connectionQuality === 'poor') return 'Conexión inestable detectada';
    return 'Datos disponibles para trabajo offline';
  };

  return (
    <Alert 
      severity={getSeverity()}
      icon={getIcon()}
      sx={{ 
        mb: 2,
        borderRadius: 2,
        '& .MuiAlert-message': { width: '100%' }
      }}
      action={
        <Box display="flex" alignItems="center" gap={1}>
          {/* Botón de simulación offline (solo en desarrollo) */}
          {isDevelopment && (
            <Tooltip title={forceOffline ? 'Restaurar conexión' : 'Simular desconexión'}>
              <Button
                size="small"
                variant="outlined"
                color={forceOffline ? 'success' : 'warning'}
                startIcon={<BugReport />}
                onClick={toggleOfflineSimulation}
                sx={{ minWidth: 'auto' }}
              >
                {forceOffline ? 'Conectar' : 'Offline'}
              </Button>
            </Tooltip>
          )}
          
          {!compact && hasOfflineData && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ color: 'inherit' }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      }
    >
      <Box>
        <Typography variant="subtitle2" fontWeight="bold">
          {getTitle()}
        </Typography>
        
        {!compact && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            {getDescription()}
          </Typography>
        )}

        {hasOfflineData && (
          <Box display="flex" gap={1} flexWrap="wrap" mb={expanded ? 1 : 0}>
            <Chip
              icon={<Storage />}
              label={`${productos.length} productos`}
              size="small"
              variant="outlined"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
            <Chip
              icon={<Storage />}
              label={`${categorias.length} categorías`}
              size="small"
              variant="outlined"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
            {lastSync && (
              <Chip
                icon={<Schedule />}
                label={formatDate(lastSync)}
                size="small"
                variant="outlined"
                sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
              />
            )}
          </Box>
        )}

        {!compact && (
          <Collapse in={expanded}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
              <Typography variant="caption" display="block" gutterBottom>
                <strong>Estadísticas de Almacenamiento:</strong>
              </Typography>
              <Typography variant="caption" display="block">
                • Productos: {storageStats.productos}
              </Typography>
              <Typography variant="caption" display="block">
                • Categorías: {storageStats.categorias}
              </Typography>
              <Typography variant="caption" display="block">
                • Tamaño: {(storageStats.dataSize / 1024).toFixed(1)} KB
              </Typography>
              <Typography variant="caption" display="block">
                • Uso: {storageStats.usagePercentage.toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                • Última sincronización: {storageStats.lastSync ? formatDate(storageStats.lastSync) : 'Nunca'}
              </Typography>
              <Typography variant="caption" display="block">
                • Estado: {storageStats.isStale ? '⚠️ Desactualizado' : '✅ Actualizado'}
              </Typography>
            </Box>
          </Collapse>
        )}
      </Box>
    </Alert>
  );
};

export default OfflineBanner; 