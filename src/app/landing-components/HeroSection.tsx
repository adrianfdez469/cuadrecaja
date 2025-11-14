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
    PlayArrow,
    TrendingUp,
    Store,
    Speed,
} from '@mui/icons-material';

export default function HeroSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const scrollToContact = () => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <Box sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
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
                background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            },
        }}>
            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                <Grid container spacing={4} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Box sx={{ mb: 3 }}>
                            <Chip
                                label="🚀 Solución POS Completa"
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    mb: 2,
                                    backdropFilter: 'blur(10px)',
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
                            <Box component="span" sx={{ color: theme.palette.secondary.contrastText }}>
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
                            Sistema integral de POS y gestión empresarial con arquitectura multi-tenant.
                            Funcionamiento offline, roles granulares y análisis de rentabilidad avanzado.
                        </Typography>

                        <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                            <Chip
                                icon={<Store />}
                                label="Multi-Tenant"
                                variant="outlined"
                                color="secondary"
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                            />
                            <Chip
                                color="secondary"
                                icon={<Speed />}
                                label="PWA Offline"
                                variant="outlined"
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                            />
                            <Chip
                                color="secondary"
                                icon={<TrendingUp />}
                                label="CPP Automático"
                                variant="outlined"
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                            />
                        </Stack>

                        <Stack direction={isMobile ? "column" : "row"} spacing={2}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={scrollToContact}
                                sx={{
                                    bgcolor: theme.palette.secondary.main,
                                    color: 'white',
                                    px: 4,
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    '&:hover': {
                                        bgcolor: theme.palette.secondary.dark,
                                        transform: 'translateY(-2px)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Solicitar Demo Gratuita
                            </Button>

                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<PlayArrow />}
                                sx={{
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    color: 'white',
                                    px: 4,
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    '&:hover': {
                                        borderColor: 'white',
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                    },
                                }}
                            >
                                Ver Demo
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
                                    width: '300px',
                                    height: '300px',
                                    background: `radial-gradient(circle, ${theme.palette.secondary.main}20 0%, transparent 70%)`,
                                    borderRadius: '50%',
                                    animation: 'pulse 4s ease-in-out infinite',
                                },
                                '@keyframes pulse': {
                                    '0%, 100%': {
                                        transform: 'translate(-50%, -50%) scale(1)',
                                    },
                                    '50%': {
                                        transform: 'translate(-50%, -50%) scale(1.1)',
                                    },
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'relative',
                                    zIndex: 2,
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: 4,
                                    p: 4,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    maxWidth: 400,
                                    mx: 'auto',
                                }}
                            >
                                <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
                                    📊 Dashboard
                                </Typography>
                                <Typography variant="body1" color='primary.contrastText' sx={{ mb: 3, opacity: 0.9 }}>
                                    Métricas en tiempo real de tu negocio
                                </Typography>

                                <Box sx={{ textAlign: 'left' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color='primary.contrastText'>Ventas Hoy</Typography>
                                        <Typography variant="body2" color='primary.contrastText' sx={{ fontWeight: 'bold', color: theme.palette.secondary.contrastText }}>
                                            $2,450,000
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color='primary.contrastText'>Productos Vendidos</Typography>
                                        <Typography variant="body2" color='primary.contrastText' sx={{ fontWeight: 'bold', color: theme.palette.secondary.contrastText }}>
                                            127
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color='primary.contrastText'>Ganancia</Typography>
                                        <Typography variant="body2" color='primary.contrastText'sx={{ fontWeight: 'bold', color: theme.palette.secondary.contrastText }}>
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
