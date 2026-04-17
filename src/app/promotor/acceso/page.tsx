"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Card, Container, TextField, Typography } from '@mui/material';

export default function PromotorAccesoPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await fetch('/api/promoters/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error ?? 'No se pudo enviar el enlace de acceso.');
        return;
      }

      setStatus('success');
      setMessage(data.message ?? 'Si existe una cuenta activa, enviamos un enlace de acceso.');
    } catch {
      setStatus('error');
      setMessage('Error de conexión. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

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
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
            Acceso de Promotor
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Ingresa tu correo y te enviaremos un enlace mágico para entrar.
          </Typography>

          <Box component="form" onSubmit={onSubmit}>
            <TextField
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" disabled={loading} fullWidth>
              {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
            </Button>
          </Box>

          {status !== 'idle' && (
            <Alert severity={status} sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}

          <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
            ¿Aún no tienes cuenta de promotor?{' '}
            <Button component={Link} href="/promotor/registro" size="small" sx={{ fontWeight: 700 }}>
              Regístrate aquí
            </Button>
          </Typography>
        </Card>
      </Container>
    </Box>
  );
}
