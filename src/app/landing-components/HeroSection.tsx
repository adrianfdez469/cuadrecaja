"use client";

import React from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Grid,
    useTheme,
    useMediaQuery,
    Chip,
    Stack,
    CircularProgress,
} from '@mui/material';
import {
    TrendingUp,
    Login as LoginIcon,
    Android,
    Email,
    CardGiftcard,
    AttachMoney,
    Print,
} from '@mui/icons-material';
import { useLandingNavigation } from '@/hooks/useLandingNavigation';

export default function HeroSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { navigateTo, isNavigatingTo, isNavigating } = useLandingNavigation();

    const scrollToContact = () => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleGoToLogin = () => {
        navigateTo('/login');
    };

    const handleGoToDescargar = () => {
        navigateTo('/descargar');
    };

    const handleGoToPromotor = () => {
        navigateTo('/promotor/registro');
    };

    return (
        <Box sx={{
            background: 'linear-gradient(160deg, #1a1d29 0%, #252a3a 50%, #1e2433 100%)',
            color: 'white',
            pt: 8,
            pb: 12,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(ellipse 80% 50% at 70% 20%, rgba(78, 205, 196, 0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(255, 107, 53, 0.08) 0%, transparent 50%)',
                pointerEvents: 'none',
            },
            '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                pointerEvents: 'none',
            },
        }}>
            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                <Grid container spacing={4} justifyContent="center">
                    <Grid item xs={12} md={10} lg={8}>
                        <Box sx={{ mb: 3 }}>
                            <Chip
                                label="🚀 Sistema de ventas e inventario para tu negocio"
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.95)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    fontWeight: 600,
                                }}
                            />
                        </Box>

                        <Typography
                            variant={isMobile ? "h3" : "h2"}
                            component="h1"
                            gutterBottom
                            sx={{
                                fontWeight: 'bold',
                                lineHeight: 1.2,
                                mb: 2,
                                color: 'white'
                            }}
                        >
                            Revoluciona la Gestión de tu{' '}
                            <Box component="span" sx={{ color: '#6ee7de', fontWeight: 700 }}>
                                Negocio
                            </Box>
                        </Typography>

                        <Typography
                            variant="h5"
                            sx={{
                                mb: 4,
                                opacity: 0.9,
                                fontWeight: 300,
                                lineHeight: 1.4,
                                color: 'white'
                            }}
                        >
                            Lleva las ventas, el inventario y el cierre de caja de tu negocio en un solo lugar. Cobra en varias monedas, imprime tickets y gestiona productos e inventario desde una pantalla unificada. Las ventas pueden hacerse sin conexión y se sincronizan solas cuando vuelva el internet. Te muestra al instante cuánto vendiste y cuánto ganaste.
                        </Typography>

                        <Stack direction="row" spacing={2} sx={{ mb: 4 }} flexWrap="wrap" useFlexGap>
                            <Chip
                                icon={<AttachMoney />}
                                label="Cobra en varias monedas"
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                            />
                            <Chip
                                icon={<Print />}
                                label="Tickets al cobrar"
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                            />
                            <Chip
                                icon={<TrendingUp />}
                                label="Saber si ganas o pierdes con cada producto"
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                            />
                        </Stack>

                        <Stack direction={isMobile ? "column" : "row"} spacing={2} alignItems="stretch">
                            <Button
                                variant="contained"
                                size="large"
                                disabled={isNavigating}
                                onClick={handleGoToPromotor}
                                startIcon={
                                    isNavigatingTo('/promotor/registro')
                                        ? <CircularProgress size={20} color="inherit" />
                                        : <CardGiftcard />
                                }
                                sx={{
                                    background: 'linear-gradient(135deg, #ff8a65 0%, #ff6b35 42%, #e85d04 100%)',
                                    color: '#fff',
                                    px: { xs: 2.5, sm: 3, md: 2.5 },
                                    py: { xs: 1.25, sm: 1.5 },
                                    fontSize: { xs: '0.95rem', sm: '1rem', md: '0.9rem' },
                                    fontWeight: 700,
                                    minWidth: { md: 0 },
                                    textTransform: 'none',
                                    boxShadow: '0 4px 22px rgba(255, 107, 53, 0.5)',
                                    animation: 'heroPromoGlow 3s ease-in-out infinite',
                                    '@keyframes heroPromoGlow': {
                                        '0%, 100%': { boxShadow: '0 4px 22px rgba(255, 107, 53, 0.5)' },
                                        '50%': { boxShadow: '0 8px 32px rgba(255, 160, 122, 0.75)' },
                                    },
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #ff9a75 0%, #ff7b45 42%, #f06d14 100%)',
                                        transform: 'translateY(-2px)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {isNavigatingTo('/promotor/registro') ? 'Cargando...' : 'Ser promotor — gana refiriendo'}
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<Email />}
                                onClick={scrollToContact}
                                sx={{
                                    bgcolor: '#4ECDC4',
                                    color: '#1a1d29',
                                    px: { xs: 2.5, sm: 3, md: 2.5 },
                                    py: { xs: 1.25, sm: 1.5 },
                                    fontSize: { xs: '0.95rem', sm: '1rem', md: '0.9rem' },
                                    fontWeight: 600,
                                    minWidth: { md: 0 },
                                    boxShadow: '0 4px 20px rgba(78, 205, 196, 0.35)',
                                    '&:hover': {
                                        bgcolor: '#45b8b0',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 6px 24px rgba(78, 205, 196, 0.4)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Probar gratis
                            </Button>

                            <Button
                                variant="outlined"
                                size="large"
                                disabled={isNavigating}
                                onClick={handleGoToDescargar}
                                startIcon={
                                    isNavigatingTo('/descargar')
                                        ? <CircularProgress size={20} color="inherit" />
                                        : <Android />
                                }
                                sx={{
                                    borderColor: 'rgba(255,255,255,0.7)',
                                    color: 'white',
                                    px: { xs: 2.5, sm: 3, md: 2.5 },
                                    py: { xs: 1.25, sm: 1.5 },
                                    fontSize: { xs: '0.95rem', sm: '1rem', md: '0.9rem' },
                                    fontWeight: 600,
                                    minWidth: { md: 0 },
                                    '&:hover': {
                                        borderColor: 'white',
                                        bgcolor: 'rgba(255,255,255,0.15)',
                                        transform: 'translateY(-2px)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {isNavigatingTo('/descargar') ? 'Cargando...' : 'Descargar App (Android)'}
                            </Button>

                            <Button
                                variant="outlined"
                                size="large"
                                disabled={isNavigating}
                                onClick={handleGoToLogin}
                                startIcon={
                                    isNavigatingTo('/login')
                                        ? <CircularProgress size={20} color="inherit" />
                                        : <LoginIcon />
                                }
                                sx={{
                                    borderColor: 'rgba(255,255,255,0.35)',
                                    color: 'rgba(255,255,255,0.95)',
                                    px: { xs: 2.5, sm: 3, md: 2.5 },
                                    py: { xs: 1.25, sm: 1.5 },
                                    fontSize: { xs: '0.95rem', sm: '1rem', md: '0.9rem' },
                                    fontWeight: 600,
                                    minWidth: { md: 0 },
                                    '&:hover': {
                                        borderColor: 'rgba(255,255,255,0.6)',
                                        bgcolor: 'rgba(255,255,255,0.06)',
                                        transform: 'translateY(-2px)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {isNavigatingTo('/login') ? 'Cargando...' : 'Iniciar Sesión'}
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
