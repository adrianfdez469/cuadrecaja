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
  InputAdornment
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
  Refresh
} from "@mui/icons-material";
import { planesNegocio } from "@/utils/planesNegocio";
import { createNegocio, getNegocios, updateNegocio, deleteNegocio } from "@/services/negocioServce";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";
import { INegocio } from "@/types/INegocio";
import { 
  formatDate, 
  formatDaysRemaining, 
  getDaysRemainingColor,
  formatPercentage 
} from "@/utils/formatters";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useRouter } from "next/navigation";
import axios from 'axios';

const planesNegocioArr = Object.entries(planesNegocio);

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
  const [expandedNegocio, setExpandedNegocio] = useState<string | null>(null);
  const [negocioStats, setNegocioStats] = useState<Record<string, NegocioStats>>({});
  const [statsExpanded, setStatsExpanded] = useState(false);
  const { showMessage } = useMessageContext();
  const { user, loadingContext } = useAppContext();

  const [nombre, setNombre] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<{
    limiteLocales: number;
    limiteUsuarios: number;
    limiteProductos: number;
    precio: number;
    descripcion: string;
  }>();

  const router = useRouter();

  const fetchNegocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNegocios();
      setNegocios(data);
    } catch (error) {
      console.log(error);
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
    }
  }, [user]);

  const fetchNegocioStats = async (negocioId: string) => {
    try {
      const response = await axios.get(`/api/negocio/${negocioId}/stats`);
      setNegocioStats(prev => ({
        ...prev,
        [negocioId]: response.data
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
          selectedPlan.limiteLocales, 
          selectedPlan.limiteUsuarios,
          selectedPlan.limiteProductos
        );
        showMessage('Negocio actualizado satisfactoriamente', 'success');
      } else {
        await createNegocio(
          nombre, 
          selectedPlan.limiteLocales, 
          selectedPlan.limiteUsuarios,
          selectedPlan.limiteProductos
        );
        showMessage('Negocio creado satisfactoriamente', 'success');
      }
      
      await fetchNegocios();
      handleCloseDialog();
    } catch (error) {
      console.log(error);
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
      console.log(error);
      const errorMessage = error.response?.data?.error || 'Ocurrió un error al eliminar el negocio';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (negocio: INegocio) => {
    setSelectedNegocio(negocio);
    setNombre(negocio.nombre);
    
    const planKey = Object.keys(planesNegocio).find(key => {
      const plan = planesNegocio[key as keyof typeof planesNegocio];
      return plan.limiteLocales === negocio.locallimit &&
             plan.limiteUsuarios === negocio.userlimit &&
             plan.limiteProductos === negocio.productlimit;
    });
    
    if (planKey) {
      setSelectedPlan(planesNegocio[planKey as keyof typeof planesNegocio]);
    }
    
    setOpen(true);
  };

  const handleSetSelectedPlan = (planKey: string) => {
    setSelectedPlan(planesNegocio[planKey as keyof typeof planesNegocio]);
  };

  const handleCloseDialog = () => {
    setNombre('');
    setSelectedNegocio(null);
    setSelectedPlan(undefined);
    setOpen(false);
  };

  const getPlanName = (locallimit: number, userlimit: number, productlimit: number): string => {
    const planEntry = Object.entries(planesNegocio).find(
      ([, plan]) => plan.limiteLocales === locallimit && 
                   plan.limiteUsuarios === userlimit &&
                   plan.limiteProductos === productlimit
    );
    return planEntry ? planEntry[0] : 'CUSTOM';
  };

  const getDaysRemaining = (limitTime: Date): number => {
    const now = new Date();
    const limit = new Date(limitTime);
    const diffTime = limit.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPlanColor = (planName: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning'> = {
      'FREEMIUM': 'default',
      'BASICO': 'primary',
      'SILVER': 'secondary',
      'PREMIUM': 'success',
      'CUSTOM': 'warning'
    };
    return colors[planName] || 'default';
  };

  const filteredNegocios = negocios.filter((negocio) => {
    const searchLower = searchTerm.toLowerCase();
    const planName = getPlanName(negocio.locallimit, negocio.userlimit, negocio.productlimit);
    
    return negocio.nombre.toLowerCase().includes(searchLower) ||
           planName.toLowerCase().includes(searchLower);
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
    const planName = getPlanName(negocio.locallimit, negocio.userlimit, negocio.productlimit);
    const planData = planesNegocio[planName as keyof typeof planesNegocio];
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
              <Typography variant="caption" color="text.secondary">
                ID: {negocio.id.slice(0, 8)}...
              </Typography>
            </Box>
          </Stack>

          {/* Información del plan */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              label={planName}
              size="small"
              color={getPlanColor(planName)}
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
    { label: 'Inicio', href: '/' },
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
              maxWidth: isMobile ? 200 : 'none'
            }}
          />
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
                  <TableCell>Negocio</TableCell>
                  <TableCell align="center">Plan</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Vencimiento</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredNegocios.map((negocio) => {
                  const days = getDaysRemaining(negocio.limitTime);
                  const planName = getPlanName(negocio.locallimit, negocio.userlimit, negocio.productlimit);
                  const planData = planesNegocio[planName as keyof typeof planesNegocio];
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
                              <Typography variant="caption" color="text.secondary">
                                ID: {negocio.id.slice(0, 8)}...
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Stack alignItems="center" spacing={0.5}>
                            <Chip
                              label={planName}
                              size="small"
                              color={getPlanColor(planName)}
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
                value={selectedPlan ? Object.keys(planesNegocio).find(
                  key => planesNegocio[key as keyof typeof planesNegocio] === selectedPlan
                ) : ''}
                onChange={(e) => handleSetSelectedPlan(e.target.value as string)}
                displayEmpty
                size={isMobile ? "small" : "medium"}
              >
                <MenuItem value="" disabled>
                  Selecciona un plan
                </MenuItem>
                {planesNegocioArr.map(([planKey, planData]) => (
                  <MenuItem key={planKey} value={planKey}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body2" fontWeight="medium">
                          {planKey}
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
                  <strong>Plan seleccionado:</strong> {Object.keys(planesNegocio).find(
                    key => planesNegocio[key as keyof typeof planesNegocio] === selectedPlan
                  )}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {selectedPlan.descripcion}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Validez:</strong> 7 días desde la activación
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
    </PageContainer>
  );
}
