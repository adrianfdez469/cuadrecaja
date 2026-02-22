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
} from '@mui/material';
import {
    TrendingUp,
    Store,
    Speed,
    Login as LoginIcon,
    Android,
    Email,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function HeroSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const router = useRouter();

    const scrollToContact = () => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleGoToLogin = () => {
        router.push('/login');
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
                <Grid container spacing={4} alignItems="center">
                    <Grid item xs={12} md={6}>
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
                            Lleva las ventas, el inventario y el cierre de caja de tu negocio en un solo lugar. Las ventas (el flujo crítico) pueden hacerse sin conexión y se sincronizan solas cuando vuelva el internet; el resto del sistema usa conexión. Te muestra al instante cuánto vendiste y cuánto ganaste.
                        </Typography>

                        <Stack direction="row" spacing={2} sx={{ mb: 4 }} flexWrap="wrap" useFlexGap>
                            <Chip
                                icon={<Store />}
                                label="Varios locales en un solo sistema"
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                            />
                            <Chip
                                icon={<Speed />}
                                label="Usa la app en el celular o tablet"
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
                                Solicitar Demo
                            </Button>

                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<Android />}
                                onClick={() => router.push('/descargar')}
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
                                Descargar App (Android)
                            </Button>

                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<LoginIcon />}
                                onClick={handleGoToLogin}
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
                                Iniciar Sesión
                            </Button>
                        </Stack>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Box
                            sx={{
                                position: 'relative',
                                textAlign: 'center',
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 320,
                                    height: 320,
                                    background: 'radial-gradient(circle, rgba(78, 205, 196, 0.12) 0%, transparent 65%)',
                                    borderRadius: '50%',
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'relative',
                                    zIndex: 2,
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    backdropFilter: 'blur(16px)',
                                    borderRadius: 3,
                                    p: 4,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    maxWidth: 400,
                                    mx: 'auto',
                                    boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                                }}
                            >
                                <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                                    📊 Dashboard
                                </Typography>
                                <Typography variant="body1" sx={{ mb: 3, color: 'rgba(255,255,255,0.7)' }}>
                                    Métricas en tiempo real de tu negocio
                                </Typography>

                                <Box sx={{ textAlign: 'left' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Ventas Hoy</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6ee7de' }}>
                                            $2,450,000
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Productos Vendidos</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6ee7de' }}>
                                            127
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Ganancia</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6ee7de' }}>

                                            $850,000
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
