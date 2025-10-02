"use client";

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
//   useTheme,
//   useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Phone,
  Email,
//   LocationOn,
} from '@mui/icons-material';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import BenefitsSection from './components/BenefitsSection';
import PricingSection from './components/PricingSection';
import ContactSection from './components/ContactSection';
import ChatbotWidget from './components/ChatbotWidget';

export default function LandingPage() {

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
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
