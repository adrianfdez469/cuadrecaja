"use client";

import React from 'react';
import { Box, CircularProgress, Typography } from "@mui/material";

const Loading = () => {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "70vh",
                width: "100%",
                gap: 2,
            }}
        >
            <CircularProgress size={48} thickness={4} sx={{ color: '#1976d2' }} />
            <Typography
                variant="h6"
                sx={{
                    color: "text.secondary",
                    fontWeight: 500,
                    animation: "pulse 1.5s infinite ease-in-out",
                    "@keyframes pulse": {
                        "0%": { opacity: 0.5 },
                        "50%": { opacity: 1 },
                        "100%": { opacity: 0.5 },
                    },
                }}
            >
                Cargando...
            </Typography>
        </Box>
    );
};

export default Loading;
