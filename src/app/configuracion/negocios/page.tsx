"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Select,
  MenuItem,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Collapse,
  Divider,
  InputAdornment,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Add, 
  Business, 
  Store, 
  Person, 
  Inventory,
  Search,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  Schedule,
  Info,
  Refresh,
} from "@mui/icons-material";
import Payments from "@mui/icons-material/Payments";
import { createNegocio, getNegocios, updateNegocio, deleteNegocio, getNegocioStatsById } from "@/services/negocioServce";
import { getPlanes } from "@/services/planService";
import type { IPlan } from "@/schemas/plan";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";
import { INegocio } from "@/schemas/negocio";
import { 
  formatDate, 
  formatDaysRemaining, 
  getDaysRemainingColor,
  formatPercentage 
} from "@/utils/formatters";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useRouter } from "next/navigation";
import { registerFirstPaymentForNegocio } from "@/services/referralAdminService";

interface NegocioStats {
  tiendas: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  usuarios: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  productos: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  fechaVencimiento: Date;
  diasRestantes: number;
}

export default function Negocios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedNegocio, setSelectedNegocio] = useState<INegocio | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  /** Solo negocios creados vía activación desde la landing */
  const [soloActivacionLanding, setSoloActivacionLanding] = useState(false);
  const [expandedNegocio, setExpandedNegocio] = useState<string | null>(null);
  const [negocioStats, setNegocioStats] = useState<Record<string, NegocioStats>>({});
  const [statsExpanded, setStatsExpanded] = useState(false);
  const { showMessage } = useMessageContext();
  const { user, loadingContext } = useAppContext();

  const [nombre, setNombre] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<IPlan | undefined>();
  const [planes, setPlanes] = useState<IPlan[]>([]);

  const [firstPaymentOpen, setFirstPaymentOpen] = useState(false);
  const [fpNegocio, setFpNegocio] = useState<INegocio | null>(null);
  const [fpPlanId, setFpPlanId] = useState("");
  const [fpPaidAt, setFpPaidAt] = useState("");
  const [fpAmount, setFpAmount] = useState("");
  const [fpSubmitting, setFpSubmitting] = useState(false);

  const router = useRouter();

  const fetchNegocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNegocios({ soloActivacionLanding });
      setNegocios(data);
    } catch (error) {
      console.error(error);
      setError('Error al cargar los negocios');
    } finally {
      setLoading(false);
    }
  };

  // Protección: Solo SUPER_ADMIN puede acceder
  useEffect(() => {
    if (!loadingContext && user) {
      if (user.rol !== "SUPER_ADMIN") {
        showMessage("No tienes permisos para acceder a la gestión de negocios", "error");
        router.push("/home");
        return;
      }
    }
  }, [user, loadingContext, router, showMessage]);

  useEffect(() => {
    if (user && user.rol === "SUPER_ADMIN") {
      fetchNegocios();
      getPlanes().then(setPlanes).catch(() => showMessage('Error al cargar los planes', 'error'));
    }
  }, [user, soloActivacionLanding]);

  const fetchNegocioStats = async (negocioId: string) => {
    try {
      const data = await getNegocioStatsById(negocioId);
      setNegocioStats(prev => ({
        ...prev,
        [negocioId]: data
      }));
    } catch (error) {
      console.error('Error al cargar estadísticas del negocio:', error);
      showMessage('Error al cargar estadísticas del negocio', 'error');
    }
  };

  const handleExpandNegocio = (negocioId: string) => {
    if (expandedNegocio === negocioId) {
      setExpandedNegocio(null);
    } else {
      setExpandedNegocio(negocioId);
      if (!negocioStats[negocioId]) {
        fetchNegocioStats(negocioId);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    try {
      if (selectedNegocio) {
        await updateNegocio(
          selectedNegocio.id,
          nombre,
          selectedPlan.id,
        );
        showMessage('Negocio actualizado satisfactoriamente', 'success');
      } else {
        await createNegocio(
          nombre,
          selectedPlan.duracion,
          selectedPlan.id,
        );
        showMessage('Negocio creado satisfactoriamente', 'success');
      }
      
      const negocioId = selectedNegocio?.id;
      await fetchNegocios();
      if (negocioId) {
        if (expandedNegocio === negocioId) {
          fetchNegocioStats(negocioId);
        } else {
          setNegocioStats(prev => {
            const updated = { ...prev };
            delete updated[negocioId];
            return updated;
          });
        }
      }
      handleCloseDialog();
    } catch (error) {
      console.error(error);
      showMessage(`Ocurrió un error al ${selectedNegocio ? 'actualizar' : 'crear'} el negocio`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (negocio: INegocio) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el negocio "${negocio.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteNegocio(negocio.id);
      showMessage('Negocio eliminado satisfactoriamente', 'success');
      await fetchNegocios();
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.error || 'Ocurrió un error al eliminar el negocio';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (negocio: INegocio) => {
    setSelectedNegocio(negocio);
    setNombre(negocio.nombre);

    const matched = planes.find(p => p.id === negocio.planId);
    if (matched) setSelectedPlan(matched);
    setOpen(true);
  };

  const handleSetSelectedPlan = (planId: string) => {
    setSelectedPlan(planes.find(p => p.id === planId));
  };

  const handleCloseDialog = () => {
    setNombre('');
    setSelectedNegocio(null);
    setSelectedPlan(undefined);
    setOpen(false);
  };

  const toLocalDatetimeInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  };

  const openFirstPaymentDialog = (negocio: INegocio) => {
    if (!puedeMostrarBotonPrimerPago(negocio)) {
      showMessage('Este negocio ya está en un plan de pago. No aplica registrar primer pago desde aquí.', 'info');
      return;
    }
    setFpNegocio(negocio);
    const paid =
      planes.find((p) => p.id === negocio.planId && p.precio > 0 && p.activo) ??
      planes.find((p) => p.precio > 0 && p.activo) ??
      planes.find((p) => p.activo);
    setFpPlanId(paid?.id ?? "");
    setFpPaidAt(toLocalDatetimeInput(new Date()));
    setFpAmount("");
    setFirstPaymentOpen(true);
  };

  const closeFirstPaymentDialog = () => {
    setFirstPaymentOpen(false);
    setFpNegocio(null);
  };

  const handleSubmitFirstPayment = async () => {
    if (!fpNegocio || !fpPlanId) {
      showMessage("Selecciona un plan de pago válido.", "error");
      return;
    }
    setFpSubmitting(true);
    try {
      const res = await registerFirstPaymentForNegocio(fpNegocio.id, {
        planId: fpPlanId,
        paidAt: fpPaidAt ? new Date(fpPaidAt).toISOString() : undefined,
        paymentAmount: fpAmount.trim() ? Number.parseFloat(fpAmount) : undefined,
      });
      const r = res.result;
      if (r?.alreadyQualified) {
        showMessage(
          "Este negocio ya tenía registrado el primer pago. No se aplicaron cambios nuevos.",
          "info"
        );
      } else if (r?.qualifiedNow) {
        showMessage(
          r.hasReferral
            ? "Primer pago registrado. Referido calificado y pendiente de liquidación si aplica."
            : "Primer pago registrado. Este negocio no tenía código de referido asociado.",
          "success"
        );
      } else {
        showMessage(res.message ?? "Operación completada.", "success");
      }
      closeFirstPaymentDialog();
      await fetchNegocios();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        err.response?.data?.error ?? err.message ?? "No se pudo registrar el primer pago.";
      showMessage(msg, "error");
    } finally {
      setFpSubmitting(false);
    }
  };

  const getPlanForNegocio = (negocio: INegocio): IPlan | undefined =>
    planes.find(p => p.id === negocio.planId);

  /** Solo negocios aún en plan gratuito/freemium (precio 0 o sin plan): ya en plan de pago no aplica registrar “primer pago” desde aquí. */
  const puedeMostrarBotonPrimerPago = (negocio: INegocio): boolean => {
    const p = getPlanForNegocio(negocio);
    if (!p) return true;
    return p.precio <= 0;
  };

  const getPlanName = (negocio: INegocio): string =>
    getPlanForNegocio(negocio)?.nombre ?? 'Sin plan';

  const getDaysRemaining = (limitTime: Date): number => {
    const now = new Date();
    const limit = new Date(limitTime);
    const diffTime = limit.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPlanColor = (negocio: INegocio) => {
    const color = getPlanForNegocio(negocio)?.color;
    return (color as 'default' | 'primary' | 'secondary' | 'success' | 'warning') || 'default';
  };

  const filteredNegocios = negocios.filter((negocio) => {
    const searchLower = searchTerm.toLowerCase();
    const planName = getPlanName(negocio);
    return (
      negocio.nombre.toLowerCase().includes(searchLower) ||
      planName.toLowerCase().includes(searchLower)
    );
  });

  // Cálculos para estadísticas
  const totalNegocios = negocios.length;
  const negociosActivos = negocios.filter(n => getDaysRemaining(n.limitTime) > 0).length;
  const negociosExpirados = totalNegocios - negociosActivos;
  const negociosVisibles = filteredNegocios.length;

  // Componente para mostrar estadísticas de uso
  const UsageStatsCard = ({ icon, title, actual, limite, porcentaje, color, compact = false }: {
    icon: React.ReactNode;
    title: string;
    actual: number;
    limite: number;
    porcentaje: number;
    color: string;
    compact?: boolean;
  }) => {
    const isUnlimited = limite === -1;
    const isNearLimit = porcentaje >= 80 && !isUnlimited;
    const isOverLimit = porcentaje >= 100 && !isUnlimited;

    return (
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent sx={{ p: compact ? 1.5 : 2 }}>
          <Stack spacing={compact ? 1 : 1.5}>
            {/* Header con icono y título */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  p: compact ? 0.5 : 0.75,
                  borderRadius: 1.5,
                  bgcolor: `${color}.light`,
                  color: `${color}.main`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: compact ? 24 : 32,
                  minHeight: compact ? 24 : 32,
                }}
              >
                {icon}
              </Box>
              <Typography 
                variant={compact ? "caption" : "body2"} 
                fontWeight="medium"
                sx={{ 
                  fontSize: compact ? '0.6875rem' : '0.875rem',
                  lineHeight: 1.2
                }}
              >
                {title}
              </Typography>
            </Stack>

            {/* Números principales */}
            <Box>
              <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.5 }}>
                <Typography 
                  variant={compact ? "h6" : "h5"} 
                  fontWeight="bold"
                  sx={{ 
                    fontSize: compact ? '1rem' : '1.25rem',
                    lineHeight: 1.2
                  }}
                >
                  {actual}
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ fontSize: compact ? '0.625rem' : '0.75rem' }}
                >
                  / {isUnlimited ? '∞' : limite}
                </Typography>
                {!isUnlimited && (
                  <Chip
                    label={formatPercentage(porcentaje)}
                    size="small"
                    color={isOverLimit ? 'error' : isNearLimit ? 'warning' : 'success'}
                    variant="outlined"
                    sx={{ 
                      height: compact ? 16 : 20,
                      fontSize: compact ? '0.625rem' : '0.75rem',
                      '& .MuiChip-label': {
                        px: compact ? 0.5 : 1
                      }
                    }}
                  />
                )}
              </Stack>

              {/* Barra de progreso */}
              {!isUnlimited && (
                <LinearProgress
                  variant="determinate"
                  value={Math.min(porcentaje, 100)}
                  sx={{
                    height: compact ? 4 : 6,
                    borderRadius: 2,
                    backgroundColor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isOverLimit ? 'error.main' : isNearLimit ? 'warning.main' : 'success.main',
                      borderRadius: 2,
                    }
                  }}
                />
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  // Componente de estadística general
  const StatCard = ({ icon, value, label, color }: { 
    icon: React.ReactNode, 
    value: string, 
    label: string, 
    color: string 
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              fontWeight="bold"
              sx={{ 
                fontSize: isMobile ? '1.25rem' : '2rem',
                lineHeight: 1.2,
                wordBreak: 'break-all'
              }}
            >
              {value}
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                lineHeight: 1.2
              }}
            >
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  // Componente de tarjeta de negocio para móviles
  const NegocioCard = ({ negocio }: { negocio: INegocio }) => {
    const days = getDaysRemaining(negocio.limitTime);
    const planName = getPlanName(negocio);
    const planData = getPlanForNegocio(negocio);
    const stats = negocioStats[negocio.id];
    const isExpanded = expandedNegocio === negocio.id;

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          {/* Header de la tarjeta */}
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Business color="primary" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight="bold" noWrap>
                {negocio.nombre}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  ID: {negocio.id.slice(0, 8)}...
                </Typography>
                {negocio.creadoPorActivacionLanding ? (
                  <Chip label="Activación landing" size="small" color="info" variant="outlined" />
                ) : null}
              </Stack>
            </Box>
          </Stack>

          {/* Información del plan */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              label={planName}
              size="small"
              color={getPlanColor(negocio)}
              variant="filled"
            />
            <Chip
              label={days > 0 ? 'Activo' : 'Expirado'}
              size="small"
              color={getDaysRemainingColor(days)}
              variant="filled"
            />
            {planData && planData.precio > 0 && (
              <Typography variant="caption" color="success.main">
                ${planData.precio}/mes
              </Typography>
            )}
          </Stack>

          {/* Información de vencimiento */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium">
              {formatDaysRemaining(days)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Vence el {formatDate(negocio.limitTime)}
            </Typography>
          </Box>

          {/* Botones de acción */}
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={0.5}>
              {puedeMostrarBotonPrimerPago(negocio) && (
                <Tooltip title="Registrar primer pago (módulo referidos)">
                  <IconButton
                    onClick={() => openFirstPaymentDialog(negocio)}
                    size="small"
                    color="success"
                  >
                    <Payments fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Editar negocio">
                <IconButton
                  onClick={() => handleEdit(negocio)}
                  size="small"
                  color="primary"
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Eliminar negocio">
                <IconButton
                  onClick={() => handleDelete(negocio)}
                  size="small"
                  color="error"
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            
            <Tooltip title={isExpanded ? "Ocultar estadísticas" : "Ver estadísticas detalladas"}>
              <IconButton
                onClick={() => handleExpandNegocio(negocio.id)}
                size="small"
                color="info"
              >
                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Estadísticas expandidas */}
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp color="primary" fontSize="small" />
              Estadísticas de Uso
            </Typography>
            
            {stats ? (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Grid container spacing={isMobile ? 2 : 1}>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Store color="primary" fontSize="small" />}
                        title="Tiendas"
                        actual={stats.tiendas.actual}
                        limite={stats.tiendas.limite}
                        porcentaje={stats.tiendas.porcentaje}
                        color="primary"
                        compact={isMobile}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Person color="secondary" fontSize="small" />}
                        title="Usuarios"
                        actual={stats.usuarios.actual}
                        limite={stats.usuarios.limite}
                        porcentaje={stats.usuarios.porcentaje}
                        color="secondary"
                        compact={isMobile}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Inventory color="info" fontSize="small" />}
                        title="Productos"
                        actual={stats.productos.actual}
                        limite={stats.productos.limite}
                        porcentaje={stats.productos.porcentaje}
                        color="info"
                        compact={isMobile}
                      />
                    </Grid>
                  </Grid>
                </Grid>
                
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Stack alignItems="center" spacing={1}>
                        <Schedule color={getDaysRemainingColor(stats.diasRestantes)} sx={{ fontSize: 24 }} />
                        <Typography variant="body2" fontWeight="bold">
                          {formatDaysRemaining(stats.diasRestantes)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vence el {formatDate(stats.fechaVencimiento)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Cargando estadísticas...</Typography>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Negocios' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar negocios">
        <IconButton onClick={fetchNegocios} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {isMobile && (
        <Tooltip title={statsExpanded ? "Ocultar estadísticas" : "Mostrar estadísticas"}>
          <IconButton onClick={() => setStatsExpanded(!statsExpanded)} size="small">
            {statsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      )}
      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => setOpen(true)}
        size="small"
      >
        {isMobile ? "Agregar" : "Agregar Negocio"}
      </Button>
    </Stack>
  );

  if (loading && negocios.length === 0) {
    return (
      <PageContainer
        title="Gestión de Negocios"
        subtitle="Administra los negocios del sistema"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando negocios...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  // Mostrar pantalla de carga mientras se verifica la autorización
  if (loadingContext) {
    return (
      <PageContainer
        title="Gestión de Negocios"
        subtitle="Administra los negocios del sistema"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Verificando permisos...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  // Si no es SUPER_ADMIN, no mostrar nada (la redirección ya se maneja en useEffect)
  if (!user || user.rol !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <PageContainer
      title="Gestión de Negocios"
      subtitle={!isMobile ? "Administra los negocios del sistema y sus planes de suscripción" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de negocios */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<Business fontSize={"medium"} />}
                  value={totalNegocios.toLocaleString()}
                  label="Total Negocios"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<TrendingUp fontSize={"medium"} />}
                  value={negociosActivos.toLocaleString()}
                  label="Activos"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Schedule fontSize={"medium"} />}
                  value={negociosExpirados.toLocaleString()}
                  label="Expirados"
                  color="error.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Search fontSize={"medium"} />}
                  value={negociosVisibles.toLocaleString()}
                  label="Visibles"
                  color="info.light"
                />
              </Grid>
            </Grid>
            <Divider sx={{ mb: 2 }} />
          </Collapse>
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Business fontSize="large" />}
              value={totalNegocios.toLocaleString()}
              label="Total Negocios"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<TrendingUp fontSize="large" />}
              value={negociosActivos.toLocaleString()}
              label="Negocios Activos"
              color="success.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Schedule fontSize="large" />}
              value={negociosExpirados.toLocaleString()}
              label="Negocios Expirados"
              color="error.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Search fontSize="large" />}
              value={negociosVisibles.toLocaleString()}
              label="Resultados Visibles"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ContentCard
        title="Lista de Negocios"
        subtitle={`${filteredNegocios.length} negocio${filteredNegocios.length !== 1 ? 's' : ''} encontrado${filteredNegocios.length !== 1 ? 's' : ''}`}
        headerActions={
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControlLabel
              control={
                <Switch
                  checked={soloActivacionLanding}
                  onChange={(e) => setSoloActivacionLanding(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label="Solo registro por landing"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', whiteSpace: 'nowrap' } }}
            />
            <TextField
              size="small"
              placeholder={isMobile ? "Buscar..." : "Buscar negocio..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: isMobile ? 160 : 250,
                maxWidth: isMobile ? 200 : 'none',
              }}
            />
          </Stack>
        }
        noPadding={isMobile ? false : true}
        fullHeight
      >
        {isMobile ? (
          // Vista móvil con tarjetas
          <Box sx={{ p: 2 }}>
            {filteredNegocios.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  {searchTerm ? 'No se encontraron negocios' : 'No hay negocios registrados'}
                </Typography>
              </Box>
            ) : (
              filteredNegocios.map((negocio) => (
                <NegocioCard key={negocio.id} negocio={negocio} />
              ))
            )}
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Negocio / Origen</TableCell>
                  <TableCell align="center">Plan</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Vencimiento</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredNegocios.map((negocio) => {
                  const days = getDaysRemaining(negocio.limitTime);
                  const planName = getPlanName(negocio);
                  const planData = getPlanForNegocio(negocio);
                  const stats = negocioStats[negocio.id];
                  const isExpanded = expandedNegocio === negocio.id;
                  
                  return (
                    <>
                      <TableRow key={negocio.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Business color="primary" />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {negocio.nombre}
                              </Typography>
                              <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {negocio.id.slice(0, 8)}...
                                </Typography>
                                {negocio.creadoPorActivacionLanding ? (
                                  <Chip label="Activación landing" size="small" color="info" variant="outlined" />
                                ) : null}
                              </Stack>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Stack alignItems="center" spacing={0.5}>
                            <Chip
                              label={planName}
                              size="small"
                              color={getPlanColor(negocio)}
                              variant="filled"
                            />
                            {planData && planData.precio > 0 && (
                              <Typography variant="caption" color="success.main">
                                ${planData.precio}/mes
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={days > 0 ? 'Activo' : 'Expirado'}
                            size="small"
                            color={getDaysRemainingColor(days)}
                            variant="filled"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack alignItems="center" spacing={0.5}>
                            <Typography variant="body2" fontWeight="medium">
                              {formatDaysRemaining(days)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(negocio.limitTime)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title={isExpanded ? "Ocultar estadísticas" : "Ver estadísticas detalladas"}>
                              <IconButton
                                onClick={() => handleExpandNegocio(negocio.id)}
                                size="small"
                                color="info"
                              >
                                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            {puedeMostrarBotonPrimerPago(negocio) && (
                              <Tooltip title="Registrar primer pago (referidos)">
                                <IconButton
                                  onClick={() => openFirstPaymentDialog(negocio)}
                                  size="small"
                                  color="success"
                                >
                                  <Payments fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Editar negocio">
                              <IconButton
                                onClick={() => handleEdit(negocio)}
                                size="small"
                                color="primary"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar negocio">
                              <IconButton
                                onClick={() => handleDelete(negocio)}
                                size="small"
                                color="error"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 2 }}>
                              <Typography variant="h6" gutterBottom component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUp color="primary" />
                                Estadísticas de Uso - {negocio.nombre}
                              </Typography>
                              
                              {stats ? (
                                <Grid container spacing={3}>
                                  <Grid item xs={12} md={9}>
                                    <Grid container spacing={2}>
                                      <Grid item xs={12} sm={4}>
                                        <UsageStatsCard
                                          icon={<Store color="primary" />}
                                          title="Tiendas"
                                          actual={stats.tiendas.actual}
                                          limite={stats.tiendas.limite}
                                          porcentaje={stats.tiendas.porcentaje}
                                          color="primary"
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={4}>
                                        <UsageStatsCard
                                          icon={<Person color="secondary" />}
                                          title="Usuarios"
                                          actual={stats.usuarios.actual}
                                          limite={stats.usuarios.limite}
                                          porcentaje={stats.usuarios.porcentaje}
                                          color="secondary"
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={4}>
                                        <UsageStatsCard
                                          icon={<Inventory color="info" />}
                                          title="Productos"
                                          actual={stats.productos.actual}
                                          limite={stats.productos.limite}
                                          porcentaje={stats.productos.porcentaje}
                                          color="info"
                                        />
                                      </Grid>
                                    </Grid>
                                  </Grid>
                                  
                                  <Grid item xs={12} md={3}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                      <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                        <Stack alignItems="center" spacing={1}>
                                          <Schedule color={getDaysRemainingColor(stats.diasRestantes)} sx={{ fontSize: 32 }} />
                                          <Typography variant="h6" fontWeight="bold">
                                            {formatDaysRemaining(stats.diasRestantes)}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Vence el {formatDate(stats.fechaVencimiento)}
                                          </Typography>
                                          <Chip
                                            label={stats.diasRestantes <= 0 ? 'Expirado' : 'Activo'}
                                            color={getDaysRemainingColor(stats.diasRestantes)}
                                            variant="filled"
                                            size="small"
                                          />
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  </Grid>
                                </Grid>
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                                  <CircularProgress size={20} />
                                  <Typography variant="body2">Cargando estadísticas...</Typography>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredNegocios.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  {searchTerm ? 'No se encontraron negocios' : 'No hay negocios registrados'}
                </Typography>
              </Box>
            )}
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog para crear/editar negocio */}
      <Dialog 
        open={open} 
        onClose={handleCloseDialog} 
        fullWidth 
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 2
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Business />
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={600}>
              {selectedNegocio ? "Editar Negocio" : "Agregar Negocio"}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? 1.5 : 3, py: isMobile ? 1 : 2 }}>
          <Stack spacing={isMobile ? 2 : 3} sx={{ mt: 0.5 }}>
            <TextField
              label="Nombre del Negocio"
              fullWidth
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingresa el nombre del negocio"
              required
              size={isMobile ? "small" : "medium"}
            />
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Plan de Suscripción
              </Typography>
              <Select
                fullWidth
                value={selectedPlan?.id ?? ''}
                onChange={(e) => handleSetSelectedPlan(e.target.value as string)}
                displayEmpty
                size={isMobile ? "small" : "medium"}
              >
                <MenuItem value="" disabled>
                  Selecciona un plan
                </MenuItem>
                {planes.map((planData) => (
                  <MenuItem key={planData.id} value={planData.id}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body2" fontWeight="medium">
                          {planData.nombre}
                        </Typography>
                        {planData.precio > 0 && (
                          <Chip
                            label={`$${planData.precio} USD`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {planData.descripcion}
                      </Typography>
                      <Box display="flex" gap={1} mt={0.5}>
                        <Chip
                          icon={<Store />}
                          label={`${planData.limiteLocales === -1 ? '∞' : planData.limiteLocales} tiendas`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<Person />}
                          label={`${planData.limiteUsuarios === -1 ? '∞' : planData.limiteUsuarios} usuarios`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<Inventory />}
                          label={`${planData.limiteProductos === -1 ? '∞' : planData.limiteProductos} productos`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {selectedPlan && (
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2">
                  <strong>Plan seleccionado:</strong> {selectedPlan.nombre}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {selectedPlan.descripcion}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Validez:</strong> {selectedPlan.duracion > 0 ? selectedPlan.duracion : 'Cantidad personalizable de'} días desde la activación
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 1.5 : 3, gap: 1 }}>
          <Button onClick={handleCloseDialog} color="secondary" size={isMobile ? "medium" : "large"}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!nombre || !selectedPlan || loading}
            size={isMobile ? "medium" : "large"}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              selectedNegocio ? "Actualizar" : "Crear"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={firstPaymentOpen}
        onClose={() => !fpSubmitting && closeFirstPaymentDialog()}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 2,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Payments color="success" />
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={600}>
              Registrar primer pago (referidos)
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? 1.5 : 3, py: isMobile ? 1 : 2 }}>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Negocio: <strong>{fpNegocio?.nombre ?? "—"}</strong>
            </Typography>
            <Alert severity="info" icon={<Info />}>
              Marca el plan que contrató el cliente al pagar en efectivo. Si había referido, se califica y se
              generan los montos según la tabla de reglas. Requiere una regla activa por plan en base de datos.
            </Alert>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Plan pagado
              </Typography>
              <Select
                fullWidth
                value={fpPlanId}
                onChange={(e) => setFpPlanId(e.target.value as string)}
                displayEmpty
                size={isMobile ? "small" : "medium"}
              >
                <MenuItem value="" disabled>
                  Selecciona un plan
                </MenuItem>
                {planes
                  .filter((p) => p.activo)
                  .map((planData) => (
                    <MenuItem key={planData.id} value={planData.id}>
                      {planData.nombre}
                      {planData.precio > 0 ? ` — $${planData.precio}` : ""}
                    </MenuItem>
                  ))}
              </Select>
            </Box>
            <TextField
              label="Fecha y hora del pago"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={fpPaidAt}
              onChange={(e) => setFpPaidAt(e.target.value)}
              size={isMobile ? "small" : "medium"}
            />
            <TextField
              label="Monto cobrado (opcional, referencia)"
              type="number"
              fullWidth
              value={fpAmount}
              onChange={(e) => setFpAmount(e.target.value)}
              inputProps={{ min: 0, step: "0.01" }}
              size={isMobile ? "small" : "medium"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 1.5 : 3, gap: 1 }}>
          <Button onClick={closeFirstPaymentDialog} color="secondary" disabled={fpSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmitFirstPayment}
            variant="contained"
            color="success"
            disabled={!fpPlanId || fpSubmitting}
          >
            {fpSubmitting ? <CircularProgress size={22} /> : "Confirmar primer pago"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
