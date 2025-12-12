import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Slider,
    FormControlLabel,
    Switch,
    Divider,
    Alert
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { ScannerOptions } from '@/lib/QrScanLibrary';

interface AdvancedScannerSettingsProps {
    open: boolean;
    onClose: () => void;
    onApply: (options: ScannerOptions) => void;
    currentOptions: ScannerOptions;
}

/**
 * Advanced settings dialog for fine-tuning scanner performance
 */
export const AdvancedScannerSettings: React.FC<AdvancedScannerSettingsProps> = ({
    open,
    onClose,
    onApply,
    currentOptions
}) => {
    const [fps, setFps] = useState(currentOptions.fps || 10);
    const [width, setWidth] = useState(currentOptions.resolution?.width || 1280);
    const [height, setHeight] = useState(currentOptions.resolution?.height || 720);
    const [useCustomResolution, setUseCustomResolution] = useState(false);

    const handleApply = () => {
        const options: ScannerOptions = {
            fps,
            ...(useCustomResolution && {
                resolution: { width, height }
            })
        };
        onApply(options);
        onClose();
    };

    const handleReset = () => {
        setFps(10);
        setWidth(1280);
        setHeight(720);
        setUseCustomResolution(false);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={1}>
                    <SettingsIcon />
                    <Typography variant="h6">Configuración Avanzada del Escáner</Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Alert severity="info" sx={{ mb: 3 }}>
                    Ajusta estos valores solo si experimentas problemas de rendimiento o calidad.
                </Alert>

                {/* FPS Slider */}
                <Box mb={3}>
                    <Typography gutterBottom>
                        Frames por Segundo (FPS): <strong>{fps}</strong>
                    </Typography>
                    <Slider
                        value={fps}
                        onChange={(_, value) => setFps(value as number)}
                        min={3}
                        max={30}
                        step={1}
                        marks={[
                            { value: 5, label: '5 (Rápido)' },
                            { value: 10, label: '10 (Balanceado)' },
                            { value: 15, label: '15 (Calidad)' }
                        ]}
                        valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary">
                        Menor FPS = Mejor rendimiento en dispositivos lentos
                        <br />
                        Mayor FPS = Escaneo más rápido pero más carga de CPU
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Custom Resolution */}
                <Box mb={2}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={useCustomResolution}
                                onChange={(e) => setUseCustomResolution(e.target.checked)}
                            />
                        }
                        label="Usar resolución personalizada"
                    />
                </Box>

                {useCustomResolution && (
                    <Box mb={3}>
                        <Typography gutterBottom>
                            Ancho: <strong>{width}px</strong>
                        </Typography>
                        <Slider
                            value={width}
                            onChange={(_, value) => setWidth(value as number)}
                            min={640}
                            max={1920}
                            step={160}
                            marks={[
                                { value: 640, label: '640' },
                                { value: 1280, label: '1280' },
                                { value: 1920, label: '1920' }
                            ]}
                            valueLabelDisplay="auto"
                        />

                        <Typography gutterBottom sx={{ mt: 2 }}>
                            Alto: <strong>{height}px</strong>
                        </Typography>
                        <Slider
                            value={height}
                            onChange={(_, value) => setHeight(value as number)}
                            min={480}
                            max={1080}
                            step={120}
                            marks={[
                                { value: 480, label: '480' },
                                { value: 720, label: '720' },
                                { value: 1080, label: '1080' }
                            ]}
                            valueLabelDisplay="auto"
                        />

                        <Typography variant="caption" color="text.secondary">
                            Menor resolución = Mejor rendimiento
                            <br />
                            Mayor resolución = Mejor lectura de códigos pequeños
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Recommendations */}
                <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Recomendaciones:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem' }}>
                        <li>Para dispositivos lentos: 5 FPS, 640x480</li>
                        <li>Para la mayoría de dispositivos: 10 FPS, 1280x720</li>
                        <li>Para códigos muy pequeños: 15 FPS, 1920x1080</li>
                    </ul>
                </Alert>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleReset} color="secondary">
                    Restablecer
                </Button>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={handleApply} variant="contained" color="primary">
                    Aplicar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdvancedScannerSettings;
