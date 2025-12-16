import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import FlashlightOnIcon from '@mui/icons-material/FlashlightOn';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

/**
 * Visual tips component to help users scan barcodes more effectively
 */
export const ScannerTips: React.FC = () => {
    return (
        <Box sx={{ mt: 2 }}>
            <Alert severity="info" icon={<CenterFocusStrongIcon />} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                    Consejos para mejor escaneo:
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2, fontSize: '0.875rem' }}>
                    <li>
                        <FlashlightOnIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Asegúrate de tener buena iluminación
                    </li>
                    <li>
                        <ZoomInIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Mantén el código a 10-15cm de la cámara
                    </li>
                    <li>
                        <CenterFocusStrongIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Centra el código en el rectángulo
                    </li>
                    <li>Mantén el dispositivo estable</li>
                    <li>Para códigos de barras, alinéalos horizontalmente</li>
                </Box>
            </Alert>
        </Box>
    );
};

export default ScannerTips;
