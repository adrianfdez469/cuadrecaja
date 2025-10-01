'use client';

import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Warning,
  Error,
  Close,
  Payment,
  ContactSupport
} from '@mui/icons-material';
import { useAppContext } from '@/context/AppContext';
import { SubscriptionService } from '@/services/subscriptionService';

export default function SubscriptionWarning() {
  const { user } = useAppContext();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (user?.negocio?.id) {
        try {
          const status = await SubscriptionService.getSubscriptionStatus(user.negocio.id);
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Error al verificar estado de suscripción:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [user?.negocio?.id]);

  const handleRenewSubscription = () => {
    window.location.href = '/configuracion/planes';
  };

  const handleContactSupport = () => {
    window.open('mailto:soporte@cuadre-caja.com?subject=Suscripción Expirada', '_blank');
  };

  if (loading || !subscriptionStatus) {
    return null;
  }

  // Solo mostrar si hay problemas con la suscripción
  if (!subscriptionStatus.isExpired && subscriptionStatus.daysRemaining > 7) {
    return null;
  }

  const getSeverity = () => {
    if (subscriptionStatus.isSuspended) return 'error';
    if (subscriptionStatus.isExpired) return 'warning';
    if (subscriptionStatus.daysRemaining <= 3) return 'warning';
    return 'info';
  };

  const getTitle = () => {
    if (subscriptionStatus.isSuspended) return 'Cuenta Suspendida';
    if (subscriptionStatus.isExpired) return 'Suscripción Expirada';
    if (subscriptionStatus.daysRemaining <= 3) return 'Suscripción por Vencer';
    return 'Suscripción Próxima a Vencer';
  };

  const getMessage = () => {
    if (subscriptionStatus.isSuspended) {
      return 'Su cuenta ha sido suspendida automáticamente debido al vencimiento de su suscripción. Renueve para reactivar el acceso.';
    }
    
    if (subscriptionStatus.isExpired) {
      const daysExpired = Math.abs(subscriptionStatus.daysRemaining);
      return `Su suscripción expiró hace ${daysExpired} día${daysExpired !== 1 ? 's' : ''}. Está en período de gracia. Renueve para evitar la suspensión.`;
    }
    
    if (subscriptionStatus.daysRemaining <= 3) {
      return `Su suscripción vence en ${subscriptionStatus.daysRemaining} día${subscriptionStatus.daysRemaining !== 1 ? 's' : ''}. Renueve para evitar interrupciones.`;
    }
    
    return `Su suscripción vence en ${subscriptionStatus.daysRemaining} días. Considere renovar para evitar interrupciones.`;
  };

  const getIcon = () => {
    if (subscriptionStatus.isSuspended) return <Error />;
    return <Warning />;
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={getSeverity()}
        icon={getIcon()}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ color: 'inherit' }}
            >
              <Close />
            </IconButton>
          </Stack>
        }
        sx={{ mb: 1 }}
      >
        <AlertTitle>{getTitle()}</AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {getMessage()}
        </Typography>

        <Collapse in={expanded}>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={`${subscriptionStatus.daysRemaining > 0 ? 'Vence en' : 'Expiró hace'} ${Math.abs(subscriptionStatus.daysRemaining)} días`}
              color={subscriptionStatus.isSuspended ? 'error' : 'warning'}
              size="small"
              variant="outlined"
            />
            
            {subscriptionStatus.isExpired && !subscriptionStatus.isSuspended && (
              <Chip
                label={`Período de gracia: ${subscriptionStatus.gracePeriodDays} días`}
                color="info"
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Payment />}
              onClick={handleRenewSubscription}
              sx={{ minWidth: 'fit-content' }}
            >
              Renovar Ahora
            </Button>
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContactSupport />}
              onClick={handleContactSupport}
              sx={{ minWidth: 'fit-content' }}
            >
              Contactar Soporte
            </Button>
          </Stack>
        </Collapse>
      </Alert>
    </Box>
  );
}
