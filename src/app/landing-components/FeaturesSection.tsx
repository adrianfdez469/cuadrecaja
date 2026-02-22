"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Stack,
  Chip,
} from '@mui/material';
import {
  ShoppingCart,
  Inventory,
  Analytics,
  Security,
  Store,
  OfflineBolt,
  Receipt,
  LocalOffer,
  NotificationsActive,
  PhoneAndroid,
  CardMembership,
} from '@mui/icons-material';

const features = [
  {
    icon: ShoppingCart,
    title: 'POS Offline-First',
    description: 'Interfaz táctil optimizada con funcionamiento parcial sin conexión y sincronización automática al recuperar la red.',
    details: ['Búsqueda instantánea', 'Efectivo y transferencia', 'Ventas pendientes offline'],
    color: '#FF6B35',
  },
  {
    icon: Store,
    title: 'Arquitectura Multi-Tenant',
    description: 'Aislamiento completo entre negocios con gestión de múltiples locales, tiendas y almacenes.',
    details: ['Traspasos entre locales', 'Tiendas y almacenes', 'Cierre de caja por local'],
    color: '#4ECDC4',
  },
  {
    icon: Receipt,
    title: 'Cierre de Caja',
    description: 'Apertura y cierre de período por tienda con totales de venta, efectivo, transferencia y ganancias propias y en consignación.',
    details: ['Resumen por período', 'Totales y ganancias', 'Historial de cierres'],
    color: '#5C6BC0',
  },
  {
    icon: Inventory,
    title: 'Inventario Avanzado',
    description: 'Control de stock con Costo Promedio Ponderado automático, productos fraccionados y gestión de proveedores en consignación.',
    details: ['CPP automático', 'Productos fraccionados', 'Liquidación a proveedores'],
    color: '#45B7D1',
  },
  {
    icon: LocalOffer,
    title: 'Descuentos y Promociones',
    description: 'Reglas de descuento por porcentaje, monto fijo o código promocional. Aplicación por ticket, producto o categoría con vigencia.',
    details: ['Porcentaje, fijo o código', 'Mínimo de compra', 'Vista previa en venta'],
    color: '#26A69A',
  },
  {
    icon: Analytics,
    title: 'Reportes y Exportación',
    description: 'Dashboards en tiempo real, análisis de rentabilidad y exportación de inventario y cierres a Word y Excel.',
    details: ['Métricas en tiempo real', 'Exportación a Word y Excel', 'Análisis por categoría'],
    color: '#96CEB4',
  },
  {
    icon: Security,
    title: 'Roles y Permisos',
    description: 'Sistema de permisos por funcionalidad y por tienda. Roles personalizables (vendedor, almacenero, administrador) con trazabilidad de operaciones.',
    details: ['Permisos por módulo', 'Roles por tienda', 'Trazabilidad de operaciones'],
    color: '#FFEAA7',
  },
  {
    icon: OfflineBolt,
    title: 'PWA y App Móvil',
    description: 'Progressive Web App instalable y aplicación móvil para ventas desde celular o tablet con la misma lógica de cierre y permisos.',
    details: ['Instalable como app', 'Ventas desde móvil', 'Sincronización automática'],
    color: '#DDA0DD',
  },
];

const TEAL = '#4ECDC4';
const TEAL_LIGHT = '#6ee7de';

export default function FeaturesSection() {
  return (
    <Box sx={{ py: 10, bgcolor: '#1e2433', position: 'relative' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="✨ Funcionalidades"
            sx={{
              bgcolor: 'rgba(78, 205, 196, 0.15)',
              color: TEAL_LIGHT,
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
            Todo lo que tu Negocio Necesita
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
            Sistema integral y escalable para tu empresa. 
            Multi-tenant, múltiples locales y planes de suscripción adaptados a tu negocio.
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
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      borderColor: 'rgba(78, 205, 196, 0.25)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                    },
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
                        sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
                      >
                        {feature.title}
                      </Typography>
                    </Box>
                    
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 3, 
                        color: 'rgba(255,255,255,0.75)',
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
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
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

        {/* Más valor para tu negocio */}
        <Box sx={{ mt: 8 }}>
          <Typography 
            variant="h4" 
            component="h3" 
            textAlign="center"
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 6 }}
          >
            Más valor para tu negocio
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <PhoneAndroid sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  App móvil
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Registra ventas desde celular o tablet con la misma seguridad y cierre de caja
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <NotificationsActive sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Notificaciones
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Alertas y avisos centralizados por negocio para tu equipo
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <CardMembership sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Planes por suscripción
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Límites de locales, usuarios y productos según el plan que elijas
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Store sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Destinos de transferencia
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Configura bancos o cuentas por tienda para cobros por transferencia
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
