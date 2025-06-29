import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Typography,
  Button,
  Collapse,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  CloudOff,
  CloudQueue,
  Sync,
  CheckCircle,
  Warning,
  Delete,
  ExpandMore,
  ExpandLess,
  ShoppingCart,
} from '@mui/icons-material';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface OfflineSyncProps {
  compact?: boolean;
  showDetails?: boolean;
}

export const OfflineSync: React.FC<OfflineSyncProps> = ({ 
  compact = false, 
  showDetails = false 
}) => {
  const { isOnline } = useNetworkStatus();
  const {
    isServiceWorkerReady,
    offlineQueue,
    syncInProgress,
    hasOfflineData,
    syncOfflineSales,
    clearOfflineData,
    stats,
  } = useServiceWorker();

  const [showDetailsPanel, setShowDetailsPanel] = React.useState(showDetails);

  // No mostrar nada si no hay datos offline y estamos online
  if (!hasOfflineData && isOnline && !syncInProgress) {
    return null;
  }

  // Versión compacta para toolbar
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Indicador de estado */}
        {syncInProgress ? (
          <Tooltip title="Sincronizando ventas offline...">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="primary">
                Sync...
              </Typography>
            </Box>
          </Tooltip>
        ) : hasOfflineData ? (
          <Tooltip title={`${stats.pendingSales} ventas pendientes de sincronizar`}>
            <Chip
              icon={<CloudQueue />}
              label={stats.pendingSales}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Tooltip>
        ) : null}

        {/* Botón de sincronización manual */}
        {hasOfflineData && isOnline && (
          <Tooltip title="Sincronizar ventas offline">
            <IconButton
              size="small"
              onClick={syncOfflineSales}
              disabled={syncInProgress || !isServiceWorkerReady}
              color="primary"
            >
              <Sync />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Versión completa
  return (
    <Box sx={{ mb: 2 }}>
      {/* Banner principal */}
      {(hasOfflineData || syncInProgress) && (
        <Alert
          severity={syncInProgress ? "info" : "warning"}
          icon={syncInProgress ? <Sync /> : <CloudOff />}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* Botón de detalles */}
              <IconButton
                size="small"
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                color="inherit"
              >
                {showDetailsPanel ? <ExpandLess /> : <ExpandMore />}
              </IconButton>

              {/* Botón de sincronización */}
              {hasOfflineData && isOnline && (
                <Button
                  size="small"
                  onClick={syncOfflineSales}
                  disabled={syncInProgress || !isServiceWorkerReady}
                  startIcon={syncInProgress ? <CircularProgress size={16} /> : <Sync />}
                  color="inherit"
                >
                  {syncInProgress ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
              )}

              {/* Botón de limpiar */}
              {hasOfflineData && (
                <Tooltip title="Limpiar datos offline">
                  <IconButton
                    size="small"
                    onClick={clearOfflineData}
                    disabled={syncInProgress}
                    color="inherit"
                  >
                    <Delete />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          }
        >
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {syncInProgress ? (
                'Sincronizando ventas offline...'
              ) : (
                `${stats.pendingSales} venta${stats.pendingSales === 1 ? '' : 's'} pendiente${stats.pendingSales === 1 ? '' : 's'} de sincronizar`
              )}
            </Typography>
            
            {!isOnline && (
              <Typography variant="caption" color="text.secondary">
                Se sincronizarán automáticamente cuando regrese la conexión
              </Typography>
            )}
            
            {stats.oldestSaleTimestamp && (
              <Typography variant="caption" color="text.secondary">
                Venta más antigua: {formatDistanceToNow(new Date(stats.oldestSaleTimestamp), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </Typography>
            )}
          </Box>
        </Alert>
      )}

      {/* Panel de detalles */}
      <Collapse in={showDetailsPanel}>
        <Card variant="outlined" sx={{ mt: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Estado de Sincronización Offline
            </Typography>

            {/* Estadísticas */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Service Worker
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isServiceWorkerReady ? (
                    <>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">Activo</Typography>
                    </>
                  ) : (
                    <>
                      <Warning color="warning" fontSize="small" />
                      <Typography variant="body2">Cargando...</Typography>
                    </>
                  )}
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Conexión
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isOnline ? (
                    <>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">Online</Typography>
                    </>
                  ) : (
                    <>
                      <CloudOff color="error" fontSize="small" />
                      <Typography variant="body2">Offline</Typography>
                    </>
                  )}
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Ventas Pendientes
                </Typography>
                <Typography variant="h6" color="primary">
                  {stats.pendingSales}
                </Typography>
              </Box>
            </Box>

            {/* Lista de ventas pendientes */}
            {offlineQueue.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Ventas en Cola de Sincronización
                </Typography>
                <List dense>
                  {offlineQueue.slice(0, 5).map((sale) => (
                    <ListItem key={sale.id} divider>
                      <ListItemIcon>
                        <ShoppingCart fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Venta #${sale.id.split('-').pop()}`}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {formatDistanceToNow(new Date(sale.timestamp), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </Typography>
                            {sale.attempts > 0 && (
                              <Typography variant="caption" color="warning.main">
                                {sale.attempts} intento{sale.attempts === 1 ? '' : 's'} fallido{sale.attempts === 1 ? '' : 's'}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                  {offlineQueue.length > 5 && (
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography variant="body2" color="text.secondary" textAlign="center">
                            ... y {offlineQueue.length - 5} más
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </>
            )}

            {/* Acciones */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              {hasOfflineData && isOnline && (
                <Button
                  variant="contained"
                  onClick={syncOfflineSales}
                  disabled={syncInProgress || !isServiceWorkerReady}
                  startIcon={syncInProgress ? <CircularProgress size={16} /> : <Sync />}
                >
                  {syncInProgress ? 'Sincronizando...' : 'Sincronizar Ahora'}
                </Button>
              )}

              {hasOfflineData && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={clearOfflineData}
                  disabled={syncInProgress}
                  startIcon={<Delete />}
                >
                  Limpiar Cola
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
}; 