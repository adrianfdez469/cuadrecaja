"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Button,
  AppBar,
  Toolbar,
  Divider,
} from '@mui/material';
import {
  Phone,
  Email,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import HeroSection from './landing-components/HeroSection';
import FeaturesSection from './landing-components/FeaturesSection';
import BenefitsSection from './landing-components/BenefitsSection';
import PricingSection from './landing-components/PricingSection';
import ContactSection from './landing-components/ContactSection';
import ChatbotWidget from './landing-components/ChatbotWidget';
import Logo from '@/components/Logo';

export default function LandingPage() {
  const router = useRouter();

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#1a1d29',
      overflow: 'hidden'
    }}>
      {/* Navigation Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(26, 29, 41, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Logo size={40} variant="light" sx={{ mr: 1.5 }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: 'rgba(255,255,255,0.95)',
              }}
            >
              Cuadre de <Box component="span" sx={{ color: '#6ee7de' }}>Caja</Box>
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={handleGoToLogin}
            sx={{
              bgcolor: '#4ECDC4',
              color: '#1a1d29',
              px: { xs: 1.5, sm: 3 },
              py: { xs: 0.6, sm: 1 },
              fontSize: { xs: '0.8rem', sm: '0.9375rem' },
              fontWeight: 600,
              textTransform: 'none',
              minWidth: { xs: 0, sm: 'auto' },
              boxShadow: '0 4px 16px rgba(78, 205, 196, 0.3)',
              '&:hover': {
                bgcolor: '#45b8b0',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(78, 205, 196, 0.4)',
              },
              transition: 'all 0.3s ease',
              '& .MuiButton-startIcon': { mr: { xs: 0.5, sm: 1 } },
            }}
          >
            Iniciar Sesión
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* Benefits Section */}
      <BenefitsSection />

      {/* Pricing Section */}
      <PricingSection />

      {/* Testimonials Section */}
      {/* <TestimonialsSection /> */}

      {/* Contact Section */}
      <ContactSection />

      {/* Footer */}
      <Box sx={{
        bgcolor: '#1e2433',
        color: 'white',
        py: 4,
        mt: 8,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 'bold' }}>
                Cuadre de Caja
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                Cuadre de Caja es un sistema para llevar las ventas, el inventario y el cierre de caja de tu negocio. Sirve para un solo local o para varios; las ventas pueden hacerse sin conexión y se sincronizan solas. Te ayuda a saber cuánto vendes y cuánto ganas. Pensado para pequeños y medianos negocios.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 'bold' }}>
                Contacto
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, fontSize: 20, color: '#6ee7de' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>+53 53334449</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, fontSize: 20, color: '#6ee7de' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>+598 97728107</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, fontSize: 20, color: '#6ee7de' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>+53 54319958</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1, fontSize: 20, color: '#6ee7de' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>adrianfdez469@gmail.com</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1, fontSize: 20, color: '#6ee7de' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>olimac9010@gmail.com</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 'bold' }}>
                Funcionalidades
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Ventas sin conexión (se sincronizan al volver el internet)</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Varios locales o negocios en un solo sistema</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Cierre de caja y resumen por día o período</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Descuentos y promociones que tú configuras</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Cálculo automático de si ganas o pierdes por producto</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Productos en consignación y cuenta para el proveedor</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Análisis de variación de precios de compra</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Códigos por producto, etiquetas e impresión; escaneo con pistola o cámara</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Reportes que puedes sacar en Word o Excel</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• Control de qué hace cada usuario por tienda</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.8)' }}>• App para usar en celular o tablet</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'secondary.light',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => router.push('/descargar')}
              >
                • Descargar app para Android
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Typography variant="body2" textAlign="center" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            © 2025 Cuadre de Caja. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>

      {/* Chatbot Widget */}
      {/* <ChatbotWidget /> */}
    </Box>
  );
}
