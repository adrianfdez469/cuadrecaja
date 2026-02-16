"use client";

import React from 'react';
import { Box, BoxProps } from '@mui/material';

interface LogoProps extends BoxProps {
    size?: number;
    variant?: 'light' | 'dark' | 'color';
}

const Logo: React.FC<LogoProps> = ({ size = 40, variant = 'color', ...props }) => {
    const getColor = () => {
        if (variant === 'light') return '#ffffff';
        if (variant === 'dark') return '#1a202c';
        return '#1976d2';
    };

    const accentColor = variant === 'color' ? '#10b981' : getColor();

    return (
        <Box
            {...props}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                ...props.sx,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Base de la caja/sistema */}
                <path
                    d="M3 18H21V21H3V18Z"
                    fill={getColor()}
                    fillOpacity={variant === 'color' ? 0.3 : 0.6}
                />
                <path
                    d="M5 18L7 8H17L19 18H5Z"
                    stroke={getColor()}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Pantalla/Interface */}
                <rect
                    x="10"
                    y="10"
                    width="4"
                    height="3"
                    rx="0.5"
                    fill={getColor()}
                    fillOpacity={0.2}
                    stroke={getColor()}
                    strokeWidth="1"
                />

                {/* El "Check" de cuadre perfecto */}
                <path
                    d="M8 12L10 14L14 10"
                    stroke={accentColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Monedas flotando alrededor (indicando actividad) */}
                <circle cx="18" cy="6" r="1.2" fill={accentColor} />
                <circle cx="6" cy="5" r="1" fill={getColor()} fillOpacity={0.5} />
            </svg>
        </Box>
    );
};

export default Logo;
