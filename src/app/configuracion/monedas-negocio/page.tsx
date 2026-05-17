"use client";

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, CurrencyExchange, Warning } from '@mui/icons-material';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { PageContainer } from '@/components/PageContainer';
import { ContentCard } from '@/components/ContentCard';
import {
  getMonedasGlobales, habilitarMonedaNegocio, updateMonedaNegocio, deshabilitarMonedaNegocio,
} from '@/services/monedaService';
import { previewCambiarMonedaBase, ejecutarCambioMonedaBase } from '@/services/tasaCambioService';
import type { IMonedaConDenominaciones, INegocioMoneda } from '@/schemas/moneda';
import type { ICambiarMonedaBasePreview } from '@/services/tasaCambioService';

const breadcrumbs = [
  { label: 'Inicio', href: '/home' },
  { label: 'Configuración', href: '/configuracion' },
  { label: 'Monedas del negocio' },
];

export default function MonedasNegocioPage() {
  const { user, loadingContext, monedasNegocio, monedaBase, refreshMonedas } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [monedasGlobales, setMonedasGlobales] = useState<IMonedaConDenominaciones[]>([]);
  const [loading, setLoading] = useState(true);

  const [openHabilitar, setOpenHabilitar] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [admiteEfectivo, setAdmiteEfectivo] = useState(true);
  const [admiteTransferencia, setAdmiteTransferencia] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openCambioBase, setOpenCambioBase] = useState(false);
  const [nuevaBase, setNuevaBase] = useState('');
  const [preview, setPreview] = useState<ICambiarMonedaBasePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);

  const negocioId = user?.negocio?.id;
  // Excluir la moneda base de la lista editable (no se puede deshabilitar ni volver a poner como base)
  const monedasExtra = monedasNegocio.filter((m) => m.monedaCode !== monedaBase);
  const monedasHabilitadasCodes = new Set(monedasNegocio.map((m) => m.monedaCode));
  const monedasDisponiblesParaHabilitar = monedasGlobales.filter(
    (m) => m.activo && !monedasHabilitadasCodes.has(m.code) && m.code !== monedaBase,
  );

  useEffect(() => {
    if (!loadingContext) load();
  }, [loadingContext]);

  const load = async () => {
    setLoading(true);
    try {
      setMonedasGlobales(await getMonedasGlobales());
    } catch {
      showMessage('Error al cargar monedas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openHabilitarDialog = () => {
    setSelectedCode(monedasDisponiblesParaHabilitar[0]?.code ?? '');
    setAdmiteEfectivo(true);
    setAdmiteTransferencia(false);
    setOpenHabilitar(true);
  };

  const habilitar = async () => {
    if (!selectedCode) return;
    setSaving(true);
    try {
      await habilitarMonedaNegocio(negocioId, { monedaCode: selectedCode, admiteEfectivo, admiteTransferencia });
      showMessage('Moneda habilitada', 'success');
      setOpenHabilitar(false);
      await refreshMonedas();
    } catch {
      showMessage('Error al habilitar moneda', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleMoneda = async (m: INegocioMoneda, campo: 'admiteEfectivo' | 'admiteTransferencia') => {
    try {
      await updateMonedaNegocio(negocioId, m.monedaCode, {
        admiteEfectivo: campo === 'admiteEfectivo' ? !m.admiteEfectivo : m.admiteEfectivo,
        admiteTransferencia: campo === 'admiteTransferencia' ? !m.admiteTransferencia : m.admiteTransferencia,
      });
      await refreshMonedas();
    } catch {
      showMessage('Error al actualizar', 'error');
    }
  };

  const deshabilitar = async (m: INegocioMoneda) => {
    try {
      await deshabilitarMonedaNegocio(negocioId, m.monedaCode);
      await refreshMonedas();
    } catch {
      showMessage('Error al deshabilitar', 'error');
    }
  };

  const abrirCambioBase = async (code: string) => {
    setNuevaBase(code);
    setPreview(null);
    setOpenCambioBase(true);
    setLoadingPreview(true);
    try {
      setPreview(await previewCambiarMonedaBase(negocioId, code));
    } catch (e: unknown) {
      showMessage(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cargar preview',
        'error',
      );
      setOpenCambioBase(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const ejecutarCambio = async () => {
    setEjecutando(true);
    try {
      await ejecutarCambioMonedaBase(negocioId, nuevaBase);
      showMessage('Moneda base cambiada correctamente', 'success');
      setOpenCambioBase(false);
      await refreshMonedas();
    } catch {
      showMessage('Error al cambiar moneda base', 'error');
    } finally {
      setEjecutando(false);
    }
  };

  if (loadingContext || loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <PageContainer title="Monedas del negocio" breadcrumbs={breadcrumbs}>
      <ContentCard>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Moneda base: <Chip label={monedaBase} size="small" color="primary" sx={{ ml: 0.5 }} />
            </Typography>
          </Box>
          {monedasDisponiblesParaHabilitar.length > 0 && (
            <Button variant="contained" startIcon={<Add />} onClick={openHabilitarDialog} size={isMobile ? 'small' : 'medium'}>
              {isMobile ? 'Habilitar' : 'Habilitar moneda'}
            </Button>
          )}
        </Stack>

        {/* ── Vista móvil: cards ── */}
        {isMobile ? (
          <Stack spacing={2}>
            {/* Card moneda base */}
            <Card variant="outlined" sx={{ bgcolor: 'action.selected' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" gap={1} alignItems="center">
                    <Chip label={monedaBase} size="small" color="primary" />
                    <Chip label="Base" size="small" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">Efectivo + Transfer ✓</Typography>
                </Stack>
              </CardContent>
            </Card>

            {monedasExtra.map((m) => (
              <Card key={m.monedaCode} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                    <Chip label={m.monedaCode} size="small" color="primary" variant="outlined" />
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => deshabilitar(m)}
                      sx={{ minWidth: 0, px: 1 }}
                    >
                      Deshabilitar
                    </Button>
                  </Stack>

                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Admite efectivo</Typography>
                      <Switch
                        checked={m.admiteEfectivo}
                        onChange={() => toggleMoneda(m, 'admiteEfectivo')}
                        size="small"
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Admite transferencia</Typography>
                      <Switch
                        checked={m.admiteTransferencia}
                        onChange={() => toggleMoneda(m, 'admiteTransferencia')}
                        size="small"
                      />
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<CurrencyExchange />}
                      onClick={() => abrirCambioBase(m.monedaCode)}
                      sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                    >
                      Usar como moneda base
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {monedasNegocio.length === 0 && (
              <Alert severity="info">No hay otras monedas habilitadas.</Alert>
            )}
          </Stack>
        ) : (
          /* ── Vista desktop: tabla ── */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Moneda</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Moneda base</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell>
                    <Chip label={monedaBase} color="primary" size="small" />
                    <Chip label="Base" size="small" sx={{ ml: 0.5 }} />
                  </TableCell>
                  <TableCell>✓</TableCell>
                  <TableCell>✓</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>

                {monedasExtra.map((m) => (
                  <TableRow key={m.monedaCode}>
                    <TableCell><Chip label={m.monedaCode} size="small" /></TableCell>
                    <TableCell>
                      <Switch checked={m.admiteEfectivo} onChange={() => toggleMoneda(m, 'admiteEfectivo')} size="small" />
                    </TableCell>
                    <TableCell>
                      <Switch checked={m.admiteTransferencia} onChange={() => toggleMoneda(m, 'admiteTransferencia')} size="small" />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<CurrencyExchange />} onClick={() => abrirCambioBase(m.monedaCode)}>
                        Usar como base
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="small" color="error" onClick={() => deshabilitar(m)}>Deshabilitar</Button>
                    </TableCell>
                  </TableRow>
                ))}

                {monedasExtra.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No hay otras monedas habilitadas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog habilitar */}
      <Dialog
        open={openHabilitar}
        onClose={() => setOpenHabilitar(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Habilitar moneda</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Moneda</InputLabel>
              <Select value={selectedCode} label="Moneda" onChange={(e) => setSelectedCode(e.target.value)}>
                {monedasDisponiblesParaHabilitar.map((m) => (
                  <MenuItem key={m.code} value={m.code}>{m.code} — {m.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={admiteEfectivo} onChange={(e) => setAdmiteEfectivo(e.target.checked)} />}
              label="Admite efectivo"
            />
            <FormControlLabel
              control={<Switch checked={admiteTransferencia} onChange={(e) => setAdmiteTransferencia(e.target.checked)} />}
              label="Admite transferencia"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHabilitar(false)}>Cancelar</Button>
          <Button variant="contained" onClick={habilitar} disabled={saving || !selectedCode}>
            {saving ? <CircularProgress size={20} /> : 'Habilitar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cambio de moneda base */}
      <Dialog
        open={openCambioBase}
        onClose={() => !ejecutando && setOpenCambioBase(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Cambiar moneda base a {nuevaBase}</DialogTitle>
        <DialogContent>
          {loadingPreview && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {preview && (
            <Stack gap={2} mt={1}>
              <Alert severity="warning" icon={<Warning />}>
                Esta acción convertirá <strong>todos los precios y costos</strong> ({preview.totalProductos} productos)
                usando la tasa: <strong>1 {nuevaBase} = {preview.tasa} {monedaBase}</strong>. No se puede deshacer automáticamente.
              </Alert>

              <Typography variant="subtitle2">
                Vista previa — primeros {preview.preview.length} productos:
              </Typography>

              {/* En móvil: lista; en desktop: tabla */}
              {isMobile ? (
                <Stack spacing={1}>
                  {preview.preview.map((p, i) => (
                    <Card key={i} variant="outlined">
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="body2" fontWeight="medium" mb={0.5}>{p.nombre}</Typography>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Antes: {p.precioAntes.toFixed(2)} {monedaBase}
                          </Typography>
                          <Typography variant="caption" color="success.main" fontWeight="medium">
                            Después: {p.precioDepues.toFixed(2)} {nuevaBase}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell>Precio antes</TableCell>
                          <TableCell>Precio después</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.preview.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{p.nombre}</TableCell>
                            <TableCell>{p.precioAntes.toFixed(2)} {monedaBase}</TableCell>
                            <TableCell>{p.precioDepues.toFixed(2)} {nuevaBase}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCambioBase(false)} disabled={ejecutando}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={ejecutarCambio}
            disabled={ejecutando || loadingPreview || !preview}
          >
            {ejecutando ? <CircularProgress size={20} /> : 'Confirmar cambio'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
