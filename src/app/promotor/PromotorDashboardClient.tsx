"use client";

import { useEffect, useRef, useState } from 'react';
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
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import Check from '@mui/icons-material/Check';
import ContentCopy from '@mui/icons-material/ContentCopy';
import WhatsApp from '@mui/icons-material/WhatsApp';
import Facebook from '@mui/icons-material/Facebook';
import Instagram from '@mui/icons-material/Instagram';
import type { IPromoterDashboardData } from '@/lib/referrals/promoterDashboard';
import { REFERRAL_STATUS } from '@/constants/referrals';

const TEAL = '#4ECDC4';
const COPY_OK = '#81c784';
const COPY_FEEDBACK_MS = 2200;

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
  const [socialHint, setSocialHint] = useState<'instagram' | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const code = encodeURIComponent(data.promoter.promoCode);
    setReferralLandingUrl(`${window.location.origin}/?ref=${code}`);
  }, [data.promoter.promoCode]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const scheduleCopyReset = () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => {
      setCopied(null);
      setSocialHint(null);
      copyResetRef.current = null;
    }, COPY_FEEDBACK_MS);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(data.promoter.promoCode);
    setCopied('code');
    scheduleCopyReset();
  };

  const copyReferralLink = async () => {
    if (!referralLandingUrl) return;
    await navigator.clipboard.writeText(referralLandingUrl);
    setCopied('link');
    scheduleCopyReset();
  };

  const shareText = 'Te comparto Cuadre de Caja, un sistema simple para ventas e inventario de tu negocio.';
  const shareFullText = `${shareText} ${referralLandingUrl}`;
  const encodedLink = encodeURIComponent(referralLandingUrl);
  const encodedShareText = encodeURIComponent(shareFullText);
  const encodedQuote = encodeURIComponent(shareText);

  const handleShareWhatsapp = () => {
    if (!referralLandingUrl) return;
    window.open(`https://wa.me/?text=${encodedShareText}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareFacebook = () => {
    if (!referralLandingUrl) return;
    // Facebook no siempre respeta "quote" en todos los contextos, pero es el soporte web disponible.
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}&quote=${encodedQuote}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleShareInstagram = async () => {
    if (!referralLandingUrl) return;
    // Instagram web no permite prellenar texto/link directamente; copiamos mensaje + link y abrimos Instagram.
    await navigator.clipboard.writeText(shareFullText);
    setSocialHint('instagram');
    scheduleCopyReset();
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
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
            <Tooltip title={copied === 'code' ? 'Copiado al portapapeles' : 'Copiar código'}>
              <IconButton
                onClick={copyCode}
                size="small"
                sx={{
                  color: copied === 'code' ? COPY_OK : TEAL,
                  bgcolor: copied === 'code' ? 'rgba(129, 199, 132, 0.15)' : 'transparent',
                  transition: 'color 0.2s ease, background-color 0.2s ease',
                  '&:hover': { bgcolor: copied === 'code' ? 'rgba(129, 199, 132, 0.22)' : 'rgba(78, 205, 196, 0.12)' },
                }}
                aria-label={copied === 'code' ? 'Código copiado' : 'Copiar código de promoción'}
              >
                {copied === 'code' ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Tooltip>
            {copied === 'code' && (
              <Typography component="span" variant="caption" sx={{ color: COPY_OK, fontWeight: 600 }}>
                Copiado
              </Typography>
            )}
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
            <Tooltip title={copied === 'link' ? 'Copiado al portapapeles' : 'Copiar enlace'}>
              <span>
                <IconButton
                  onClick={copyReferralLink}
                  size="small"
                  disabled={!referralLandingUrl}
                  sx={{
                    color: copied === 'link' ? COPY_OK : TEAL,
                    flexShrink: 0,
                    bgcolor: copied === 'link' ? 'rgba(129, 199, 132, 0.15)' : 'transparent',
                    transition: 'color 0.2s ease, background-color 0.2s ease',
                    '&:hover': { bgcolor: copied === 'link' ? 'rgba(129, 199, 132, 0.22)' : 'rgba(78, 205, 196, 0.12)' },
                  }}
                  aria-label={copied === 'link' ? 'Enlace copiado' : 'Copiar enlace de invitación'}
                >
                  {copied === 'link' ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Compartir por WhatsApp">
              <span>
                <IconButton
                  onClick={handleShareWhatsapp}
                  size="small"
                  disabled={!referralLandingUrl}
                  sx={{
                    color: '#66bb6a',
                    flexShrink: 0,
                    bgcolor: 'transparent',
                    transition: 'background-color 0.2s ease',
                    '&:hover': { bgcolor: 'rgba(102, 187, 106, 0.15)' },
                  }}
                  aria-label="Compartir enlace por WhatsApp"
                >
                  <WhatsApp fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Compartir por Facebook">
              <span>
                <IconButton
                  onClick={handleShareFacebook}
                  size="small"
                  disabled={!referralLandingUrl}
                  sx={{
                    color: '#42a5f5',
                    flexShrink: 0,
                    bgcolor: 'transparent',
                    transition: 'background-color 0.2s ease',
                    '&:hover': { bgcolor: 'rgba(66, 165, 245, 0.15)' },
                  }}
                  aria-label="Compartir enlace por Facebook"
                >
                  <Facebook fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Compartir por Instagram (copia mensaje + link)">
              <span>
                <IconButton
                  onClick={handleShareInstagram}
                  size="small"
                  disabled={!referralLandingUrl}
                  sx={{
                    color: '#e1306c',
                    flexShrink: 0,
                    bgcolor: 'transparent',
                    transition: 'background-color 0.2s ease',
                    '&:hover': { bgcolor: 'rgba(225, 48, 108, 0.15)' },
                  }}
                  aria-label="Compartir enlace por Instagram"
                >
                  <Instagram fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {copied === 'link' && (
              <Typography component="span" variant="caption" sx={{ color: COPY_OK, fontWeight: 600 }}>
                Copiado
              </Typography>
            )}
            {socialHint === 'instagram' && (
              <Typography component="span" variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                Texto copiado para Instagram
              </Typography>
            )}
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
          <Box sx={{ display: { xs: 'block', sm: 'none' }, p: 2 }}>
            {data.referrals.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', py: 2, textAlign: 'center' }}>
                Aún no hay negocios registrados con tu código.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.referrals.map((r) => (
                  <Paper
                    key={r.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor:
                        r.status === REFERRAL_STATUS.rejectedFraud
                          ? 'rgba(239, 83, 80, 0.12)'
                          : 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Typography fontWeight={700} sx={{ color: 'rgba(255,255,255,0.92)' }}>
                      {r.businessName}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Estado
                      </Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip label={r.statusLabel} size="small" variant="outlined" sx={{ color: 'rgba(255,255,255,0.88)', borderColor: 'rgba(255,255,255,0.35)' }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Alta
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>
                        {formatDate(r.createdAt)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        1er pago
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>
                        {formatDate(r.firstPaidAt)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Plan
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>
                        {r.planNombre ?? '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Desc. negocio
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>
                        {formatMoney(r.discountSnapshot)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        Tu recompensa
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>
                        {formatMoney(r.rewardSnapshot)}
                      </Typography>
                    </Box>
                    {r.status === REFERRAL_STATUS.rejectedFraud && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
                        No aplica recompensa por detección de fraude. El negocio se creó con normalidad.
                      </Alert>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>

          <TableContainer
            sx={{
              display: { xs: 'none', sm: 'block' },
              // Tema global (claro) pinta thead/hover en gris claro; aquí forzamos UI oscura con contraste.
              '& ::selection': {
                backgroundColor: 'rgba(78, 205, 196, 0.35)',
                color: 'rgba(255,255,255,0.98)',
              },
            }}
          >
            <Table size="small">
              <TableHead
                sx={{
                  '& .MuiTableCell-head': {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    fontWeight: 600,
                  },
                }}
              >
                <TableRow>
                  <TableCell>Negocio</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Alta</TableCell>
                  <TableCell>1er pago</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Desc. negocio</TableCell>
                  <TableCell align="right">Tu recompensa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.referrals.length === 0 ? (
                  <TableRow sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
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
                        '&:hover': {
                          bgcolor:
                            r.status === REFERRAL_STATUS.rejectedFraud
                              ? 'rgba(239, 83, 80, 0.2)'
                              : 'rgba(255,255,255,0.06)',
                        },
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
