"use client"

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Stack,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
} from '@mui/material';
import {
  Notifications,
  ExpandMore,
  ExpandLess,
  Warning,
  Info,
  Campaign,
  Message,
} from '@mui/icons-material';
import { NotificationApiService } from '@/services/notificationApiService';
import { INotificacionConEstado, NivelImportancia, TipoNotificacion } from '@/types/INotificacion';
import { useMessageContext } from '@/context/MessageContext';
import { useNotificationCheck } from '@/hooks/useNotificationCheck';
import dayjs from 'dayjs';
import { useAppContext } from '@/context/AppContext';

interface NotificationsWidgetProps {
  maxNotifications?: number;
  showBadge?: boolean;
}

export default function NotificationsWidget({ 
  maxNotifications = 3, 
  showBadge = true 
}: NotificationsWidgetProps) {
  const [notificaciones, setNotificaciones] = useState<INotificacionConEstado[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<INotificacionConEstado | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { showMessage } = useMessageContext();
  const { user } = useAppContext();
  
  // Hook para manejar verificaciones automáticas
  useNotificationCheck({ 
    negocioId: user?.negocio?.id,
    checkInterval: 10 * 1000 // 10 segundos
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await NotificationApiService.getActiveNotifications();
      setNotificaciones(data);
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleMarkAsRead = async (id: string) => {
    try {
      await NotificationApiService.markAsRead(id);
      setNotificaciones(prev => 
        prev.map(n => n.id === id ? { ...n, yaLeida: true } : n)
      );
      showMessage('Notificación marcada como leída', 'success');
    } catch (error) {
      console.error('Error al marcar como leída:', error);
      showMessage('Error al marcar como leída', 'error');
    }
  };

  const handleNotificationClick = (notification: INotificacionConEstado) => {
    setSelectedNotification(notification);
    setDialogOpen(true);
    
    // Marcar como leída automáticamente si no está leída
    if (!notification.yaLeida) {
      handleMarkAsRead(notification.id);
    }
  };

  const getTipoIcon = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'ALERTA':
        return <Warning color="error" />;
      case 'PROMOCION':
        return <Campaign color="secondary" />;
      case 'MENSAJE':
        return <Message color="primary" />;
      default:
        return <Info color="info" />;
    }
  };

  const getImportanceColor = (nivel: NivelImportancia) => {
    switch (nivel) {
      case 'CRITICA':
        return 'error';
      case 'ALTA':
        return 'warning';
      case 'MEDIA':
        return 'info';
      default:
        return 'success';
    }
  };

  const unreadCount = notificaciones.filter(n => !n.yaLeida).length;
  const displayedNotifications = notificaciones.slice(0, maxNotifications);

  if (loading) {
    return null; // No mostrar nada mientras carga
  }

  if (notificaciones.length === 0) {
    return null; // No mostrar el widget si no hay notificaciones
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Badge badgeContent={showBadge ? unreadCount : 0} color="error">
                <Notifications color="primary" />
              </Badge>
              <Typography variant="h6" component="h2">
                Notificaciones
              </Typography>
              {unreadCount > 0 && (
                <Chip 
                  label={`${unreadCount} nueva${unreadCount !== 1 ? 's' : ''}`} 
                  color="error" 
                  size="small" 
                />
              )}
            </Stack>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Stack>

          <Collapse in={expanded}>
            <List sx={{ p: 0 }}>
              {displayedNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem 
                    sx={{ 
                      p: 1, 
                      cursor: 'pointer',
                      backgroundColor: notification.yaLeida ? 'transparent' : 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getTipoIcon(notification.tipo)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography 
                            variant="body2" 
                            fontWeight={notification.yaLeida ? 'normal' : 'medium'}
                            sx={{ 
                              textDecoration: notification.yaLeida ? 'none' : 'none',
                              color: notification.yaLeida ? 'text.secondary' : 'text.primary'
                            }}
                          >
                            {notification.titulo}
                          </Typography>
                          <Chip
                            label={notification.nivelImportancia}
                            color={getImportanceColor(notification.nivelImportancia)}
                            size="small"
                          />
                          {!notification.yaLeida && (
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'error.main'
                              }}
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(notification.createdAt).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {index < displayedNotifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            
            {notificaciones.length > maxNotifications && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <Button
                  size="small"
                  onClick={() => setExpanded(false)}
                  variant="text"
                >
                  Ver todas ({notificaciones.length})
                </Button>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Dialog para mostrar detalles de la notificación */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {selectedNotification && getTipoIcon(selectedNotification.tipo)}
            <Typography variant="h6">
              {selectedNotification?.titulo}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedNotification && (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  label={selectedNotification.tipo}
                  color="primary"
                  size="small"
                />
                <Chip
                  label={selectedNotification.nivelImportancia}
                  color={getImportanceColor(selectedNotification.nivelImportancia)}
                  size="small"
                />
              </Stack>
              
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedNotification.descripcion}
              </Typography>
              
              <Typography variant="caption" color="text.secondary">
                <strong>Vigente desde:</strong> {dayjs(selectedNotification.fechaInicio).format('DD/MM/YYYY HH:mm')}
              </Typography>
              <br />
              <Typography variant="caption" color="text.secondary">
                <strong>Vigente hasta:</strong> {dayjs(selectedNotification.fechaFin).format('DD/MM/YYYY HH:mm')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
