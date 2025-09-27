'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Stack,
  Divider,
  Container
} from '@mui/material';
import {
  Warning,
  Block,
  ContactSupport,
  Payment
} from '@mui/icons-material';
import { useAppContext } from '@/context/AppContext';
import { SubscriptionService } from '@/services/subscriptionService';

export default function SubscriptionExpired() {
  const { user } = useAppContext();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleContactSupport = () => {
    // Abrir chat de soporte o redirigir a página de contacto
    window.open('mailto:soporte@cuadre-caja.com?subject=Suscripción Expirada', '_blank');
  };

  const handleRenewSubscription = () => {
    // Redirigir a página de renovación
    window.location.href = '/configuracion/planes';
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Cargando...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Block color="error" sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h4" color="error" gutterBottom>
                Suscripción Suspendida
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Su cuenta ha sido suspendida automáticamente
              </Typography>
            </Box>
          </Stack>

          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Acceso Restringido:</strong> Su suscripción ha expirado y su cuenta ha sido suspendida automáticamente.
            </Typography>
            <Typography variant="body2">
              Para reactivar su cuenta y recuperar el acceso completo al sistema, debe renovar su suscripción.
            </Typography>
          </Alert>

          {subscriptionStatus && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Estado de su Suscripción
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip
                  label={`Expiró hace ${Math.abs(subscriptionStatus.daysRemaining)} días`}
                  color="error"
                  icon={<Warning />}
                />
                <Chip
                  label="Cuenta Suspendida"
                  color="error"
                  variant="outlined"
                />
              </Stack>
              
              <Typography variant="body2" color="text.secondary">
                <strong>Período de Gracia:</strong> {subscriptionStatus.gracePeriodDays} días
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            ¿Qué significa esto?
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" paragraph>
              • <strong>Acceso Restringido:</strong> No puede acceder a las funcionalidades del sistema
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Usuarios Deshabilitados:</strong> Todos los usuarios de su negocio han sido deshabilitados
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Datos Preservados:</strong> Su información y datos están seguros y no se han perdido
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Reactivación Inmediata:</strong> Al renovar, recuperará acceso inmediato
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Opciones Disponibles
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Payment />}
              onClick={handleRenewSubscription}
              sx={{ flex: 1 }}
            >
              Renovar Suscripción
            </Button>
            
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<ContactSupport />}
              onClick={handleContactSupport}
              sx={{ flex: 1 }}
            >
              Contactar Soporte
            </Button>
          </Stack>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>¿Necesita ayuda?</strong> Nuestro equipo de soporte está disponible para ayudarle con el proceso de renovación y cualquier pregunta que tenga.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Información Importante
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" paragraph>
              <strong>Datos Seguros:</strong> Todos sus datos, productos, ventas e información del negocio están completamente seguros y no se han perdido.
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Reactivación Rápida:</strong> Una vez que renueve su suscripción, el acceso se restablecerá inmediatamente.
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Soporte Disponible:</strong> Si tiene problemas con el proceso de renovación, nuestro equipo está aquí para ayudarle.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <ContactSupport color="primary" />
            <Typography variant="body2" color="primary">
              Email: soporte@cuadre-caja.com | Teléfono: +1 (555) 123-4567
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
