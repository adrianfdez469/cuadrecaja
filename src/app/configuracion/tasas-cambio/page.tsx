"use client";

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, InputLabel,
  MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, History, TrendingUp } from '@mui/icons-material';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { PageContainer } from '@/components/PageContainer';
import { ContentCard } from '@/components/ContentCard';
import { getTasasCambio, registrarTasaCambio } from '@/services/tasaCambioService';
import type { ITasaCambio } from '@/schemas/tasaCambio';

const breadcrumbs = [
  { label: 'Inicio', href: '/home' },
  { label: 'Configuración', href: '/configuracion' },
  { label: 'Tasas de cambio' },
];

const fmtDate = (d: Date) =>
  new Date(d).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtDay = (d: Date) =>
  new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export default function TasasCambioPage() {
  const { user, loadingContext, monedasNegocio, monedaBase, refreshMonedas } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tasas, setTasas] = useState<ITasaCambio[]>([]);
  const [vigentes, setVigentes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const [openDialog, setOpenDialog] = useState(false);
  const [monedaCode, setMonedaCode] = useState('');
  const [tasaValor, setTasaValor] = useState('');
  const [saving, setSaving] = useState(false);

  const negocioId = user?.negocio?.id;
  const monedasDisponibles = monedasNegocio.filter((m) => m.monedaCode !== 'CUP' && m.activo);

  useEffect(() => {
    if (!loadingContext && negocioId) load();
  }, [loadingContext, negocioId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTasasCambio(negocioId);
      setTasas(res.tasas);
      setVigentes(res.vigentes);
    } catch {
      showMessage('Error al cargar tasas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setMonedaCode(monedasDisponibles[0]?.monedaCode ?? '');
    setTasaValor('');
    setOpenDialog(true);
  };

  const saveTasa = async () => {
    const val = parseFloat(tasaValor);
    if (!monedaCode || !val || val <= 0) return;
    setSaving(true);
    try {
      await registrarTasaCambio(negocioId, { monedaCode, tasa: val });
      showMessage('Tasa registrada', 'success');
      setOpenDialog(false);
      await load();
      await refreshMonedas();
    } catch {
      showMessage('Error al registrar tasa', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingContext || loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  const tasasMostradas = tasas.filter((t) => t.monedaCode !== 'CUP');
  const vigentesExternas = Object.entries(vigentes).filter(([k]) => k !== 'CUP');

  // Solo la vigente por moneda (una fila por código)
  const vigentesRows = Object.entries(vigentes)
    .filter(([code]) => code !== 'CUP')
    .map(([code, tasa]) => ({ code, tasa }));

  // Histórico agrupado por día (key = ISO date string yyyy-mm-dd)
  const porFecha: Record<string, ITasaCambio[]> = {};
  for (const t of tasasMostradas) {
    const key = new Date(t.createdAt).toISOString().slice(0, 10);
    if (!porFecha[key]) porFecha[key] = [];
    porFecha[key].push(t);
  }
  // Keys ordenados más reciente primero
  const fechasOrdenadas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a));

  return (
    <PageContainer title="Tasas de cambio" breadcrumbs={breadcrumbs}>
      <ContentCard>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Moneda base: <Chip label={monedaBase} size="small" color="primary" sx={{ ml: 0.5 }} />
            </Typography>
          </Box>
          {monedasDisponibles.length > 0 && (
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} size={isMobile ? 'small' : 'medium'}>
              {isMobile ? 'Nueva tasa' : 'Registrar tasa'}
            </Button>
          )}
        </Stack>

        {monedasDisponibles.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Habilita otras monedas en &quot;Monedas del negocio&quot; para registrar tasas.
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<TrendingUp fontSize="small" />} iconPosition="start" label="Vigentes" />
          <Tab icon={<History fontSize="small" />} iconPosition="start" label="Histórico" />
        </Tabs>

        {/* ── Tab 0: Vigentes ── */}
        {tab === 0 && (
          <>
            {vigentesExternas.length > 0 && (
              <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
                {vigentesExternas.map(([code, tasa]) => (
                  <Chip
                    key={code}
                    icon={<TrendingUp />}
                    label={`1 ${code} = ${tasa} CUP`}
                    color="primary"
                    variant="outlined"
                    size={isMobile ? 'small' : 'medium'}
                  />
                ))}
              </Stack>
            )}

            {isMobile ? (
              <Stack spacing={1.5}>
                {vigentesRows.map(({ code, tasa }) => (
                  <Card key={code} variant="outlined">
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" gap={1} alignItems="center">
                          <Chip label={code} size="small" color="primary" variant="outlined" />
                          <Chip label="Vigente" color="success" size="small" />
                        </Stack>
                        <Typography variant="body1" fontWeight="bold">
                          1 {code} = {tasa} CUP
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {vigentesRows.length === 0 && (
                  <Alert severity="info">No hay tasas registradas.</Alert>
                )}
              </Stack>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Moneda</TableCell>
                      <TableCell>Tasa vigente</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vigentesRows.map(({ code, tasa }) => (
                      <TableRow key={code}>
                        <TableCell><Chip label={code} size="small" /></TableCell>
                        <TableCell>1 {code} = <strong>{tasa}</strong> CUP</TableCell>
                        <TableCell><Chip label="Vigente" color="success" size="small" /></TableCell>
                      </TableRow>
                    ))}
                    {vigentesRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No hay tasas registradas</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {/* ── Tab 1: Histórico agrupado por fecha ── */}
        {tab === 1 && (
          <>
            {fechasOrdenadas.length === 0 && (
              <Alert severity="info">No hay registros históricos.</Alert>
            )}
            <Stack spacing={3}>
              {fechasOrdenadas.map((fechaKey) => {
                const registros = porFecha[fechaKey];
                return (
                  <Box key={fechaKey}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ textTransform: 'capitalize', mb: 1 }}
                    >
                      {fmtDay(new Date(fechaKey + 'T12:00:00'))}
                    </Typography>
                    <Divider sx={{ mb: 1.5 }} />

                    {isMobile ? (
                      <Stack spacing={1}>
                        {registros.map((t) => {
                          const esVigente = vigentes[t.monedaCode] === t.tasa;
                          return (
                            <Card key={t.id} variant="outlined">
                              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Stack direction="row" gap={0.75} alignItems="center">
                                    <Chip label={t.monedaCode} size="small" />
                                    {esVigente
                                      ? <Chip label="Vigente" color="success" size="small" />
                                      : <Chip label="Histórica" size="small" variant="outlined" />}
                                  </Stack>
                                  <Typography variant="body2" fontWeight="bold">
                                    {t.tasa} CUP
                                  </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between" mt={0.5}>
                                  <Typography variant="caption" color="text.secondary">
                                    {t.creadoPor?.nombre ?? '—'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {fmtDate(t.createdAt)}
                                  </Typography>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Stack>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Moneda</TableCell>
                              <TableCell>Tasa</TableCell>
                              <TableCell>Registrada por</TableCell>
                              <TableCell>Hora</TableCell>
                              <TableCell>Estado</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {registros.map((t) => {
                              const esVigente = vigentes[t.monedaCode] === t.tasa;
                              return (
                                <TableRow key={t.id} sx={{ opacity: esVigente ? 1 : 0.55 }}>
                                  <TableCell><Chip label={t.monedaCode} size="small" /></TableCell>
                                  <TableCell>1 {t.monedaCode} = <strong>{t.tasa}</strong> CUP</TableCell>
                                  <TableCell>{t.creadoPor?.nombre ?? '—'}</TableCell>
                                  <TableCell>
                                    {new Date(t.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell>
                                    {esVigente
                                      ? <Chip label="Vigente" color="success" size="small" />
                                      : <Chip label="Histórica" size="small" variant="outlined" />}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </>
        )}
      </ContentCard>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Registrar tasa de cambio</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Moneda</InputLabel>
              <Select value={monedaCode} label="Moneda" onChange={(e) => setMonedaCode(e.target.value)}>
                {monedasDisponibles.map((m) => (
                  <MenuItem key={m.monedaCode} value={m.monedaCode}>
                    {m.monedaCode} — {m.moneda?.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={`Cuántos CUP vale 1 ${monedaCode || '...'}`}
              type="number"
              value={tasaValor}
              onChange={(e) => setTasaValor(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              helperText={monedaCode && tasaValor ? `1 ${monedaCode} = ${tasaValor} CUP` : ''}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveTasa} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Registrar'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
