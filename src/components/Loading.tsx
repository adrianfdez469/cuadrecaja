"use client";

import React from 'react';
import { Box, Typography, keyframes } from "@mui/material";
import Logo from './Logo';

// Animación de pulso suave para el contenedor del logo
const pulse = keyframes`
  0% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(25, 118, 210, 0)); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 20px rgba(25, 118, 210, 0.3)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(25, 118, 210, 0)); }
`;

// Animación de entrada para el texto
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Loading = () => {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "75vh",
                width: "100%",
                background: "transparent",
            }}
        >
            {/* Contenedor del Logo con Animación */}
            <Box
                sx={{
                    position: 'relative',
                    mb: 5,
                    animation: `${pulse} 2.5s infinite ease-in-out`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <Logo size={120} />

                {/* Elemento de carga circular sutil alrededor */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -10,
                        left: -10,
                        right: -10,
                        bottom: -10,
                        border: '2px solid rgba(25, 118, 210, 0.1)',
                        borderRadius: '50%',
                        borderTopColor: '#1976d2',
                        animation: 'spin 2s linear infinite'
                    }}
                />
            </Box>

            <Box sx={{
                textAlign: 'center',
                animation: `${fadeInUp} 0.8s ease-out forwards`
            }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, #1a202c 0%, #1976d2 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.5px',
                        mb: 1,
                        textTransform: 'uppercase'
                    }}
                >
                    Cuadre de Caja
                </Typography>

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1.5,
                    opacity: 0.7
                }}>
                    <Typography
                        variant="overline"
                        sx={{
                            color: "text.primary",
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            letterSpacing: '3px',
                            animation: 'pulseText 1.5s infinite ease-in-out'
                        }}
                    >
                        Gestionando tu Negocio
                    </Typography>
                </Box>
            </Box>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulseText {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            `}</style>
        </Box>
    );
};

export default Loading;
