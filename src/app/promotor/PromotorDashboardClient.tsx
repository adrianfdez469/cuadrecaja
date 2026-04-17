"use client";

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import ContentCopy from '@mui/icons-material/ContentCopy';
import type { IPromoterDashboardData } from '@/lib/referrals/promoterDashboard';
import { REFERRAL_STATUS } from '@/constants/referrals';

const TEAL = '#4ECDC4';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(value);
}

export default function PromotorDashboardClient({ data }: { data: IPromoterDashboardData }) {
  const [referralLandingUrl, setReferralLandingUrl] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    const code = encodeURIComponent(data.promoter.promoCode);
    setReferralLandingUrl(`${window.location.origin}/?ref=${code}`);
  }, [data.promoter.promoCode]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(data.promoter.promoCode);
    setCopied('code');
    setTimeout(() => setCopied(null), 2000);
  };

  const copyReferralLink = async () => {
    if (!referralLandingUrl) return;
    await navigator.clipboard.writeText(referralLandingUrl);
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  const statItems = [
    { label: 'Pendientes de pago', value: data.stats.capturados, color: '#90caf9' },
    { label: 'Calificados', value: data.stats.calificados, color: '#a5d6a7' },
    { label: 'Pend. liquidación', value: data.stats.pendientesLiquidacion, color: '#ffe082' },
    { label: 'Liquidados', value: data.stats.liquidados, color: TEAL },
    { label: 'Fraude', value: data.stats.rechazadosFraude, color: '#ef9a9a' },
    { label: 'Cancelados', value: data.stats.cancelados, color: '#b0bec5' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1d29', py: 4 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
              Panel de promotor
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
              {data.promoter.fullName} · {data.promoter.email}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              await fetch('/api/promoters/logout', { method: 'POST' });
              window.location.href = '/promotor/acceso';
            }}
            sx={{ borderColor: TEAL, color: TEAL }}
          >
            Cerrar sesión
          </Button>
        </Box>

        <Card sx={{ p: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.55)', mb: 1 }}>
            Tu código de promoción
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              component="code"
              sx={{
                fontFamily: 'monospace',
                fontSize: '1.35rem',
                fontWeight: 700,
                color: TEAL,
                letterSpacing: 1,
              }}
            >
              {data.promoter.promoCode}
            </Typography>
            <Tooltip title={copied === 'code' ? 'Copiado' : 'Copiar código'}>
              <IconButton onClick={copyCode} size="small" sx={{ color: TEAL }} aria-label="Copiar código de promoción">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 2.5, mb: 1 }}>
            Enlace de invitación (landing)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              component="code"
              sx={{
                fontFamily: 'monospace',
                fontSize: { xs: '0.85rem', sm: '1rem' },
                fontWeight: 600,
                color: TEAL,
                letterSpacing: 0.2,
                wordBreak: 'break-all',
                flex: 1,
                minWidth: 0,
              }}
            >
              {referralLandingUrl || '…'}
            </Typography>
            <Tooltip title={copied === 'link' ? 'Copiado' : 'Copiar enlace'}>
              <span>
                <IconButton
                  onClick={copyReferralLink}
                  size="small"
                  disabled={!referralLandingUrl}
                  sx={{ color: TEAL, flexShrink: 0 }}
                  aria-label="Copiar enlace de invitación"
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,0.45)' }}>
            Quien abra el enlace llegará a la página principal con el campo de referido rellenado al solicitar la demo.
            También puedes compartir solo el código para que lo introduzcan al darse de alta.
          </Typography>
        </Card>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statItems.map((s) => (
            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={s.label}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${s.color}44`,
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  {s.label}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Negocios referidos
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)' }}>Negocio</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)' }}>Estado</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)' }}>Alta</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)' }}>1er pago</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.6)' }}>Plan</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Desc. negocio
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Tu recompensa
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.referrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: 'rgba(255,255,255,0.5)', py: 4, textAlign: 'center' }}>
                      Aún no hay negocios registrados con tu código.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.referrals.map((r) => (
                    <TableRow
                      key={r.id}
                      sx={{
                        bgcolor:
                          r.status === REFERRAL_STATUS.rejectedFraud
                            ? 'rgba(239, 83, 80, 0.12)'
                            : 'transparent',
                        '& td': { color: 'rgba(255,255,255,0.88)', borderColor: 'rgba(255,255,255,0.08)' },
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={600}>{r.businessName}</Typography>
                        {r.status === REFERRAL_STATUS.rejectedFraud && (
                          <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
                            No aplica recompensa por detección de fraude. El negocio se creó con normalidad.
                          </Alert>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.statusLabel} size="small" variant="outlined" sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }} />
                      </TableCell>
                      <TableCell>{formatDate(r.createdAt)}</TableCell>
                      <TableCell>{formatDate(r.firstPaidAt)}</TableCell>
                      <TableCell>{r.planNombre ?? '—'}</TableCell>
                      <TableCell align="right">{formatMoney(r.discountSnapshot)}</TableCell>
                      <TableCell align="right">{formatMoney(r.rewardSnapshot)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
    </Box>
  );
}
