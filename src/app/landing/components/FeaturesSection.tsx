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
} from '@mui/material';
import {
  ShoppingCart,
  Inventory,
  Analytics,
  Security,
  CloudSync,
  Store,
  Speed,
  MobileFriendly,
  OfflineBolt,
  AutoAwesome,
  BusinessCenter,
  Assignment,
  LocalOffer,
  TrendingUp,
  Group,
  AccountBalance,
} from '@mui/icons-material';

const features = [
  {
    icon: ShoppingCart,
    title: 'POS Offline-First',
    description: 'Interfaz táctil optimizada con funcionamiento parcial sin conexión y sincronización automática.',
    details: ['Búsqueda instantánea', 'Métodos de pago mixtos', 'Ventas pendientes offline'],
    color: '#FF6B35',
  },
  {
    icon: Store,
    title: 'Arquitectura Multi-Tenant',
    description: 'Aislamiento completo entre negocios con gestión de múltiples locales independientes.',
    details: ['Traspasos entre locales', 'Tiendas y almacenes', 'Control centralizado'],
    color: '#4ECDC4',
  },
  {
    icon: Inventory,
    title: 'Inventario Avanzado',
    description: 'Control de stock con Costo Promedio Ponderado automático y productos fraccionados.',
    details: ['CPP automático', 'Productos fraccionados', 'Consignación de proveedores'],
    color: '#45B7D1',
  },
  {
    icon: Analytics,
    title: 'Reportes Empresariales',
    description: 'Dashboards en tiempo real con exportación a Word y análisis de rentabilidad.',
    details: ['Métricas en tiempo real', 'Exportación a Word', 'Análisis por categoría'],
    color: '#96CEB4',
  },
  {
    icon: Security,
    title: 'Roles Granulares',
    description: 'Sistema de permisos específicos por funcionalidad con auditoría completa.',
    details: ['Permisos por módulo', 'Auditoría de cambios', 'NextAuth.js seguro'],
    color: '#FFEAA7',
  },
  {
    icon: OfflineBolt,
    title: 'PWA Instalable',
    description: 'Progressive Web App con Service Workers para experiencia nativa.',
    details: ['Instalable como app', 'Cache inteligente', 'Detección de red'],
    color: '#DDA0DD',
  },
];

export default function FeaturesSection() {
  const theme = useTheme();

  return (
    <Box sx={{ py: 10, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="✨ Funcionalidades"
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
            Todo lo que tu Negocio Necesita
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
            Sistema integral con Next.js 15, PostgreSQL y Prisma ORM. 
            Arquitectura multi-tenant robusta y escalable para empresas modernas.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme.shadows[10],
                    },
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: feature.color,
                          width: 56,
                          height: 56,
                          mr: 2,
                        }}
                      >
                        <IconComponent sx={{ fontSize: 28, color: 'white' }} />
                      </Avatar>
                      <Typography 
                        variant="h6" 
                        component="h3"
                        sx={{ fontWeight: 'bold', color: 'text.primary' }}
                      >
                        {feature.title}
                      </Typography>
                    </Box>
                    
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 3, 
                        color: 'text.secondary',
                        lineHeight: 1.6,
                        flexGrow: 1
                      }}
                    >
                      {feature.description}
                    </Typography>

                    <Stack spacing={1}>
                      {feature.details.map((detail, detailIndex) => (
                        <Box key={detailIndex} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: feature.color,
                              mr: 1.5,
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {detail}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Additional Features Grid */}
        <Box sx={{ mt: 8 }}>
          <Typography 
            variant="h4" 
            component="h3" 
            textAlign="center"
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'text.primary', mb: 6 }}
          >
            Características Técnicas Avanzadas
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <MobileFriendly sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Next.js 15
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  App Router con TypeScript y React 19 para máximo rendimiento
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <CloudSync sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  PostgreSQL
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Base de datos robusta con Prisma ORM para escalabilidad
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <AutoAwesome sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Material-UI v6
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interfaz moderna con componentes optimizados y temas personalizables
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Speed sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Docker Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deployment simplificado con Docker Compose y variables de entorno
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
