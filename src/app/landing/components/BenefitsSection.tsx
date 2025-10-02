"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  Avatar,
  Stack,
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
  Assessment,
  Security,
  Speed,
  CloudDone,
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
    description: 'Nunca pierdas una venta con nuestro sistema PWA que funciona sin conexión.',
    stats: 'Ventas sin interrupciones',
    color: '#2196F3',
    features: [
      'POS parcialmente offline',
      'Sincronización automática',
      'Service Workers inteligentes',
      'Detección de estado de red'
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
      'Movimientos auditados'
    ]
  },
  {
    icon: Insights,
    title: 'Roles Granulares',
    description: 'Sistema de permisos específicos por funcionalidad con auditoría completa.',
    stats: 'Seguridad empresarial',
    color: '#9C27B0',
    features: [
      'Permisos por módulo',
      'Roles personalizables',
      'Auditoría de operaciones',
      'NextAuth.js integrado'
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

export default function BenefitsSection() {
  const theme = useTheme();

  return (
    <Box sx={{ py: 10, bgcolor: 'grey.50' }}>
      <Container maxWidth="lg">
        {/* Problems We Solve */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="💡 Problemas que Resolvemos"
            sx={{
              bgcolor: theme.palette.error.main,
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
            ¿Te Identificas con Estos Problemas?
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
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
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'error.light',
                    '&:hover': {
                      borderColor: 'error.main',
                      boxShadow: theme.shadows[4],
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'error.main',
                        mt: 1,
                        mr: 1.5,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
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
              bgcolor: theme.palette.success.main,
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
            Transforma tu Negocio Hoy
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
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'divider',
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
                        sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}
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
                      color: 'text.secondary',
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
                            color: 'text.secondary'
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
            sx={{ fontWeight: 'bold', color: 'text.primary', mb: 4 }}
          >
            Perfecto para tu Tipo de Negocio
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'white' }}>
                <BusinessCenter sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Tiendas de Barrio
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Optimiza las ventas diarias, controla el inventario y mejora la atención al cliente
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'white' }}>
                <LocalOffer sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Supermercados
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestiona múltiples categorías, proveedores y controla el stock en tiempo real
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'white' }}>
                <Group sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Cadenas de Tiendas
                </Typography>
                <Typography variant="body2" color="text.secondary">
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
