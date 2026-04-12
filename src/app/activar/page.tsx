"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Chip,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Login,
  ErrorOutline,
  AccessTime,
  Home,
} from '@mui/icons-material';

type ActivationState = 'loading' | 'activating' | 'success' | 'error_expired' | 'error_used' | 'error_invalid';

interface Credentials {
  usuario: string;
  passwordTemporal: string;
  negocio: string;
}

const TEAL = '#4ECDC4';

function CopiarCampo({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        bgcolor: 'rgba(255,255,255,0.06)',
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'monospace', fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
      <Tooltip title={copiado ? '¡Copiado!' : 'Copiar'}>
        <IconButton onClick={copiar} size="small" sx={{ color: copiado ? TEAL : 'rgba(255,255,255,0.5)' }}>
          <ContentCopy fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function ActivarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [estado, setEstado] = useState<ActivationState>('loading');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setEstado('error_invalid');
      setErrorMessage('No se encontró un enlace de activación válido.');
      return;
    }

    activarCuenta(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activarCuenta = async (token: string) => {
    setEstado('activating');
    try {
      const response = await fetch('/api/activar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setCredentials(data);
        setEstado('success');
        return;
      }

      if (response.status === 401) {
        setEstado('error_expired');
        setErrorMessage(data.error ?? 'El enlace de activación ha expirado.');
        return;
      }

      if (response.status === 409) {
        setEstado('error_used');
        setErrorMessage(data.error ?? 'Esta cuenta ya fue activada.');
        return;
      }

      setEstado('error_invalid');
      setErrorMessage(data.error ?? 'El enlace de activación no es válido.');

    } catch {
      setEstado('error_invalid');
      setErrorMessage('Error de conexión. Por favor, intenta de nuevo.');
    }
  };

  if (estado === 'loading' || estado === 'activating') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress sx={{ color: TEAL, mb: 3 }} size={56} />
        <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
          {estado === 'loading' ? 'Verificando tu enlace...' : 'Configurando tu negocio...'}
        </Typography>
        {estado === 'activating' && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1 }}>
            Estamos preparando todo para que puedas comenzar
          </Typography>
        )}
      </Box>
    );
  }

  if (estado === 'success' && credentials) {
    return (
      <>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <CheckCircle sx={{ fontSize: 64, color: TEAL, mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 1 }}>
            ¡Tu cuenta está lista!
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Negocio <strong style={{ color: TEAL }}>{credentials.negocio}</strong> creado exitosamente
          </Typography>
        </Box>

        <Card
          sx={{
            p: 3,
            bgcolor: 'rgba(78, 205, 196, 0.08)',
            border: '1px solid rgba(78, 205, 196, 0.3)',
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, mb: 2 }}>
            Tus credenciales de acceso
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <CopiarCampo label="Usuario (tu correo)" value={credentials.usuario} />
            <CopiarCampo label="Contraseña temporal" value={credentials.passwordTemporal} />
          </Box>
        </Card>

        <Alert
          severity="warning"
          icon={<AccessTime />}
          sx={{ mb: 3, bgcolor: 'rgba(255, 167, 38, 0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255, 167, 38, 0.3)' }}
        >
          Guarda estas credenciales. Se recomienda cambiar la contraseña después de tu primer inicio de sesión.
        </Alert>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 3 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, mb: 1.5 }}>
            Condiciones de tu período de prueba
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              'Período de prueba gratuita de 7 días',
              'Acceso completo a todas las funcionalidades',
              'Una tienda preconfigurada lista para usar',
              'Soporte directo con el equipo de desarrollo',
              'Pasados los 7 días podrás contratar el plan que mejor se adapte a tu negocio',
            ].map((item) => (
              <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <CheckCircle sx={{ fontSize: 18, color: TEAL, mt: 0.2, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<Login />}
          onClick={() => router.push('/login')}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            bgcolor: TEAL,
            color: '#1a1d29',
            '&:hover': { bgcolor: '#45b8b0' },
          }}
        >
          Iniciar sesión ahora
        </Button>
      </>
    );
  }

  const errorConfig: Record<string, { icon: React.ReactNode; title: string; chip?: string }> = {
    error_expired: {
      icon: <AccessTime sx={{ fontSize: 56, color: '#ffa726' }} />,
      title: 'Enlace expirado',
      chip: 'El enlace era válido por 30 minutos',
    },
    error_used: {
      icon: <CheckCircle sx={{ fontSize: 56, color: TEAL }} />,
      title: 'Cuenta ya activada',
    },
    error_invalid: {
      icon: <ErrorOutline sx={{ fontSize: 56, color: '#ef5350' }} />,
      title: 'Enlace inválido',
    },
  };

  const config = errorConfig[estado] ?? errorConfig.error_invalid;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ mb: 3 }}>{config.icon}</Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)', mb: 1 }}>
        {config.title}
      </Typography>
      {config.chip && (
        <Chip
          label={config.chip}
          size="small"
          sx={{ mb: 2, bgcolor: 'rgba(255,167,38,0.15)', color: '#ffa726', border: '1px solid rgba(255,167,38,0.3)' }}
        />
      )}
      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.65)', mb: 4, maxWidth: 400, mx: 'auto' }}>
        {errorMessage}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<Home />}
        onClick={() => router.push('/')}
        sx={{ borderColor: TEAL, color: TEAL, '&:hover': { borderColor: '#45b8b0', bgcolor: 'rgba(78,205,196,0.08)' } }}
      >
        Volver a la página principal
      </Button>
    </Box>
  );
}

export default function ActivarPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#1a1d29',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h5"
            sx={{ color: TEAL, fontWeight: 700, letterSpacing: 1 }}
          >
            Cuadre de Caja
          </Typography>
        </Box>
        <Card
          sx={{
            p: 4,
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <Suspense fallback={
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress sx={{ color: TEAL }} size={48} />
            </Box>
          }>
            <ActivarContent />
          </Suspense>
        </Card>
      </Container>
    </Box>
  );
}
