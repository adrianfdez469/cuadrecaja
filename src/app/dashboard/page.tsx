"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Divider,
  Paper,
  Avatar,
  LinearProgress,
  Collapse,
  IconButton,
  Tooltip
} from "@mui/material";
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  Inventory,
  Store,
  Person,
  ShoppingCart,
  Assessment,
  CalendarToday,
  FilterList,
  Refresh,
  ExpandMore,
  ExpandLess,
  Schedule,
  Warning,
  CheckCircle,
  Info,
  Business,
  Analytics
} from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
import axios from "axios";

// Interfaces para los datos del dashboard
interface DashboardMetrics {
  ventas: {
    totalPeriodoActual: number;
    totalHoy: number;
    cantidadVentasHoy: number;
    cantidadVentasPeriodo: number;
    promedioVentaDiaria: number;
    crecimientoVentas: number;
  };
  inventario: {
    totalProductos: number;
    productosConStock: number;
    productosSinStock: number;
    valorTotalInventario: number;
    productosStockBajo: number;
  };
  movimientos: {
    totalMovimientos: number;
    movimientosHoy: number;
    entradasHoy: number;
    salidasHoy: number;
  };
  general: {
    diasPeriodoActual: number;
    fechaInicioPeriodo: Date;
    tiendaActual: string;
    ultimaActualizacion: Date;
  };
}

interface FilterOptions {
  periodo: 'hoy' | 'semana' | 'mes' | 'periodo' | 'personalizado';
  tienda: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export default function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    periodo: 'periodo',
    tienda: 'actual'
  });
  
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  // Función para obtener las métricas del dashboard
  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.tiendaActual?.id) {
        throw new Error("No hay tienda seleccionada");
      }

      const response = await axios.get(`/api/dashboard/metrics/${user.tiendaActual.id}`, {
        params: filters
      });
      
      setMetrics(response.data);
    } catch (error) {
      console.error("Error al obtener métricas del dashboard:", error);
      setError("Error al cargar las métricas del dashboard");
      showMessage("Error al cargar las métricas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext && user?.tiendaActual) {
      fetchDashboardMetrics();
    }
  }, [loadingContext, user, filters]);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRefresh = () => {
    fetchDashboardMetrics();
  };

  // Componente para tarjetas de métricas
  const MetricCard = ({ 
    icon, 
    title, 
    value, 
    subtitle, 
    color, 
    trend, 
    trendValue,
    size = "normal"
  }: {
    icon: React.ReactNode;
    title: string;
    value: string;
    subtitle?: string;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    size?: 'normal' | 'large';
  }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent sx={{ p: size === 'large' ? 3 : 2 }}>
        <Stack spacing={1.5}>
          {/* Header con icono y tendencia */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 48,
                minHeight: 48,
              }}
            >
              {icon}
            </Box>
            {trend && trendValue && (
              <Stack alignItems="center" spacing={0.5}>
                {trend === 'up' && <TrendingUp color="success" fontSize="small" />}
                {trend === 'down' && <TrendingDown color="error" fontSize="small" />}
                {trend === 'neutral' && <Info color="info" fontSize="small" />}
                <Typography 
                  variant="caption" 
                  color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'info.main'}
                  fontWeight="bold"
                >
                  {trendValue}
                </Typography>
              </Stack>
            )}
          </Stack>

          {/* Valor principal */}
          <Typography 
            variant={size === 'large' ? "h3" : "h4"} 
            fontWeight="bold"
            color="text.primary"
          >
            {value}
          </Typography>

          {/* Título y subtítulo */}
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary" fontWeight="medium">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  // Componente para gráfico de progreso
  const ProgressMetric = ({ 
    title, 
    current, 
    total, 
    color, 
    icon,
    format = 'number'
  }: {
    title: string;
    current: number;
    total: number;
    color: string;
    icon: React.ReactNode;
    format?: 'number' | 'currency';
  }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const formatValue = (value: number) => format === 'currency' ? formatCurrency(value) : formatNumber(value);
    
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ color: color }}>
                {icon}
              </Box>
              <Typography variant="body2" fontWeight="medium">
                {title}
              </Typography>
            </Stack>
            
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight="bold">
                  {formatValue(current)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatValue(total)}
                </Typography>
              </Stack>
              
              <LinearProgress 
                variant="determinate" 
                value={Math.min(percentage, 100)} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 4
                  }
                }}
              />
              
              <Typography variant="caption" color="text.secondary" textAlign="center">
                {percentage.toFixed(1)}% completado
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  if (loadingContext) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size="3rem" />
        <Typography variant="body1" sx={{ mt: 2, ml: 2 }}>
          Cargando dashboard...
        </Typography>
      </Box>
    );
  }

  if (!user?.tiendaActual) {
    return (
      <PageContainer
        title="Dashboard Ejecutivo"
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Dashboard' }]}
      >
        <Alert severity="warning">
          Selecciona una tienda para ver las métricas del dashboard
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Dashboard Ejecutivo' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Actualizar métricas">
        <IconButton onClick={handleRefresh} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      <Tooltip title={filtersExpanded ? "Ocultar filtros" : "Mostrar filtros"}>
        <IconButton onClick={() => setFiltersExpanded(!filtersExpanded)} size="small">
          <FilterList />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <PageContainer
      title="Dashboard Ejecutivo"
      subtitle={!isMobile ? `Métricas clave de ${user.tiendaActual.nombre}` : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Filtros */}
      <Collapse in={filtersExpanded}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList color="primary" />
              Filtros de Dashboard
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Período</InputLabel>
                  <Select
                    value={filters.periodo}
                    label="Período"
                    onChange={(e) => handleFilterChange('periodo', e.target.value)}
                  >
                    <MenuItem value="hoy">Hoy</MenuItem>
                    <MenuItem value="semana">Esta Semana</MenuItem>
                    <MenuItem value="mes">Este Mes</MenuItem>
                    <MenuItem value="periodo">Período Actual</MenuItem>
                    <MenuItem value="personalizado">Personalizado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tienda</InputLabel>
                  <Select
                    value={filters.tienda}
                    label="Tienda"
                    onChange={(e) => handleFilterChange('tienda', e.target.value)}
                  >
                    <MenuItem value="actual">Tienda Actual</MenuItem>
                    {user.tiendas.map((tienda) => (
                      <MenuItem key={tienda.id} value={tienda.id}>
                        {tienda.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {filters.periodo === 'personalizado' && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Fecha Inicio"
                      value={filters.fechaInicio || ''}
                      onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Fecha Fin"
                      value={filters.fechaFin || ''}
                      onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Stack>
        </Paper>
      </Collapse>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando métricas...
          </Typography>
        </Box>
      ) : metrics ? (
        <Stack spacing={4}>
          {/* Métricas principales de ventas */}
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Receipt color="primary" />
              Métricas de Ventas
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<AttachMoney />}
                  title="Ventas del Período"
                  value={formatCurrency(metrics.ventas.totalPeriodoActual)}
                  subtitle={`${metrics.ventas.cantidadVentasPeriodo} transacciones`}
                  color="success.main"
                  trend="up"
                  trendValue={`+${metrics.ventas.crecimientoVentas.toFixed(1)}%`}
                  size="large"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<CalendarToday />}
                  title="Ventas de Hoy"
                  value={formatCurrency(metrics.ventas.totalHoy)}
                  subtitle={`${metrics.ventas.cantidadVentasHoy} transacciones`}
                  color="info.main"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<TrendingUp />}
                  title="Promedio Diario"
                  value={formatCurrency(metrics.ventas.promedioVentaDiaria)}
                  subtitle={`En ${metrics.general.diasPeriodoActual} días`}
                  color="primary.main"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<Assessment />}
                  title="Período Actual"
                  value={`${metrics.general.diasPeriodoActual} días`}
                  subtitle={`Desde ${formatDate(metrics.general.fechaInicioPeriodo)}`}
                  color="warning.main"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Métricas de inventario */}
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Inventory color="primary" />
              Inventario y Stock
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<ShoppingCart />}
                  title="Total Productos"
                  value={formatNumber(metrics.inventario.totalProductos)}
                  subtitle="En catálogo"
                  color="primary.main"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<CheckCircle />}
                  title="Con Stock"
                  value={formatNumber(metrics.inventario.productosConStock)}
                  subtitle="Disponibles"
                  color="success.main"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<Warning />}
                  title="Sin Stock"
                  value={formatNumber(metrics.inventario.productosSinStock)}
                  subtitle="Requieren reposición"
                  color="error.main"
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  icon={<AttachMoney />}
                  title="Valor Inventario"
                  value={formatCurrency(metrics.inventario.valorTotalInventario)}
                  subtitle="Valor total en stock"
                  color="info.main"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Métricas de movimientos */}
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Analytics color="primary" />
              Actividad y Movimientos
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ProgressMetric
                  title="Productos con Stock Bajo"
                  current={metrics.inventario.productosStockBajo}
                  total={metrics.inventario.totalProductos}
                  color="warning.main"
                  icon={<Warning />}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <ProgressMetric
                  title="Cobertura de Stock"
                  current={metrics.inventario.productosConStock}
                  total={metrics.inventario.totalProductos}
                  color="success.main"
                  icon={<CheckCircle />}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Información del sistema */}
          <Box>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Store />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Tienda Actual
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {metrics.general.tiendaActual}
                  </Typography>
                </Box>
              </Stack>
              
              <Stack alignItems="flex-end">
                <Typography variant="body2" color="text.secondary">
                  Última actualización
                </Typography>
                <Typography variant="body2">
                  {formatDate(metrics.general.ultimaActualizacion)}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      ) : (
        <Alert severity="info">
          No hay datos disponibles para mostrar
        </Alert>
      )}
    </PageContainer>
  );
} 