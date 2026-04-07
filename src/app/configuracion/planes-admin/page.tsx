"use client";

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  InputLabel,
  FormControl,
  FormHelperText,
} from '@mui/material';
import { Add, Delete, Edit, WorkspacePremium } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageContainer } from '@/components/PageContainer';
import { ContentCard } from '@/components/ContentCard';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { getPlanes, createPlan, updatePlan, deletePlan } from '@/services/planService';
import { createPlanSchema, type IPlan, type ICreatePlan } from '@/schemas/plan';

const MUI_COLORS = ['info', 'primary', 'secondary', 'warning', 'success', 'error', 'default'] as const;

const formatLimite = (val: number) => (val === -1 ? '∞' : String(val));
const formatPrecio = (val: number) => (val === -1 ? 'Negociable' : `$${val}`);
const formatDuracion = (val: number) => (val === -1 ? 'Negociable' : `${val} días`);

const DEFAULT_VALUES: ICreatePlan = {
  nombre: '',
  descripcion: '',
  limiteLocales: 1,
  limiteUsuarios: 1,
  limiteProductos: 100,
  precio: 0,
  moneda: 'USD',
  duracion: 30,
  recomendado: false,
  color: 'primary',
  activo: true,
};

const breadcrumbs = [
  { label: 'Inicio', href: '/home' },
  { label: 'Configuración', href: '/configuracion' },
  { label: 'Planes de Negocio' },
];

export default function PlanesAdminPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const [planes, setPlanes] = useState<IPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<IPlan | null>(null);

  // Checkboxes de "ilimitado / negociable"
  const [ilimitadoLocales, setIlimitadoLocales] = useState(false);
  const [ilimitadoUsuarios, setIlimitadoUsuarios] = useState(false);
  const [ilimitadoProductos, setIlimitadoProductos] = useState(false);
  const [precioNegociable, setPrecioNegociable] = useState(false);
  const [duracionNegociable, setDuracionNegociable] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ICreatePlan>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Guard SUPER_ADMIN
  useEffect(() => {
    if (!loadingContext && user && user.rol !== 'SUPER_ADMIN') {
      showMessage('No tienes permisos para acceder a esta sección', 'error');
      router.push('/home');
    }
  }, [user, loadingContext, router, showMessage]);

  const fetchPlanes = async () => {
    setLoading(true);
    try {
      const data = await getPlanes();
      setPlanes(data);
    } catch {
      showMessage('Error al cargar los planes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') fetchPlanes();
  }, [user]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    reset(DEFAULT_VALUES);
    setIlimitadoLocales(false);
    setIlimitadoUsuarios(false);
    setIlimitadoProductos(false);
    setPrecioNegociable(false);
    setDuracionNegociable(false);
    setOpen(true);
  };

  const handleOpenEdit = (plan: IPlan) => {
    setEditingPlan(plan);
    reset({
      nombre: plan.nombre,
      descripcion: plan.descripcion ?? '',
      limiteLocales: plan.limiteLocales === -1 ? 1 : plan.limiteLocales,
      limiteUsuarios: plan.limiteUsuarios === -1 ? 1 : plan.limiteUsuarios,
      limiteProductos: plan.limiteProductos === -1 ? 1 : plan.limiteProductos,
      precio: plan.precio === -1 ? 0 : plan.precio,
      moneda: plan.moneda,
      duracion: plan.duracion === -1 ? 30 : plan.duracion,
      recomendado: plan.recomendado,
      color: plan.color,
      activo: plan.activo,
    });
    setIlimitadoLocales(plan.limiteLocales === -1);
    setIlimitadoUsuarios(plan.limiteUsuarios === -1);
    setIlimitadoProductos(plan.limiteProductos === -1);
    setPrecioNegociable(plan.precio === -1);
    setDuracionNegociable(plan.duracion === -1);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingPlan(null);
  };

  const onSubmit = async (data: ICreatePlan) => {
    const payload: ICreatePlan = {
      ...data,
      limiteLocales: ilimitadoLocales ? -1 : data.limiteLocales,
      limiteUsuarios: ilimitadoUsuarios ? -1 : data.limiteUsuarios,
      limiteProductos: ilimitadoProductos ? -1 : data.limiteProductos,
      precio: precioNegociable ? -1 : data.precio,
      duracion: duracionNegociable ? -1 : data.duracion,
    };

    setLoading(true);
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
        showMessage('Plan actualizado satisfactoriamente', 'success');
      } else {
        await createPlan(payload);
        showMessage('Plan creado satisfactoriamente', 'success');
      }
      await fetchPlanes();
      handleClose();
    } catch {
      showMessage(`Error al ${editingPlan ? 'actualizar' : 'crear'} el plan`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (plan: IPlan) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el plan "${plan.nombre}"? Esta acción no se puede deshacer.`)) return;

    setLoading(true);
    try {
      await deletePlan(plan.id);
      showMessage('Plan eliminado satisfactoriamente', 'success');
      await fetchPlanes();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Error al eliminar el plan';
      showMessage(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const LimiteCelda = ({ valor }: { valor: number }) => (
    <Chip label={formatLimite(valor)} size="small" variant="outlined" />
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer
      title="Planes de Negocio"
      subtitle="Gestiona los planes de suscripción disponibles"
      breadcrumbs={breadcrumbs}
      headerActions={
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
          Nuevo Plan
        </Button>
      }
    >
      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total de planes', value: planes.length },
          { label: 'Planes activos', value: planes.filter(p => p.activo).length },
          { label: 'Planes recomendados', value: planes.filter(p => p.recomendado).length },
        ].map(stat => (
          <Grid item xs={12} sm={4} key={stat.label}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight="bold">{stat.value}</Typography>
                <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ContentCard>
        {loading && planes.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          // ── Vista móvil ─────────────────────────────────────────────────
          <Stack spacing={2}>
            {planes.map(plan => (
              <Card key={plan.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1" fontWeight="bold">{plan.nombre}</Typography>
                        <Chip label={plan.color} color={plan.color as never} size="small" />
                        {plan.recomendado && <Chip label="Recomendado" size="small" color="primary" variant="outlined" />}
                        {!plan.activo && <Chip label="Inactivo" size="small" color="default" />}
                      </Stack>
                      {plan.descripcion && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {plan.descripcion}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEdit(plan)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(plan)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                    <Chip icon={<WorkspacePremium fontSize="small" />} label={formatPrecio(plan.precio)} size="small" />
                    <Chip label={`${formatLimite(plan.limiteLocales)} locales`} size="small" variant="outlined" />
                    <Chip label={`${formatLimite(plan.limiteUsuarios)} usuarios`} size="small" variant="outlined" />
                    <Chip label={`${formatLimite(plan.limiteProductos)} productos`} size="small" variant="outlined" />
                    <Chip label={formatDuracion(plan.duracion)} size="small" variant="outlined" />
                  </Stack>
                </CardContent>
              </Card>
            ))}
            {planes.length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No hay planes registrados
              </Typography>
            )}
          </Stack>
        ) : (
          // ── Vista desktop ────────────────────────────────────────────────
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell align="center">Precio</TableCell>
                  <TableCell align="center">Locales</TableCell>
                  <TableCell align="center">Usuarios</TableCell>
                  <TableCell align="center">Productos</TableCell>
                  <TableCell align="center">Duración</TableCell>
                  <TableCell align="center">Color</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {planes.map(plan => (
                  <TableRow key={plan.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight="medium">{plan.nombre}</Typography>
                        {plan.recomendado && (
                          <Chip label="★" size="small" color="primary" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {plan.descripcion || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight="medium">{formatPrecio(plan.precio)}</Typography>
                    </TableCell>
                    <TableCell align="center"><LimiteCelda valor={plan.limiteLocales} /></TableCell>
                    <TableCell align="center"><LimiteCelda valor={plan.limiteUsuarios} /></TableCell>
                    <TableCell align="center"><LimiteCelda valor={plan.limiteProductos} /></TableCell>
                    <TableCell align="center">
                      <Chip label={formatDuracion(plan.duracion)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={plan.color} color={plan.color as never} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={plan.activo ? 'Activo' : 'Inactivo'}
                        color={plan.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEdit(plan)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(plan)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {planes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No hay planes registrados</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* ── Dialog crear/editar ────────────────────────────────────────────── */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>

          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Nombre"
                {...register('nombre')}
                error={!!errors.nombre}
                helperText={errors.nombre?.message}
                fullWidth
              />

              <TextField
                label="Descripción (opcional)"
                {...register('descripcion')}
                multiline
                rows={2}
                fullWidth
              />

              {/* Precio */}
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="Precio"
                  type="number"
                  {...register('precio', { valueAsNumber: true })}
                  error={!!errors.precio}
                  helperText={errors.precio?.message}
                  disabled={precioNegociable}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={precioNegociable}
                      onChange={e => {
                        setPrecioNegociable(e.target.checked);
                        if (e.target.checked) setValue('precio', 0);
                      }}
                    />
                  }
                  label="Negociable"
                  sx={{ whiteSpace: 'nowrap' }}
                />
              </Stack>

              {/* Moneda */}
              <Controller
                name="moneda"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Moneda</InputLabel>
                    <Select {...field} label="Moneda">
                      {['USD', 'EUR', 'CUP'].map(m => (
                        <MenuItem key={m} value={m}>{m}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              {/* Duración */}
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="Duración (días)"
                  type="number"
                  {...register('duracion', { valueAsNumber: true })}
                  error={!!errors.duracion}
                  helperText={errors.duracion?.message}
                  disabled={duracionNegociable}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={duracionNegociable}
                      onChange={e => {
                        setDuracionNegociable(e.target.checked);
                        if (e.target.checked) setValue('duracion', 30);
                      }}
                    />
                  }
                  label="Negociable"
                  sx={{ whiteSpace: 'nowrap' }}
                />
              </Stack>

              {/* Límites */}
              {(
                [
                  { field: 'limiteLocales', label: 'Límite de locales', state: ilimitadoLocales, setter: setIlimitadoLocales },
                  { field: 'limiteUsuarios', label: 'Límite de usuarios', state: ilimitadoUsuarios, setter: setIlimitadoUsuarios },
                  { field: 'limiteProductos', label: 'Límite de productos', state: ilimitadoProductos, setter: setIlimitadoProductos },
                ] as const
              ).map(({ field, label, state, setter }) => (
                <Stack key={field} direction="row" spacing={2} alignItems="center">
                  <TextField
                    label={label}
                    type="number"
                    {...register(field, { valueAsNumber: true })}
                    error={!!errors[field]}
                    helperText={errors[field]?.message}
                    disabled={state}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={state}
                        onChange={e => {
                          setter(e.target.checked);
                          if (e.target.checked) setValue(field, 1);
                        }}
                      />
                    }
                    label="Ilimitado"
                    sx={{ whiteSpace: 'nowrap' }}
                  />
                </Stack>
              ))}

              {/* Color */}
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.color}>
                    <InputLabel>Color</InputLabel>
                    <Select
                      {...field}
                      label="Color"
                      renderValue={val => (
                        <Chip label={val} color={val as never} size="small" />
                      )}
                    >
                      {MUI_COLORS.map(c => (
                        <MenuItem key={c} value={c}>
                          <Chip label={c} color={c as never} size="small" />
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.color && <FormHelperText>{errors.color.message}</FormHelperText>}
                  </FormControl>
                )}
              />

              {/* Switches */}
              <Stack direction="row" spacing={3}>
                <Controller
                  name="recomendado"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={field.onChange} />}
                      label="Recomendado"
                    />
                  )}
                />
                <Controller
                  name="activo"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={field.onChange} />}
                      label="Activo"
                    />
                  )}
                />
              </Stack>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} color="secondary">Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : editingPlan ? 'Guardar cambios' : 'Crear plan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

    </PageContainer>
  );
}
