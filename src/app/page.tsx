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
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* Navigation Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Logo size={40} sx={{ mr: 1.5 }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #1976d2 0%, #dc004e 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Cuadre de Caja
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={handleGoToLogin}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              px: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
              },
              transition: 'all 0.3s ease',
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
        bgcolor: 'primary.dark',
        color: 'white',
        py: 4,
        mt: 8
      }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
                Cuadre de Caja
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.9)' }}>
                Sistema integral de punto de venta y gestión empresarial con arquitectura multi-tenant.
                Diseñado para pequeñas y medianas empresas que buscan control total y crecimiento sostenible.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
                Contacto
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>+53 53334449</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>+598 97728107</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>adrianfdez469@gmail.com</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
                Funcionalidades
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.9)' }}>• POS con Funcionamiento Offline</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.9)' }}>• Gestión Multi-Tenant</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.9)' }}>• Sistema de Roles Granular</Typography>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'rgba(255,255,255,0.9)' }}>• Costo Promedio Ponderado</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>• PWA Instalable</Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.3)' }} />
          <Typography variant="body2" textAlign="center" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            © 2025 Cuadre de Caja. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </Box>
  );
}
