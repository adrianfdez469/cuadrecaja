"use client";

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

function PromotorAuthRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      window.location.replace('/promotor/acceso');
      return;
    }

    window.location.replace(`/api/promoters/magic-link/consume?token=${encodeURIComponent(token)}`);
  }, [searchParams]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1d29', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.85)' }}>
          Validando enlace de acceso...
        </Typography>
      </Container>
    </Box>
  );
}

function PromotorAuthFallback() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1d29', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.85)' }}>
          Cargando...
        </Typography>
      </Container>
    </Box>
  );
}

export default function PromotorAuthPage() {
  return (
    <Suspense fallback={<PromotorAuthFallback />}>
      <PromotorAuthRedirect />
    </Suspense>
  );
}
