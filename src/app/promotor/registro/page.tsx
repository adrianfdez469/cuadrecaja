"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LoginIcon from '@mui/icons-material/Login';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import InformacionProgramaPromotor from '@/app/promotor/registro/InformacionProgramaPromotor';

export default function PromotorRegistroPage() {
  const [fullName, setFullName] = useState('');
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
      const response = await fetch('/api/promoters/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error ?? 'No se pudo enviar la solicitud.');
        return;
      }

      setStatus('success');
      setMessage(data.message ?? 'Si el correo es válido, te enviamos un enlace de activación.');
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
        py: { xs: 2, sm: 4 },
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 70% 0%, rgba(78, 205, 196, 0.12) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 10% 90%, rgba(255, 107, 53, 0.08) 0%, transparent 50%)',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 3,
          }}
        >
          <Button
            component={Link}
            href="/"
            startIcon={<HomeOutlinedIcon />}
            sx={{ color: 'rgba(255,255,255,0.85)', textTransform: 'none' }}
          >
            Volver al inicio
          </Button>
          <Button
            component={Link}
            href="/promotor/acceso"
            variant="outlined"
            startIcon={<LoginIcon />}
            sx={{
              borderColor: 'rgba(255,255,255,0.35)',
              color: 'rgba(255,255,255,0.95)',
              textTransform: 'none',
              '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            Ya soy promotor — acceder
          </Button>
        </Box>

        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 800,
            color: 'white',
            mb: 1,
            fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.5rem' },
            lineHeight: 1.2,
          }}
        >
          Programa de{' '}
          <Box component="span" sx={{ color: '#6ee7de' }}>
            promotores
          </Box>
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.78)', maxWidth: 720, mb: 4 }}>
          Gana recomendando Cuadre de Caja a otros negocios. Regístrate, obtén tu código y sigue el estado de tus
          referidos desde tu panel. Abajo tienes el formulario y toda la información que necesitas antes de
          empezar.
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={5}>
            <Card
              sx={{
                p: { xs: 2.5, sm: 3 },
                position: { md: 'sticky' },
                top: { md: 24 },
                bgcolor: 'rgba(255,255,255,0.06)',
                border: '2px solid rgba(78, 205, 196, 0.5)',
                boxShadow: `
                  0 12px 40px rgba(78, 205, 196, 0.2),
                  0 4px 24px rgba(0,0,0,0.35)
                `,
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #ff8a65 0%, #ff6b35 50%, #4ECDC4 100%)',
                    boxShadow: '0 4px 16px rgba(255, 107, 53, 0.45)',
                  }}
                >
                  <CardGiftcardIcon sx={{ color: '#1a1d29', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.96)' }}>
                    Solicitud de alta
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Te enviaremos un enlace al correo
                  </Typography>
                </Box>
              </Box>

              <Box component="form" onSubmit={onSubmit}>
                <TextField
                  label="Nombre y apellidos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  fullWidth
                  inputProps={{ minLength: 2 }}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.06)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                    '& .MuiOutlinedInput-input': { color: 'rgba(255,255,255,0.95)' },
                  }}
                />
                <TextField
                  type="email"
                  label="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.06)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                    '& .MuiOutlinedInput-input': { color: 'rgba(255,255,255,0.95)' },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  fullWidth
                  size="large"
                  sx={{
                    py: 1.25,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '1rem',
                    bgcolor: '#4ECDC4',
                    color: '#1a1d29',
                    boxShadow: '0 4px 20px rgba(78, 205, 196, 0.45)',
                    '&:hover': { bgcolor: '#45b8b0', boxShadow: '0 6px 28px rgba(78, 205, 196, 0.55)' },
                  }}
                >
                  {loading ? 'Enviando…' : 'Solicitar enlace de activación'}
                </Button>
              </Box>

              {status !== 'idle' && (
                <Alert
                  severity={status}
                  sx={{
                    mt: 2,
                    bgcolor:
                      status === 'success' ? 'rgba(78, 205, 196, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                    color: 'rgba(255,255,255,0.92)',
                    '& .MuiAlert-icon': { color: status === 'success' ? '#4ECDC4' : '#ef9a9a' },
                  }}
                >
                  {message}
                  {status === 'success' && (
                    <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.75)' }}>
                      Revisa la bandeja de entrada y spam. Cuando actives tu cuenta, podrás entrar desde{' '}
                      <Link href="/promotor/acceso" style={{ color: '#6ee7de', fontWeight: 600 }}>
                        /promotor/acceso
                      </Link>{' '}
                      con tu correo.
                    </Typography>
                  )}
                </Alert>
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card
              sx={{
                p: { xs: 2, sm: 3 },
                bgcolor: 'rgba(30, 36, 51, 0.85)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
              }}
            >
              <InformacionProgramaPromotor />
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
