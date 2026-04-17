"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CircularProgress, Container, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import Link from 'next/link';

const TEAL = '#4ECDC4';

type ActivationViewState = 'loading' | 'success' | 'error';

function ActivarPromotorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ActivationViewState>('loading');
  const [message, setMessage] = useState('Estamos validando tu enlace de activación...');
  const [promoCode, setPromoCode] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setMessage('No encontramos un token de activación válido.');
      setState('error');
      return;
    }

    const activate = async () => {
      try {
        const response = await fetch('/api/promoters/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setPromoCode(typeof data.promoter?.promoCode === 'string' ? data.promoter.promoCode : null);
          setState('success');
          return;
        }

        setMessage(data.error ?? 'No se pudo activar tu cuenta de promotor.');
        setState('error');
      } catch {
        setMessage('Ocurrió un error de conexión. Intenta nuevamente.');
        setState('error');
      }
    };

    void activate();
  }, [searchParams]);

  if (state === 'loading') {
    return (
      <Box sx={{ textAlign: 'center', py: 5 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.8)' }}>{message}</Typography>
      </Box>
    );
  }

  if (state === 'success' && promoCode) {
    return (
      <Box sx={{ py: 1 }}>
        <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            ¡Cuenta activada correctamente!
          </Typography>
          Este es tu código para compartir con negocios que quieran registrarse con tu referido.
        </Alert>

        <Box
          sx={{
            py: 2.5,
            px: 2,
            mb: 2,
            borderRadius: 2,
            bgcolor: 'rgba(78, 205, 196, 0.1)',
            border: `1px solid ${TEAL}44`,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Tu código de promoción
          </Typography>
          <Typography
            component="span"
            sx={{
              fontFamily: 'monospace',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: TEAL,
              letterSpacing: 2,
            }}
          >
            {promoCode}
          </Typography>
        </Box>

        <Alert severity="info" icon={false} sx={{ mb: 2, textAlign: 'left' }}>
          <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>
            <strong>No hace falta que lo guardes ahora.</strong> Siempre podrás verlo y copiarlo desde tu{' '}
            <strong>panel de promotor</strong> cuando entres con tu correo y el enlace mágico de acceso.
          </Typography>
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          También encontrarás ahí el enlace para invitar desde la landing y el estado de tus referidos.
        </Typography>

        <StackButtons onHome={() => router.push('/')} />
      </Box>
    );
  }

  if (state === 'success' && !promoCode) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          Cuenta activada. Ya puedes iniciar sesión con el enlace mágico desde el acceso de promotor.
        </Alert>
        <StackButtons onHome={() => router.push('/')} />
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Alert severity="error" sx={{ mb: 3 }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={() => router.push('/')}>
        Volver al inicio
      </Button>
    </Box>
  );
}

function StackButtons({ onHome }: { onHome: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'center' }}>
      <Button component={Link} href="/promotor/acceso" variant="contained" startIcon={<LoginIcon />} sx={{ textTransform: 'none' }}>
        Ir al acceso de mi panel
      </Button>
      <Button variant="outlined" onClick={onHome} sx={{ textTransform: 'none' }}>
        Volver al inicio
      </Button>
    </Box>
  );
}

export default function ActivarPromotorPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#1a1d29',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
            Activación de Promotor
          </Typography>
          <Suspense fallback={<CircularProgress />}>
            <ActivarPromotorContent />
          </Suspense>
        </Card>
      </Container>
    </Box>
  );
}
