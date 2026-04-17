"use client";

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Edit, History, Refresh, Visibility } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { ContentCard } from '@/components/ContentCard';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import {
  fetchAdminPromoters,
  fetchAdminReferrals,
  fetchReferralEvents,
  fetchReferralRewardRulesByPlan,
  liquidateReferral,
  upsertReferralRewardRuleForPlan,
  type IAdminPromoterRow,
  type IAdminReferralRow,
  type IReferralEventRow,
  type IReferralRewardRulePlanRow,
} from '@/services/referralAdminService';
import { getPlanes } from '@/services/planService';
import type { IPlan } from '@/schemas/plan';
import { REFERRAL_STATUS, REFERRAL_STATUS_LABELS } from '@/constants/referrals';

const breadcrumbs = [
  { label: 'Inicio', href: '/home' },
  { label: 'Configuración', href: '/configuracion' },
  { label: 'Referidos' },
];

const REFERRAL_STATUS_OPTIONS = Object.values(REFERRAL_STATUS);

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(n);
}

function tabProps(index: number) {
  return { id: `referidos-tab-${index}`, 'aria-controls': `referidos-tabpanel-${index}` };
}

export default function ReferidosAdminPage() {
  const router = useRouter();
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const [promoters, setPromoters] = useState<IAdminPromoterRow[]>([]);
  const [promoterQ, setPromoterQ] = useState('');
  const [promoterStatus, setPromoterStatus] = useState<string>('');

  const [referrals, setReferrals] = useState<IAdminReferralRow[]>([]);
  const [refPromoterFilter, setRefPromoterFilter] = useState<{ id: string; label: string } | null>(null);
  const [refStatus, setRefStatus] = useState<string>('');
  const [refPlanId, setRefPlanId] = useState<string>('');
  const [refFrom, setRefFrom] = useState<string>('');
  const [refTo, setRefTo] = useState<string>('');
  const [planes, setPlanes] = useState<IPlan[]>([]);

  const [liquidateOpen, setLiquidateOpen] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<IAdminReferralRow | null>(null);
  const [liqAt, setLiqAt] = useState('');
  const [liqAmount, setLiqAmount] = useState<string>('');
  const [liqMethod, setLiqMethod] = useState('');
  const [liqNote, setLiqNote] = useState('');

  const [eventsOpen, setEventsOpen] = useState(false);
  const [events, setEvents] = useState<IReferralEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [rewardRows, setRewardRows] = useState<IReferralRewardRulePlanRow[]>([]);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleEditPlanId, setRuleEditPlanId] = useState<string | null>(null);
  const [ruleEditPlanNombre, setRuleEditPlanNombre] = useState('');
  const [ruleDiscount, setRuleDiscount] = useState('');
  const [ruleReward, setRuleReward] = useState('');
  const [ruleIsActive, setRuleIsActive] = useState(true);

  useEffect(() => {
    if (!loadingContext && user && user.rol !== 'SUPER_ADMIN') {
      showMessage('No tienes permisos para acceder a esta sección', 'error');
      router.push('/home');
    }
  }, [user, loadingContext, router, showMessage]);

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') {
      getPlanes()
        .then(setPlanes)
        .catch(() => showMessage('Error al cargar planes', 'error'));
    }
  }, [user, showMessage]);

  const loadPromoters = async () => {
    setLoading(true);
    try {
      const items = await fetchAdminPromoters({
        q: promoterQ.trim() || undefined,
        status: promoterStatus || undefined,
      });
      setPromoters(items);
    } catch {
      showMessage('Error al cargar promotores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const items = await fetchAdminReferrals({
        promoterId: refPromoterFilter?.id || undefined,
        status: refStatus || undefined,
        planId: refPlanId || undefined,
        from: refFrom ? new Date(refFrom).toISOString() : undefined,
        to: refTo ? new Date(refTo).toISOString() : undefined,
      });
      setReferrals(items);
    } catch {
      showMessage('Error al cargar referidos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRewardRules = async () => {
    setLoading(true);
    try {
      const items = await fetchReferralRewardRulesByPlan();
      setRewardRows(items);
    } catch {
      showMessage('Error al cargar reglas de recompensa', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN' && tab === 0) loadPromoters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, refPromoterFilter]);

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN' && tab === 1) loadReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN' && tab === 2) loadRewardRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  const openLiquidate = (r: IAdminReferralRow) => {
    setSelectedReferral(r);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setLiqAt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
    setLiqAmount(r.promoterRewardSnapshot != null ? String(r.promoterRewardSnapshot) : '');
    setLiqMethod('');
    setLiqNote('');
    setLiquidateOpen(true);
  };

  const submitLiquidate = async () => {
    if (!selectedReferral) return;
    try {
      await liquidateReferral(selectedReferral.id, {
        liquidatedAt: liqAt ? new Date(liqAt).toISOString() : undefined,
        paidAmount: liqAmount.trim() ? Number.parseFloat(liqAmount) : undefined,
        paymentMethod: liqMethod.trim() || undefined,
        note: liqNote.trim() || undefined,
      });
      showMessage('Liquidación registrada', 'success');
      setLiquidateOpen(false);
      setSelectedReferral(null);
      await loadReferrals();
    } catch {
      showMessage('No se pudo registrar la liquidación', 'error');
    }
  };

  const openRuleDialog = (row: IReferralRewardRulePlanRow) => {
    setRuleEditPlanId(row.planId);
    setRuleEditPlanNombre(row.planNombre);
    if (row.rule) {
      setRuleDiscount(String(row.rule.discountForNewBusiness));
      setRuleReward(String(row.rule.rewardForPromoter));
      setRuleIsActive(row.rule.isActive);
    } else {
      setRuleDiscount('0');
      setRuleReward('0');
      setRuleIsActive(true);
    }
    setRuleDialogOpen(true);
  };

  const submitRuleDialog = async () => {
    if (!ruleEditPlanId) return;
    const discount = Number.parseFloat(ruleDiscount.replace(',', '.'));
    const reward = Number.parseFloat(ruleReward.replace(',', '.'));
    if (Number.isNaN(discount) || discount < 0 || Number.isNaN(reward) || reward < 0) {
      showMessage('Introduce montos numéricos válidos (mayor o igual que 0).', 'error');
      return;
    }
    try {
      await upsertReferralRewardRuleForPlan(ruleEditPlanId, {
        discountForNewBusiness: discount,
        rewardForPromoter: reward,
        isActive: ruleIsActive,
      });
      showMessage('Regla de recompensa guardada', 'success');
      setRuleDialogOpen(false);
      setRuleEditPlanId(null);
      await loadRewardRules();
    } catch {
      showMessage('No se pudo guardar la regla', 'error');
    }
  };

  const openEvents = async (referralId: string) => {
    setEventsOpen(true);
    setEventsLoading(true);
    setEvents([]);
    try {
      const items = await fetchReferralEvents(referralId);
      setEvents(items);
    } catch {
      showMessage('Error al cargar historial', 'error');
    } finally {
      setEventsLoading(false);
    }
  };

  if (!user || user.rol !== 'SUPER_ADMIN') {
    if (loadingContext) {
      return (
        <PageContainer breadcrumbs={breadcrumbs} title="Referidos">
          <CircularProgress />
        </PageContainer>
      );
    }
    return null;
  }

  return (
    <PageContainer breadcrumbs={breadcrumbs} title="Referidos y promotores">
      <ContentCard>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Promotores" {...tabProps(0)} />
          <Tab label="Referidos" {...tabProps(1)} />
          <Tab label="Reglas por plan" {...tabProps(2)} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                label="Buscar (correo, nombre, código)"
                value={promoterQ}
                onChange={(e) => setPromoterQ(e.target.value)}
                size="small"
                fullWidth
              />
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                <InputLabel>Estado</InputLabel>
                <Select
                  label="Estado"
                  value={promoterStatus}
                  onChange={(e) => setPromoterStatus(e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="ACTIVE">Activo</MenuItem>
                  <MenuItem value="INACTIVE">Inactivo</MenuItem>
                  <MenuItem value="PENDING_EMAIL_VERIFICATION">Pendiente email</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
                onClick={loadPromoters}
                disabled={loading}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Actualizar
              </Button>
            </Stack>
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {promoters.length === 0 ? (
                !loading && <Alert severity="info">No hay promotores con los filtros actuales.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {promoters.map((p) => (
                    <Box
                      key={p.id}
                      sx={{
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography fontWeight={700}>{p.fullName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {p.email}
                      </Typography>
                      <Typography component="code" sx={{ display: 'inline-block', mt: 0.5, fontSize: '0.8rem' }}>
                        {p.promoCode}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={p.status} variant="outlined" />
                        <Chip size="small" label={`Referidos: ${p.referralsCount}`} variant="outlined" />
                        <Chip size="small" label={`Alta: ${new Date(p.createdAt).toLocaleDateString('es-ES')}`} variant="outlined" />
                      </Stack>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        sx={{ mt: 1 }}
                        onClick={() => {
                          setRefPromoterFilter({ id: p.id, label: `${p.fullName} (${p.promoCode})` });
                          setTab(1);
                        }}
                      >
                        Ver referidos
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Referidos</TableCell>
                    <TableCell>Alta</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {promoters.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.fullName}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>
                        <Typography component="code" fontSize="0.85rem">
                          {p.promoCode}
                        </Typography>
                      </TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell align="right">{p.referralsCount}</TableCell>
                      <TableCell>{new Date(p.createdAt).toLocaleDateString('es-ES')}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => {
                            setRefPromoterFilter({ id: p.id, label: `${p.fullName} (${p.promoCode})` });
                            setTab(1);
                          }}
                        >
                          Ver referidos
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {promoters.length === 0 && !loading && (
              <Alert severity="info" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                No hay promotores con los filtros actuales.
              </Alert>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            {refPromoterFilter && (
              <Alert
                severity="info"
                action={
                  <Button size="small" onClick={() => setRefPromoterFilter(null)}>
                    Quitar filtro
                  </Button>
                }
              >
                Mostrando referidos del promotor: <strong>{refPromoterFilter.label}</strong>
              </Alert>
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" alignItems={{ xs: 'stretch', md: 'center' }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 220 } }}>
                <InputLabel>Estado referido</InputLabel>
                <Select
                  label="Estado referido"
                  value={refStatus}
                  onChange={(e) => setRefStatus(e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {REFERRAL_STATUS_OPTIONS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {REFERRAL_STATUS_LABELS[s] ?? s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 200 } }}>
                <InputLabel>Plan (1er pago)</InputLabel>
                <Select label="Plan (1er pago)" value={refPlanId} onChange={(e) => setRefPlanId(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {planes.map((pl) => (
                    <MenuItem key={pl.id} value={pl.id}>
                      {pl.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Desde"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={refFrom}
                onChange={(e) => setRefFrom(e.target.value)}
                sx={{ width: { xs: '100%', md: 170 } }}
              />
              <TextField
                label="Hasta"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={refTo}
                onChange={(e) => setRefTo(e.target.value)}
                sx={{ width: { xs: '100%', md: 170 } }}
              />
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
                onClick={loadReferrals}
                disabled={loading}
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                Actualizar
              </Button>
            </Stack>
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {referrals.length === 0 ? (
                !loading && <Alert severity="info">No hay referidos con los filtros actuales.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {referrals.map((r) => (
                    <Box
                      key={r.id}
                      sx={{
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography fontWeight={700}>{r.newBusiness?.nombre ?? '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.promoter.fullName} ({r.promoter.promoCode})
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={REFERRAL_STATUS_LABELS[r.status] ?? r.status} variant="outlined" />
                        <Chip size="small" label={`Liquidación: ${r.liquidation?.status ?? '—'}`} variant="outlined" />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Desc. / Recomp.:</strong> {formatMoney(r.newBusinessDiscountSnapshot)} / {formatMoney(r.promoterRewardSnapshot)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Button size="small" startIcon={<History />} onClick={() => openEvents(r.id)}>
                          Historial
                        </Button>
                        {r.status === REFERRAL_STATUS.liquidationPending && (
                          <Button size="small" variant="outlined" onClick={() => openLiquidate(r)}>
                            Liquidar
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Negocio</TableCell>
                    <TableCell>Promotor</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Desc. / Recomp.</TableCell>
                    <TableCell>Liquidación</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {referrals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.newBusiness?.nombre ?? '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.promoter.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.promoter.promoCode}
                        </Typography>
                      </TableCell>
                      <TableCell>{REFERRAL_STATUS_LABELS[r.status] ?? r.status}</TableCell>
                      <TableCell>
                        {formatMoney(r.newBusinessDiscountSnapshot)} / {formatMoney(r.promoterRewardSnapshot)}
                      </TableCell>
                      <TableCell>{r.liquidation?.status ?? '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                          <Button size="small" startIcon={<History />} onClick={() => openEvents(r.id)}>
                            Historial
                          </Button>
                          {r.status === REFERRAL_STATUS.liquidationPending && (
                            <Button size="small" variant="outlined" onClick={() => openLiquidate(r)}>
                              Liquidar
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {referrals.length === 0 && !loading && (
              <Alert severity="info" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                No hay referidos con los filtros actuales.
              </Alert>
            )}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2}>
            <Alert severity="info">
              Para registrar el <strong>primer pago</strong> de un referido, el plan elegido debe tener una regla
              aquí y el plan debe estar <strong>activo</strong>. El descuento aplica al negocio referido y la
              recompensa al promotor (valores en la moneda del plan, p. ej. USD).
            </Alert>
            <Stack direction="row" justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
                onClick={loadRewardRules}
                disabled={loading}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Actualizar
              </Button>
            </Stack>
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {rewardRows.length === 0 ? (
                !loading && <Alert severity="warning">No hay planes en el sistema.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {rewardRows.map((row) => (
                    <Box
                      key={row.planId}
                      sx={{
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography fontWeight={700}>{row.planNombre}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={row.planActivo ? 'Plan activo' : 'Plan inactivo'} color={row.planActivo ? 'success' : 'default'} variant="outlined" />
                        {!row.rule ? (
                          <Chip size="small" label="Sin regla" color="warning" variant="outlined" />
                        ) : (
                          <Chip
                            size="small"
                            label={row.rule.isActive ? 'Regla activa' : 'Regla inactiva'}
                            color={row.rule.isActive ? 'success' : 'default'}
                            variant="outlined"
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Descuento:</strong> {row.rule != null ? formatMoney(row.rule.discountForNewBusiness) : '—'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Recompensa:</strong> {row.rule != null ? formatMoney(row.rule.rewardForPromoter) : '—'}
                      </Typography>
                      <Button size="small" startIcon={<Edit />} sx={{ mt: 1 }} onClick={() => openRuleDialog(row)}>
                        {row.rule ? 'Editar' : 'Crear'}
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
              <Table size="small" sx={{ minWidth: 880 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>Plan activo</TableCell>
                    <TableCell align="right">Descuento negocio</TableCell>
                    <TableCell align="right">Recompensa promotor</TableCell>
                    <TableCell>Regla</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rewardRows.map((row) => (
                    <TableRow key={row.planId}>
                      <TableCell>{row.planNombre}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.planActivo ? 'Sí' : 'No'}
                          color={row.planActivo ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {row.rule != null ? formatMoney(row.rule.discountForNewBusiness) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {row.rule != null ? formatMoney(row.rule.rewardForPromoter) : '—'}
                      </TableCell>
                      <TableCell>
                        {!row.rule ? (
                          <Chip size="small" label="Sin regla" color="warning" variant="outlined" />
                        ) : (
                          <Chip
                            size="small"
                            label={row.rule.isActive ? 'Activa' : 'Inactiva'}
                            color={row.rule.isActive ? 'success' : 'default'}
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<Edit />} onClick={() => openRuleDialog(row)}>
                          {row.rule ? 'Editar' : 'Crear'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {rewardRows.length === 0 && !loading && (
              <Alert severity="warning" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                No hay planes en el sistema.
              </Alert>
            )}
          </Stack>
        )}
      </ContentCard>

      <Dialog open={liquidateOpen} onClose={() => setLiquidateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Liquidar referido</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Negocio: {selectedReferral?.newBusiness?.nombre ?? '—'} · Recompensa snapshot:{' '}
              {formatMoney(selectedReferral?.promoterRewardSnapshot ?? null)}
            </Typography>
            <TextField
              label="Fecha liquidación"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={liqAt}
              onChange={(e) => setLiqAt(e.target.value)}
            />
            <TextField
              label="Monto pagado (opcional)"
              type="number"
              fullWidth
              value={liqAmount}
              onChange={(e) => setLiqAmount(e.target.value)}
            />
            <TextField
              label="Método (opcional)"
              fullWidth
              value={liqMethod}
              onChange={(e) => setLiqMethod(e.target.value)}
            />
            <TextField
              label="Nota (opcional)"
              fullWidth
              multiline
              minRows={2}
              value={liqNote}
              onChange={(e) => setLiqNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLiquidateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={submitLiquidate}>
            Confirmar liquidación
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Regla de recompensa — {ruleEditPlanNombre}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Descuento para el negocio referido"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 'any' }}
              value={ruleDiscount}
              onChange={(e) => setRuleDiscount(e.target.value)}
              helperText="Importe de beneficio/descuento para el negocio que llega referido (según tu política comercial)."
            />
            <TextField
              label="Recompensa para el promotor"
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 'any' }}
              value={ruleReward}
              onChange={(e) => setRuleReward(e.target.value)}
              helperText="Importe que verá el promotor al calificar el referido con este plan."
            />
            <FormControlLabel
              control={<Switch checked={ruleIsActive} onChange={(_, c) => setRuleIsActive(c)} color="primary" />}
              label="Regla activa (solo las activas permiten registrar primer pago con este plan)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={submitRuleDialog}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={eventsOpen} onClose={() => setEventsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Historial de eventos</DialogTitle>
        <DialogContent>
          {eventsLoading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {events.map((ev) => (
                <Box key={ev.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(ev.createdAt).toLocaleString('es-ES')} · {ev.eventType}
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                    {ev.payload ? JSON.stringify(ev.payload, null, 2) : '—'}
                  </Typography>
                </Box>
              ))}
              {events.length === 0 && <Typography color="text.secondary">Sin eventos registrados.</Typography>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventsOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
