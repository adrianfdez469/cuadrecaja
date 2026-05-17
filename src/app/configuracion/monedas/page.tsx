"use client";

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Stack, Switch, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Delete, Edit, ExpandLess, ExpandMore } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { PageContainer } from '@/components/PageContainer';
import { ContentCard } from '@/components/ContentCard';
import {
  getMonedasGlobales, createMoneda, updateMoneda, deactivateMoneda,
  createDenominacion, deleteDenominacion,
} from '@/services/monedaService';
import type { IMonedaConDenominaciones, IDenominacionBillete } from '@/schemas/moneda';

const breadcrumbs = [
  { label: 'Inicio', href: '/home' },
  { label: 'Configuración', href: '/configuracion' },
  { label: 'Monedas' },
];

export default function MonedasPage() {
  const router = useRouter();
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [monedas, setMonedas] = useState<IMonedaConDenominaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const [openMonedaDialog, setOpenMonedaDialog] = useState(false);
  const [editingMoneda, setEditingMoneda] = useState<IMonedaConDenominaciones | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newSimbolo, setNewSimbolo] = useState('');
  const [savingMoneda, setSavingMoneda] = useState(false);

  const [openDenomDialog, setOpenDenomDialog] = useState(false);
  const [denomMonedaCode, setDenomMonedaCode] = useState('');
  const [newDenomValor, setNewDenomValor] = useState('');
  const [savingDenom, setSavingDenom] = useState(false);

  useEffect(() => {
    if (!loadingContext && user?.rol !== 'SUPER_ADMIN') {
      showMessage('Acceso denegado', 'error');
      router.push('/home');
    }
  }, [user, loadingContext, router, showMessage]);

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      setMonedas(await getMonedasGlobales());
    } catch {
      showMessage('Error al cargar monedas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingMoneda(null);
    setNewCode(''); setNewNombre(''); setNewSimbolo('');
    setOpenMonedaDialog(true);
  };

  const openEdit = (m: IMonedaConDenominaciones) => {
    setEditingMoneda(m);
    setNewCode(m.code); setNewNombre(m.nombre); setNewSimbolo(m.simbolo);
    setOpenMonedaDialog(true);
  };

  const saveMoneda = async () => {
    if (!newCode.trim() || !newNombre.trim() || !newSimbolo.trim()) return;
    setSavingMoneda(true);
    try {
      if (editingMoneda) {
        await updateMoneda(editingMoneda.code, { nombre: newNombre, simbolo: newSimbolo });
        showMessage('Moneda actualizada', 'success');
      } else {
        await createMoneda({ code: newCode.toUpperCase(), nombre: newNombre, simbolo: newSimbolo });
        showMessage('Moneda creada', 'success');
      }
      setOpenMonedaDialog(false);
      load();
    } catch {
      showMessage('Error al guardar moneda', 'error');
    } finally {
      setSavingMoneda(false);
    }
  };

  const toggleActivo = async (m: IMonedaConDenominaciones) => {
    try {
      if (m.activo) {
        await deactivateMoneda(m.code);
      } else {
        await updateMoneda(m.code, { activo: true });
      }
      load();
    } catch {
      showMessage('Error al cambiar estado', 'error');
    }
  };

  const openAddDenom = (code: string) => {
    setDenomMonedaCode(code);
    setNewDenomValor('');
    setOpenDenomDialog(true);
  };

  const saveDenom = async () => {
    const val = parseFloat(newDenomValor);
    if (!val || val <= 0) return;
    setSavingDenom(true);
    try {
      await createDenominacion(denomMonedaCode, { valor: val });
      showMessage('Denominación agregada', 'success');
      setOpenDenomDialog(false);
      load();
    } catch {
      showMessage('Error al agregar denominación', 'error');
    } finally {
      setSavingDenom(false);
    }
  };

  const removeDenom = async (code: string, denom: IDenominacionBillete) => {
    try {
      await deleteDenominacion(code, denom.id);
      load();
    } catch {
      showMessage('Error al eliminar denominación', 'error');
    }
  };

  const toggle = (code: string) =>
    setExpandedCode((prev) => (prev === code ? null : code));

  if (loadingContext || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageContainer title="Monedas del sistema" breadcrumbs={breadcrumbs}>
      <ContentCard>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Monedas del sistema</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
            {isMobile ? 'Nueva' : 'Nueva moneda'}
          </Button>
        </Stack>

        {/* ── Vista móvil: cards ── */}
        {isMobile ? (
          <Stack spacing={2}>
            {monedas.map((m) => (
              <Box key={m.code} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" px={1.5} py={1}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Chip label={m.code} size="small" color={m.activo ? 'primary' : 'default'} />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">{m.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">Símbolo: {m.simbolo}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center">
                    <Switch checked={m.activo} onChange={() => toggleActivo(m)} size="small" />
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(m)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => toggle(m.code)}>
                      {expandedCode === m.code ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Stack>

                <Collapse in={expandedCode === m.code}>
                  <Divider />
                  <Box px={1.5} py={1} sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      Denominaciones ({m.denominaciones.length})
                    </Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                      {m.denominaciones.map((d) => (
                        <Chip
                          key={d.id}
                          label={d.valor}
                          size="small"
                          onDelete={() => removeDenom(m.code, d)}
                          deleteIcon={<Delete fontSize="small" />}
                        />
                      ))}
                      <Button size="small" startIcon={<Add />} onClick={() => openAddDenom(m.code)}>
                        Agregar
                      </Button>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            ))}
            {monedas.length === 0 && (
              <Alert severity="info">No hay monedas configuradas.</Alert>
            )}
          </Stack>
        ) : (
          /* ── Vista desktop: tabla ── */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Símbolo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Denominaciones</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monedas.map((m) => (
                  <>
                    <TableRow key={m.code}>
                      <TableCell><Chip label={m.code} size="small" /></TableCell>
                      <TableCell>{m.nombre}</TableCell>
                      <TableCell>{m.simbolo}</TableCell>
                      <TableCell>
                        <Switch checked={m.activo} onChange={() => toggleActivo(m)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="body2">{m.denominaciones.length} denominaciones</Typography>
                          <IconButton size="small" onClick={() => toggle(m.code)}>
                            {expandedCode === m.code ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(m)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {expandedCode === m.code && (
                      <TableRow key={`${m.code}-denoms`}>
                        <TableCell colSpan={6} sx={{ bgcolor: 'action.hover', py: 1 }}>
                          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                            {m.denominaciones.map((d) => (
                              <Chip
                                key={d.id}
                                label={d.valor}
                                size="small"
                                onDelete={() => removeDenom(m.code, d)}
                                deleteIcon={<Delete fontSize="small" />}
                              />
                            ))}
                            <Button size="small" startIcon={<Add />} onClick={() => openAddDenom(m.code)}>
                              Agregar
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {monedas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No hay monedas configuradas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog moneda */}
      <Dialog
        open={openMonedaDialog}
        onClose={() => setOpenMonedaDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>{editingMoneda ? 'Editar moneda' : 'Nueva moneda'}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              label="Código (ej. USD)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              disabled={!!editingMoneda}
              inputProps={{ maxLength: 10 }}
              fullWidth
            />
            <TextField label="Nombre" value={newNombre} onChange={(e) => setNewNombre(e.target.value)} fullWidth />
            <TextField label="Símbolo" value={newSimbolo} onChange={(e) => setNewSimbolo(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMonedaDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveMoneda} disabled={savingMoneda}>
            {savingMoneda ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog denominación */}
      <Dialog
        open={openDenomDialog}
        onClose={() => setOpenDenomDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Agregar denominación — {denomMonedaCode}</DialogTitle>
        <DialogContent>
          <TextField
            label="Valor"
            type="number"
            value={newDenomValor}
            onChange={(e) => setNewDenomValor(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDenomDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveDenom} disabled={savingDenom}>
            {savingDenom ? <CircularProgress size={20} /> : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
