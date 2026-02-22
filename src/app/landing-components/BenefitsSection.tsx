"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  AccessTime,
  MonetizationOn,
  Insights,
  CheckCircle,
  BusinessCenter,
  Group,
  LocalOffer,
} from '@mui/icons-material';

const benefits = [
  {
    icon: TrendingUp,
    title: 'Control Total Multi-Tenant',
    description: 'Gestiona múltiples negocios con aislamiento completo y seguridad empresarial.',
    stats: 'Aislamiento 100% seguro',
    color: '#4CAF50',
    features: [
      'Arquitectura multi-tenant robusta',
      'Límites por plan de suscripción',
      'Control de usuarios por negocio',
      'Datos completamente aislados'
    ]
  },
  {
    icon: AccessTime,
    title: 'Funcionamiento Offline',
    description: 'Nunca pierdas una venta: el POS funciona sin conexión y sincroniza automáticamente al recuperar la red.',
    stats: 'Ventas sin interrupciones',
    color: '#2196F3',
    features: [
      'POS parcialmente offline',
      'Sincronización automática al reconectar',
      'Ventas pendientes en cola',
      'Indicador de estado de conexión'
    ]
  },
  {
    icon: MonetizationOn,
    title: 'CPP Automático',
    description: 'Cálculo automático de Costo Promedio Ponderado para control preciso de rentabilidad.',
    stats: 'Cálculos automáticos',
    color: '#FF9800',
    features: [
      'Costo promedio ponderado',
      'Actualización en tiempo real',
      'Análisis de rentabilidad',
      'Trazabilidad de movimientos'
    ]
  },
  {
    icon: Insights,
    title: 'Roles y Permisos',
    description: 'Permisos por funcionalidad y por tienda. Roles personalizables con trazabilidad de operaciones.',
    stats: 'Seguridad empresarial',
    color: '#9C27B0',
    features: [
      'Permisos por módulo',
      'Roles por tienda (vendedor, almacenero, admin)',
      'Trazabilidad de operaciones',
      'Control de acceso por local'
    ]
  }
];

const problemsSolved = [
  'Pérdida de ventas por falta de conexión',
  'Cálculo manual de costos promedio',
  'Falta de control multi-tenant',
  'Reportes sin exportación profesional',
  'Gestión compleja de productos fraccionados',
  'Ausencia de roles granulares',
  'Traspasos manuales entre locales',
  'Sincronización deficiente de datos'
];

const TEAL = '#4ECDC4';

export default function BenefitsSection() {
  return (
    <Box sx={{ py: 10, bgcolor: '#252a3a' }}>
      <Container maxWidth="lg">
        {/* Problems We Solve */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="💡 Problemas que Resolvemos"
            sx={{
              bgcolor: 'rgba(255, 107, 53, 0.2)',
              color: '#ffab91',
              border: '1px solid rgba(255, 107, 53, 0.4)',
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
            ¿Te Identificas con Estos Problemas?
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 700,
              mx: 'auto',
              lineHeight: 1.6,
              mb: 4
            }}
          >
            Conocemos los desafíos técnicos y operativos de los sistemas POS tradicionales. 
            Cuadre de Caja resuelve estos problemas con tecnología moderna.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 6 }}>
            {problemsSolved.map((problem, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card 
                  sx={{ 
                    p: 2, 
                    height: '100%',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255, 107, 53, 0.25)',
                    '&:hover': {
                      borderColor: 'rgba(255, 107, 53, 0.5)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#FF6B35',
                        mt: 1,
                        mr: 1.5,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                      {problem}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Benefits */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="🎯 Beneficios Reales"
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
            Transforma tu Negocio Hoy
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Resultados comprobados que impactan directamente en la rentabilidad de tu negocio
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ mb: 8 }}>
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <Grid item xs={12} sm={6} md={6} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    transition: 'all 0.3s ease',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(78, 205, 196, 0.25)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: benefit.color,
                        width: 60,
                        height: 60,
                        mr: 2,
                      }}
                    >
                      <IconComponent sx={{ fontSize: 30, color: 'white' }} />
                    </Avatar>
                    <Box>
                      <Typography 
                        variant="h5" 
                        component="h3"
                        sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 1 }}
                      >
                        {benefit.title}
                      </Typography>
                      <Chip
                        label={benefit.stats}
                        size="small"
                        sx={{
                          bgcolor: benefit.color,
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      />
                    </Box>
                  </Box>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      mb: 3, 
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.6
                    }}
                  >
                    {benefit.description}
                  </Typography>

                  <List dense>
                    {benefit.features.map((feature, featureIndex) => (
                      <ListItem key={featureIndex} sx={{ px: 0, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircle sx={{ fontSize: 20, color: benefit.color }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { color: 'rgba(255,255,255,0.7)' }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Target Audience */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            component="h3" 
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 4 }}
          >
            Perfecto para tu Tipo de Negocio
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <BusinessCenter sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Tiendas de Barrio
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Optimiza las ventas diarias, controla el inventario y mejora la atención al cliente
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <LocalOffer sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Supermercados
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Gestiona múltiples categorías, proveedores y controla el stock en tiempo real
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Group sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Cadenas de Tiendas
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Administra múltiples locales desde una plataforma centralizada
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
