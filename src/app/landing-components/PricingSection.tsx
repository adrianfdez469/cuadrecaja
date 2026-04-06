"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Star,
  Security,
  CloudSync,
  Support,
} from '@mui/icons-material';
import { Stack } from '@mui/material';
import type { IPlan } from '@/schemas/plan';
import { getPlanes } from '@/services/planService';

const COLOR_MAP: Record<string, string> = {
  info: '#2196F3',
  primary: '#1976D2',
  secondary: '#9C27B0',
  warning: '#FF9800',
  success: '#4CAF50',
  error: '#F44336',
  default: '#9E9E9E',
};

const additionalServices = [
  {
    icon: Support,
    title: 'Capacitación Personalizada',
    description: 'Entrenamos a tu equipo para aprovechar al máximo el sistema',
    price: 'Gratis con cualquiera de nuestros planes'
  },
  {
    icon: CloudSync,
    title: 'Migración de Datos',
    description: 'Transferimos tu información actual al nuevo sistema',
    price: 'Gratis con cualquiera de nuestros planes'
  },
  {
    icon: Security,
    title: 'Soporte Técnico Premium',
    description: 'Atención prioritaria 24/7 con técnico dedicado',
    price: 'Gratis con cualquiera de nuestros planes'
  }
];

const buildPlanFeatures = (plan: IPlan): string[] => {
  const fmt = (val: number) => (val === -1 ? '∞' : String(val));
  const features: string[] = [];
  features.push(`${fmt(plan.limiteLocales)} locales (tiendas/almacenes)`);
  features.push(plan.limiteUsuarios === -1 ? 'Usuarios ilimitados' : `${plan.limiteUsuarios} usuario${plan.limiteUsuarios !== 1 ? 's' : ''}`);
  features.push(plan.limiteProductos === -1 ? 'Productos ilimitados' : `Hasta ${plan.limiteProductos} productos`);
  if (plan.precio === 0) {
    features.push('Funcionalidades básicas', 'Soporte por email');
  } else if (plan.precio === -1) {
    features.push('Funcionalidades personalizadas', 'Soporte dedicado 24/7', 'Capacitación incluida');
  } else {
    features.push('Capacitación inicial', 'Acceso a todas las funcionalidades', 'Soporte en línea');
  }
  if (plan.duracion === -1) {
    features.push('Duración personalizada');
  } else {
    features.push(`Validez: ${plan.duracion} días`);
  }
  return features;
};

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [planes, setPlanes] = useState<IPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlanes()
      .then(data => setPlanes(data.filter(p => p.activo)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayPlans = planes.map(plan => ({
    plan,
    name: plan.nombre.charAt(0) + plan.nombre.slice(1).toLowerCase(),
    price: plan.precio === -1
      ? 'Cotización'
      : plan.precio === 0
        ? '$0'
        : billingCycle === 'monthly'
          ? `$${plan.precio}`
          : `$${plan.precio * 10}`,
    period: plan.precio === 0
      ? '/semana'
      : plan.precio === -1
        ? ''
        : billingCycle === 'monthly' ? '/mes' : '/año',
    validezText: plan.duracion === -1
      ? 'Duración negociable'
      : `Validez ${billingCycle === 'monthly' ? plan.duracion : 365} días`,
    color: COLOR_MAP[plan.color] ?? '#9E9E9E',
    features: buildPlanFeatures(plan),
  }));

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact-section');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const TEAL = '#4ECDC4';

  return (
    <Box sx={{ py: 10, bgcolor: '#1e2433' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="💰 Planes y Precios"
            sx={{
              bgcolor: 'rgba(78, 205, 196, 0.15)',
              color: '#6ee7de',
              border: '1px solid rgba(78, 205, 196, 0.35)',
              mb: 2,
              px: 2,
              fontWeight: 600,
            }}
          />
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
          >
            Elige el Plan Perfecto para tu Negocio
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6,
              mb: 4
            }}
          >
            Planes flexibles con límites claros por suscripción.
            Comienza gratis por 7 días y escala según tu crecimiento.
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 4 }}
          >
            <ToggleButtonGroup
              value={billingCycle}
              exclusive
              onChange={(_e, value) => value && setBillingCycle(value)}
              aria-label="Ciclo de facturación"
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(255,255,255,0.8)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  '&.Mui-selected': { bgcolor: 'rgba(78, 205, 196, 0.2)', color: '#6ee7de', borderColor: TEAL },
                },
              }}
            >
              <ToggleButton value="monthly">Mensual</ToggleButton>
              <ToggleButton value="yearly">Anual</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {billingCycle === 'yearly' && (
            <Chip
              label="¡Ahorras 2 meses!"
              size="medium"
              sx={{ fontWeight: 'bold', bgcolor: 'rgba(78, 205, 196, 0.2)', color: '#6ee7de', border: '1px solid rgba(78, 205, 196, 0.4)' }}
            />
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: TEAL }} />
          </Box>
        ) : (
          <Grid container spacing={4} sx={{ mb: 8 }}>
            {displayPlans.map(({ plan, name, price, period, validezText, color, features }) => (
              <Grid size={{ xs: 12, md: 4 }} key={plan.id}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: plan.recomendado ? `2px solid ${TEAL}` : '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                      borderColor: plan.recomendado ? TEAL : 'rgba(78, 205, 196, 0.3)',
                    },
                  }}
                >
                  {plan.recomendado && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -5,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1,
                      }}
                    >
                      <Chip
                        icon={<Star />}
                        label="MÁS POPULAR"
                        sx={{
                          bgcolor: TEAL,
                          color: '#1a1d29',
                          fontWeight: 'bold',
                          px: 2,
                        }}
                      />
                    </Box>
                  )}

                  <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                      <Typography
                        variant="h4"
                        component="h3"
                        sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 1 }}
                      >
                        {name}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                        {plan.descripcion}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 2 }}>
                        <Typography
                          variant="h3"
                          component="span"
                          sx={{ fontWeight: 'bold', color: plan.recomendado ? TEAL : color }}
                        >
                          {price}
                        </Typography>
                        {period && (
                          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {period}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {plan.moneda} • {validezText}
                      </Typography>
                    </Box>

                    <List dense sx={{ mb: 3, flexGrow: 1 }}>
                      {features.map((feature, idx) => (
                        <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircle sx={{ fontSize: 20, color: plan.recomendado ? TEAL : color }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                                {feature}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>

                    <Button
                      variant={plan.recomendado ? "contained" : "outlined"}
                      size="large"
                      fullWidth
                      onClick={scrollToContact}
                      sx={{
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        bgcolor: plan.recomendado ? TEAL : 'transparent',
                        borderColor: TEAL,
                        color: plan.recomendado ? '#1a1d29' : '#6ee7de',
                        '&:hover': {
                          bgcolor: plan.recomendado ? '#45b8b0' : 'rgba(78, 205, 196, 0.15)',
                          borderColor: TEAL,
                          color: plan.recomendado ? '#1a1d29' : '#6ee7de',
                        },
                      }}
                    >
                      {plan.recomendado ? 'Comenzar Ahora' : 'Solicitar Demo'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Additional Services */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h4"
            component="h3"
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
          >
            Servicios Adicionales
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6,
              mb: 4
            }}
          >
            Servicios profesionales para garantizar el éxito de tu implementación
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ mb: 6 }}>
          {additionalServices.map((service, index) => {
            const IconComponent = service.icon;
            return (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    textAlign: 'center',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(78, 205, 196, 0.25)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                    },
                  }}
                >
                  <IconComponent sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                    {service.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                    {service.description}
                  </Typography>
                  <Chip
                    label={service.price}
                    sx={{
                      bgcolor: 'rgba(78, 205, 196, 0.2)',
                      color: '#6ee7de',
                      border: '1px solid rgba(78, 205, 196, 0.4)',
                      fontWeight: 'bold'
                    }}
                  />
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}
