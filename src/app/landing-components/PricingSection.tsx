"use client";

import React from 'react';
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
  ListItemText, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  CheckCircle,
  Star,
  Security,
  CloudSync,
  Support,
} from '@mui/icons-material';
import { Stack } from '@mui/material';


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

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Freemium',
      price: '$0',
      period: '/semana',
      expireDays: 7,
      description: 'Plan gratuito por 7 días',
      popular: false,
      color: '#2196F3',
      features: [
        '2 locales máximo',
        '1 usuario',
        'Hasta 30 productos',
        'Funcionalidades básicas',
        'Soporte por email',
        '7 días de validez'
      ],
      notIncluded: [
        'Usuarios ilimitados',
        'Productos ilimitados',
        'Soporte prioritario',
        'Capacitación incluida'
      ]
    },
    {
      name: 'Silver',
      price: billingCycle === 'monthly' ? '$20' : '$200',
      period: billingCycle === 'monthly' ? '/mes' : '/año',
      expireDays: billingCycle === 'monthly' ? 30 : 365,
      description: 'Recomendado para negocios en crecimiento',
      popular: true,
      color: '#4CAF50',
      features: [
        'Hasta 5 locales',
        'Usuarios ilimitados',
        'Hasta 500 productos',
        'Capacitación inicial',
        'Soporte prioritario',
        'Acceso completo a funcionalidades',
        'Soporte en línea y presencial',
        billingCycle === 'monthly' ? '30 días de validez' : '365 días de validez'
      ],
      notIncluded: [
        'Productos ilimitados'
      ]
    },
    {
      name: 'Premium',
      price: billingCycle === 'monthly' ? '$30' : '$300',
      period: billingCycle === 'monthly' ? '/mes' : '/año',
      expireDays: billingCycle === 'monthly' ? 30 : 365,
      description: 'Para empresas que necesitan todo',
      popular: false,
      color: '#9C27B0',
      features: [
        'Hasta 20 locales',
        'Usuarios ilimitados',
        'Productos ilimitados',
        'Capacitación inicial',
        'Soporte prioritario',
        'Reportes personalizados',
        'Integración con impresoras',
        billingCycle === 'monthly' ? '30 días de validez' : '365 días de validez'
      ],
      notIncluded: []
    }
  ];

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
                onChange={(e, value) => setBillingCycle(value)}
                aria-label="Platform"
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
          {billingCycle === 'yearly' && (<Chip
                  label="¡Ahorras 2 meses!"
                  size="medium"
                  sx={{ fontWeight: 'bold', bgcolor: 'rgba(78, 205, 196, 0.2)', color: '#6ee7de', border: '1px solid rgba(78, 205, 196, 0.4)' }}
              />
          )}
        </Box>

        <Grid container spacing={4} sx={{ mb: 8 }}>
          {plans.map((plan, index) => (
            <Grid size={{xs: 12, md: 4}} key={index}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: plan.popular ? `2px solid ${TEAL}` : '1px solid rgba(255,255,255,0.08)',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                    borderColor: plan.popular ? TEAL : 'rgba(78, 205, 196, 0.3)',
                  },
                }}
              >
                {plan.popular && (
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
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                      {plan.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 2 }}>
                      <Typography
                        variant="h3"
                        component="span"
                        sx={{ fontWeight: 'bold', color: plan.popular ? TEAL : plan.color }}
                      >
                        {plan.price}
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {plan.period}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      USD • Validez {plan.expireDays} días
                    </Typography>
                  </Box>

                  <List dense sx={{ mb: 3, flexGrow: 1 }}>
                    {plan.features.map((feature, featureIndex) => (
                      <ListItem key={featureIndex} sx={{ px: 0, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle sx={{ fontSize: 20, color: plan.popular ? TEAL : plan.color }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { color: 'rgba(255,255,255,0.85)' }
                          }}
                        />
                      </ListItem>
                    ))}

                    {plan.notIncluded.map((feature, featureIndex) => (
                      <ListItem key={`not-${featureIndex}`} sx={{ px: 0, py: 0.5, opacity: 0.6 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: '2px solid',
                              borderColor: 'rgba(255,255,255,0.25)',
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { color: 'rgba(255,255,255,0.5)' }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Button
                    variant={plan.popular ? "contained" : "outlined"}
                    size="large"
                    fullWidth
                    onClick={scrollToContact}
                    sx={{
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      bgcolor: plan.popular ? TEAL : 'transparent',
                      borderColor: TEAL,
                      color: plan.popular ? '#1a1d29' : '#6ee7de',
                      '&:hover': {
                        bgcolor: plan.popular ? '#45b8b0' : 'rgba(78, 205, 196, 0.15)',
                        borderColor: TEAL,
                        color: plan.popular ? '#1a1d29' : '#6ee7de',
                      },
                    }}
                  >
                    {plan.popular ? 'Comenzar Ahora' : 'Solicitar Demo'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

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
              <Grid size={{xs: 12, md: 4}} key={index}>
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

        {/* Guarantee */}
        {/* <Box 
          sx={{ 
            textAlign: 'center',
            bgcolor: theme.palette.success.main,
            color: 'white',
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
            🛡️ Garantía de 30 Días
          </Typography>
          <Typography variant="body1" sx={{ color: 'white' }}>
            Si no estás completamente satisfecho con Cuadre de Caja, 
            te devolvemos el 100% de tu dinero sin preguntas.
          </Typography>
        </Box> */}
      </Container>
    </Box>
  );
}
