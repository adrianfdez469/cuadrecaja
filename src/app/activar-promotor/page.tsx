"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CircularProgress, Container, Typography } from '@mui/material';

type ActivationViewState = 'loading' | 'success' | 'error';

function ActivarPromotorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ActivationViewState>('loading');
  const [message, setMessage] = useState('Estamos validando tu enlace de activación...');

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
          setMessage(`Tu código de promoción es ${data.promoter?.promoCode}. Ya puedes iniciar sesión con enlace mágico.`);
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

  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Alert severity={state === 'success' ? 'success' : 'error'} sx={{ mb: 3 }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={() => router.push('/')}>
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
