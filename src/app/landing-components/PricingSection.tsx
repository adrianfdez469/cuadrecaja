"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  useTheme,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle,
  Star,
  Security,
  CloudSync,
  Support,
  
} from '@mui/icons-material';

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
    price: '$20',
    period: '/mes',
    expireDays: 30,
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
      '30 días de validez'
    ],
    notIncluded: [
      'Productos ilimitados'
    ]
  },
  {
    name: 'Premium',
    price: '$30',
    period: '/mes',
    expireDays: 30,
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
      '30 días de validez'
    ],
    notIncluded: []
  }
];

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
  const theme = useTheme();

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact-section');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{ py: 10, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="💰 Planes y Precios"
            sx={{
              bgcolor: theme.palette.primary.main,
              color: 'white',
              mb: 2,
              px: 2,
            }}
          />
          <Typography 
            variant="h3" 
            component="h2" 
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'text.primary' }}
          >
            Elige el Plan Perfecto para tu Negocio
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Planes flexibles con límites claros por suscripción. 
            Comienza gratis por 30 días y escala según tu crecimiento.
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ mb: 8 }}>
          {plans.map((plan, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  border: plan.popular ? `3px solid ${plan.color}` : '1px solid',
                  borderColor: plan.popular ? plan.color : 'divider',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: theme.shadows[12],
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
                        bgcolor: plan.color,
                        color: 'white',
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
                      sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}
                    >
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plan.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 2 }}>
                      <Typography 
                        variant="h3" 
                        component="span"
                        sx={{ fontWeight: 'bold', color: plan.color }}
                      >
                        {plan.price}
                      </Typography>
                      <Typography variant="h6" color="text.secondary">
                        {plan.period}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      USD • Validez {plan.expireDays} días
                    </Typography>
                  </Box>

                  <List dense sx={{ mb: 3, flexGrow: 1 }}>
                    {plan.features.map((feature, featureIndex) => (
                      <ListItem key={featureIndex} sx={{ px: 0, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle sx={{ fontSize: 20, color: plan.color }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            color: 'text.primary'
                          }}
                        />
                      </ListItem>
                    ))}
                    
                    {plan.notIncluded.map((feature, featureIndex) => (
                      <ListItem key={`not-${featureIndex}`} sx={{ px: 0, py: 0.5, opacity: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: '2px solid',
                              borderColor: 'text.disabled',
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            color: 'text.disabled'
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
                      bgcolor: plan.popular ? plan.color : 'transparent',
                      borderColor: plan.color,
                      color: plan.popular ? 'white' : plan.color,
                      '&:hover': {
                        bgcolor: plan.popular ? plan.color : `${plan.color}20`,
                        borderColor: plan.color,
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
            sx={{ fontWeight: 'bold', color: 'text.primary' }}
          >
            Servicios Adicionales
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
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
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                  }}
                >
                  <IconComponent sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {service.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {service.description}
                  </Typography>
                  <Chip
                    label={service.price}
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      color: 'white',
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
