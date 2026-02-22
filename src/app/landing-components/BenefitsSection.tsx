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
  Store,
} from '@mui/icons-material';

const benefits = [
  {
    icon: TrendingUp,
    title: 'Varios negocios o locales en un solo sistema',
    description: 'Lleva más de un local desde una sola cuenta. Los datos de cada uno están separados y seguros; tú eliges qué ver en cada momento.',
    stats: 'Todo en un solo lugar',
    color: '#4CAF50',
    features: [
      'Varios negocios o locales en una sola cuenta',
      'Cada plan incluye un número de locales y usuarios',
      'Usuarios asignados a cada tienda o almacén',
      'Los datos de un negocio no se mezclan con los de otro'
    ]
  },
  {
    icon: AccessTime,
    title: 'Ventas sin depender del internet',
    description: 'Solo el flujo de ventas (lo más crítico) puede usarse sin conexión: cobras, se guarda la venta y cuando vuelva el internet se sincroniza sola. El resto del sistema (reportes, inventario, configuración) usa conexión.',
    stats: 'Ventas sin interrupciones',
    color: '#2196F3',
    features: [
      'Cobrar y registrar ventas sin conexión hasta que se sincronice',
      'Se sincroniza solo al volver el internet',
      'Las ventas hechas sin internet se envían después',
      'Indicador de si estás conectado o no'
    ]
  },
  {
    icon: MonetizationOn,
    title: 'Saber si ganas o pierdes',
    description: 'El sistema calcula solito el costo promedio de lo que vendes. Así ves si cada producto te deja ganancia y puedes tomar mejores decisiones. Vendes productos desagregados (por unidad, kilo o porción) y el sistema se encarga de mover las cantidades automáticamente.',
    stats: 'Cálculos automáticos',
    color: '#FF9800',
    features: [
      'Costo promedio calculado automático',
      'Se actualiza al instante',
      'Saber si ganas o pierdes con cada producto',
      'Productos por unidad, kilo o porción: el sistema mueve las cantidades'
    ]
  },
  {
    icon: Insights,
    title: 'Control de quién hace qué',
    description: 'Asigna permisos por persona y por local (vendedor, almacén, administrador). El sistema registra quién hizo cada venta o movimiento, para tener orden y confianza.',
    stats: 'Seguridad y orden',
    color: '#9C27B0',
    features: [
      'Permisos por función (ventas, inventario, reportes)',
      'Vendedor, encargado de almacén o administrador por tienda',
      'Registro de quién hizo cada operación',
      'Cada usuario puede ver solo los locales que tú elijas'
    ]
  }
];

const problemsSolved = [
  'Se cae el internet y no puedes usar tu sistema actual',
  'Tienes que calcular a mano si ganas o pierdes con cada producto',
  'Tienes varios locales y no los llevas ordenados en un solo sistema',
  'No puedes sacar reportes claros para tu contador o para revisar',
  'Vendes por unidad, por kilo o por porción y se complica llevar el control',
  'No puedes limitar qué hace cada empleado en el sistema',
  'Pasas productos de un local a otro anotando en papel o en otra planilla',
  'Los datos de un local y otro no se actualizan bien entre sí',
  'Dependes de anotar las ventas en papel',
  'Haces conteos manuales con papel o planillas',
  'Revisas o registras todo en Excel y se pierde el tiempo',
  'No puedes acceder a la información desde tu casa cuando quieras, solo con tu teléfono',
  'No puedes ver cómo van las ventas del día si estás de vacaciones con tu familia'
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
            Sabemos lo que duele en el día a día: internet que falla, no saber si ganas o pierdes, inventario desordenado, anotar en papel o depender del Excel. Cuadre de Caja te ayuda a tener todo bajo control, sin necesidad de ser experto en sistemas.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 6 }}>
            {problemsSolved.map((problem, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
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
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <BusinessCenter sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Tiendas de Barrio
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Controla las ventas del día, el inventario y atiende mejor a tus clientes
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <LocalOffer sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Cafeterías y Mercados
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Lleva ventas, productos por unidad o porción y cierre de caja sin complicarte
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Store sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Supermercados
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Varias categorías, varios proveedores y control de stock al instante
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 3, height: '100%', textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Group sx={{ fontSize: 48, color: TEAL, mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  Cadenas de Tiendas
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Varios locales en un solo sistema; cada uno con su caja e inventario
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 5, p: 3, borderRadius: 2, bgcolor: 'rgba(78, 205, 196, 0.08)', border: '1px solid rgba(78, 205, 196, 0.25)' }}>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.7, maxWidth: 720, mx: 'auto' }}>
              El sistema es adaptable a cualquier tamaño de negocio: desde un negocio pequeño de una persona que lo hace todo, hasta una cadena de tiendas con almacenes, tiendas, administradores, vendedores, almaceneros y jefes de negocio.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
