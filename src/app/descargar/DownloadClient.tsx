"use client";

import React, { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Chip,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Grid,
    useTheme,
    Paper,
    Fade,
    Grow,
} from '@mui/material';
import {
    Android,
    Download,
    History,
    CheckCircle,
    NewReleases,
    BugReport,
    Star,
    ArrowBack,
    Memory,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getDeviceArchitecture, getArchitectureLabel, DeviceArchitecture } from '@/utils/deviceDetection';

interface ReleaseInfo {
    version: string;
    apks: Record<DeviceArchitecture, string>;
    changelog: Record<string, Array<{ [key: string]: string }>>;
}

interface DownloadClientProps {
    release: ReleaseInfo;
}

export default function DownloadClient({ release }: DownloadClientProps) {
    const theme = useTheme();
    const router = useRouter();
    const [detectedArch, setDetectedArch] = useState<DeviceArchitecture>('arm64-v8a');

    useEffect(() => {
        const arch = getDeviceArchitecture();
        setDetectedArch(arch);
    }, []);

    const getDownloadUrl = (fileId: string) => {
        return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    };

    const currentChangelog = release.changelog[`v${release.version}`] || [];

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            background: 'radial-gradient(circle at 10% 20%, rgba(25, 118, 210, 0.05) 0%, rgba(220, 0, 78, 0.05) 90%)',
            pb: 8
        }}>
            {/* Navbar area */}
            <Box sx={{ p: 2 }}>
                <Button
                    startIcon={<ArrowBack />}
                    onClick={() => router.push('/')}
                    sx={{ color: 'text.secondary' }}
                >
                    Volver al inicio
                </Button>
            </Box>

            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Main Download Section */}
                    <Grid item xs={12} md={7}>
                        <Grow in={true} timeout={800}>
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Android sx={{ fontSize: 48, color: theme.palette.primary.main, mr: 2 }} />
                                    <Typography variant="h3" component="h1" fontWeight="800" sx={{
                                        background: 'linear-gradient(135deg, #1976d2 0%, #dc004e 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}>
                                        Cuadre de Caja
                                    </Typography>
                                </Box>

                                <Typography variant="h5" color="text.secondary" sx={{ mb: 4, fontWeight: 300 }}>
                                    Escogiste el mejor sistema para tu negocio. Descarga la versión oficial v{release.version}.
                                </Typography>

                                <Paper elevation={0} sx={{
                                    p: 4,
                                    borderRadius: 4,
                                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(25, 118, 210, 0.1)',
                                    mb: 4,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {/* Decorative element */}
                                    <Box sx={{
                                        position: 'absolute',
                                        top: -20,
                                        right: -20,
                                        width: 100,
                                        height: 100,
                                        bgcolor: 'primary.main',
                                        opacity: 0.1,
                                        borderRadius: '50%',
                                    }} />

                                    <Stack spacing={3}>
                                        <Box>
                                            <Chip
                                                icon={<Memory />}
                                                label={`Arquitectura Detectada: ${getArchitectureLabel(detectedArch)}`}
                                                color="primary"
                                                variant="outlined"
                                                sx={{ mb: 1 }}
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                                Optimizamos la descarga según tu dispositivo actual.
                                            </Typography>
                                        </Box>

                                        <Button
                                            variant="contained"
                                            size="large"
                                            fullWidth
                                            startIcon={<Download />}
                                            href={getDownloadUrl(release.apks[detectedArch] || release.apks['arm64-v8a'] || release.apks['universal'])}
                                            sx={{
                                                py: 2,
                                                fontSize: '1.2rem',
                                                fontWeight: 'bold',
                                                borderRadius: 3,
                                                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                                boxShadow: '0 8px 16px rgba(25, 118, 210, 0.3)',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                                    transform: 'scale(1.02)',
                                                }
                                            }}
                                        >
                                            Descargar APK v{release.version}
                                        </Button>

                                        <Divider>U otras versiones</Divider>

                                        <Grid container spacing={1}>
                                            {(Object.keys(release.apks) as DeviceArchitecture[]).map((arch) => (
                                                <Grid item xs={6} sm={3} key={arch}>
                                                    <Button
                                                        variant="outlined"
                                                        fullWidth
                                                        size="small"
                                                        onClick={() => window.open(getDownloadUrl(release.apks[arch]), '_blank')}
                                                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                                    >
                                                        {arch}
                                                    </Button>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Stack>
                                </Paper>

                                {/* Info Cards */}
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Card elevation={0} sx={{ height: '100%', bgcolor: 'background.paper', border: '1px solid #f1f5f9' }}>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <CheckCircle sx={{ mr: 1, color: 'success.main' }} /> Seguro y Verificado
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Nuestras APKs son firmadas y escaneadas contra malware para garantizar tu seguridad.
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Card elevation={0} sx={{ height: '100%', bgcolor: 'background.paper', border: '1px solid #f1f5f9' }}>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Star sx={{ mr: 1, color: 'warning.main' }} /> Siempre al día
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    La aplicación incluye un sistema de notificación de actualizaciones automáticas.
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Grow>
                    </Grid>

                    {/* Changelog Section */}
                    <Grid item xs={12} md={5}>
                        <Fade in={true} timeout={1200}>
                            <Paper elevation={0} sx={{
                                p: 4,
                                borderRadius: 4,
                                height: '100%',
                                bgcolor: 'background.paper',
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                    <History sx={{ mr: 1, color: theme.palette.secondary.main }} />
                                    <Typography variant="h5" fontWeight="bold">Novedades de la versión</Typography>
                                </Box>

                                <List sx={{ flex: 1, overflowY: 'auto', maxHeight: '60vh' }}>
                                    {currentChangelog.map((item, index) => {
                                        const type = Object.keys(item)[0];
                                        const text = item[type];

                                        let icon = <CheckCircle sx={{ color: 'success.light' }} />;
                                        let label = 'Mejora';
                                        let color: "success" | "info" | "warning" = 'success';

                                        if (type === 'arreglo') {
                                            icon = <BugReport sx={{ color: 'error.light' }} />;
                                            label = 'Arreglo';
                                            color = 'warning';
                                        } else if (type === 'caracteristica') {
                                            icon = <NewReleases sx={{ color: 'primary.light' }} />;
                                            label = 'Nueva';
                                            color = 'info';
                                        }

                                        return (
                                            <React.Fragment key={index}>
                                                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                                        {icon}
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                                                <Chip label={label} size="small" color={color} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                            </Stack>
                                                        }
                                                        secondary={
                                                            <Typography variant="body2" color="text.primary">
                                                                {text}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                                {index < currentChangelog.length - 1 && <Divider component="li" sx={{ my: 1, opacity: 0.5 }} />}
                                            </React.Fragment>
                                        );
                                    })}
                                    {currentChangelog.length === 0 && (
                                        <Typography variant="body2" color="text.secondary">No hay información detallada para esta versión.</Typography>
                                    )}
                                </List>
                            </Paper>
                        </Fade>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
