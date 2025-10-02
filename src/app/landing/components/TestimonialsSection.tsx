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
  Rating,
  Chip,
} from '@mui/material';
import {
  FormatQuote,
  Store,
  BusinessCenter,
  LocalGroceryStore,
} from '@mui/icons-material';

const testimonials = [
  {
    name: 'María González',
    business: 'Supermercado La Esquina',
    role: 'Propietaria',
    avatar: 'MG',
    rating: 5,
    quote: 'Desde que implementamos Cuadre de Caja, nuestras ventas aumentaron un 40%. El sistema es súper fácil de usar y nunca hemos perdido una venta por problemas técnicos.',
    results: '+40% en ventas',
    icon: LocalGroceryStore,
    color: '#4CAF50'
  },
  {
    name: 'Carlos Rodríguez',
    business: 'Cadena MiniMarket Plus',
    role: 'Gerente General',
    avatar: 'CR',
    rating: 5,
    quote: 'Tenemos 8 tiendas y antes era un caos controlar el inventario. Ahora desde mi oficina puedo ver en tiempo real qué pasa en cada local. Increíble!',
    results: '8 tiendas controladas',
    icon: Store,
    color: '#2196F3'
  },
  {
    name: 'Ana Martínez',
    business: 'Distribuidora El Mayorista',
    role: 'Administradora',
    avatar: 'AM',
    rating: 5,
    quote: 'Los reportes son espectaculares. Puedo exportar todo a Word para presentar a los socios. El ahorro de tiempo en administración es impresionante.',
    results: '70% menos tiempo en reportes',
    icon: BusinessCenter,
    color: '#FF9800'
  },
  {
    name: 'Luis Fernández',
    business: 'Tienda Don Luis',
    role: 'Propietario',
    avatar: 'LF',
    rating: 5,
    quote: 'Lo mejor es que funciona sin internet. Mi tienda está en una zona donde a veces se va la conexión, pero nunca he dejado de vender. Se sincroniza automáticamente.',
    results: '0% pérdida de ventas',
    icon: Store,
    color: '#9C27B0'
  },
  {
    name: 'Patricia Herrera',
    business: 'Supermercado Familiar',
    role: 'Gerente',
    avatar: 'PH',
    rating: 5,
    quote: 'El soporte técnico es excelente. Cualquier duda la resuelven súper rápido. La capacitación fue muy completa y todo el equipo aprendió fácilmente.',
    results: 'Soporte 5 estrellas',
    icon: LocalGroceryStore,
    color: '#E91E63'
  },
  {
    name: 'Roberto Silva',
    business: 'Almacén Central',
    role: 'Propietario',
    avatar: 'RS',
    rating: 5,
    quote: 'La función de códigos de barras es fantástica. Antes tardábamos mucho buscando productos, ahora es instantáneo. Los clientes notan la diferencia.',
    results: '80% más rápido',
    icon: BusinessCenter,
    color: '#607D8B'
  }
];

const stats = [
  { number: '500+', label: 'Negocios Activos' },
  { number: '98%', label: 'Satisfacción Cliente' },
  { number: '35%', label: 'Aumento Promedio Ventas' },
  { number: '24/7', label: 'Soporte Disponible' },
];

export default function TestimonialsSection() {
  const theme = useTheme();

  return (
    <Box sx={{ py: 10, bgcolor: 'grey.50' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="⭐ Testimonios"
            sx={{
              bgcolor: theme.palette.warning.main,
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
            Lo que Dicen Nuestros Clientes
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
            Más de 500 negocios confían en Cuadre de Caja para gestionar sus operaciones diarias
          </Typography>
        </Box>

        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 8 }}>
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: theme.palette.primary.main,
                    mb: 1 
                  }}
                >
                  {stat.number}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Testimonials */}
        <Grid container spacing={4}>
          {testimonials.map((testimonial, index) => {
            const IconComponent = testimonial.icon;
            return (
              <Grid item xs={12} md={6} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[8],
                    },
                    bgcolor: 'white',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      opacity: 0.1,
                    }}
                  >
                    <FormatQuote sx={{ fontSize: 48 }} />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: testimonial.color,
                        width: 48,
                        height: 48,
                        mr: 2,
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {testimonial.avatar}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {testimonial.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconComponent sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {testimonial.role} • {testimonial.business}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={testimonial.results}
                      size="small"
                      sx={{
                        bgcolor: testimonial.color,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem'
                      }}
                    />
                  </Box>

                  <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />

                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontStyle: 'italic',
                      color: 'text.primary',
                      lineHeight: 1.6,
                      position: 'relative',
                      zIndex: 1
                    }}
                  >
                    "{testimonial.quote}"
                  </Typography>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Call to Action */}
        <Box 
          sx={{ 
            textAlign: 'center',
            mt: 8,
            p: 4,
            bgcolor: theme.palette.primary.main,
            color: 'white',
            borderRadius: 2,
          }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
            ¿Listo para Unirte a Nuestros Clientes Satisfechos?
          </Typography>
          <Typography variant="h6" sx={{ mb: 3, color: 'rgba(255,255,255,0.9)' }}>
            Comienza tu prueba gratuita hoy y descubre por qué somos la opción #1
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="✓ 15 días gratis" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            <Chip label="✓ Sin permanencia" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            <Chip label="✓ Soporte incluido" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            <Chip label="✓ Capacitación gratis" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
