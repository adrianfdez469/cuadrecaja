"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { CalendarMonth, Refresh, Today, DateRange, ShowChart } from "@mui/icons-material";
import { BarChart } from '@mui/x-charts/BarChart';
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import axios from "axios";

// Interfaces para los datos del dashboard
interface DashboardResumenMetrics {
  ventas: {
    totalPeriodo: number;
    unidadesVendidas: number;
    gananciaTotal: number;
    productosActivos: number;
  };
  topProductos: {
    nombre: string;
    unidades: number;
  }[];
  topGanancias: {
    nombre: string;
    ganancia: number;
  }[];
  productosMenosVendidos: {
    nombre: string;
    unidades: number;
  }[];
  productosMenosRentables: {
    nombre: string;
    rentabilidad: number;
  }[];
}

interface FilterOptions {
  periodo: 'dia' | 'semana' | 'mes' | 'anio' | 'personalizado';
  fechaInicio?: string;
  fechaFin?: string;
}

export default function DashboardResumenPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [metrics, setMetrics] = useState<DashboardResumenMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    periodo: 'mes',
  });

  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  // Función para obtener las métricas del dashboard
  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.localActual?.id) {
        throw new Error("No hay tienda seleccionada");
      }

      const response = await axios.get(`/api/dashboard/resumen/${user.localActual.id}`, {
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
    if (!loadingContext && user?.localActual) {
      fetchDashboardMetrics();
    }
  }, [loadingContext, user?.localActual?.id]); // Solo se dispara al cambiar de tienda o cargar inicialmente

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [key]: value
      };

      // Si cambia a personalizado y no hay fechas, poner hoy por defecto
      if (key === 'periodo' && value === 'personalizado' && !prev.fechaInicio) {
        const today = new Date().toISOString().split('T')[0];
        newFilters.fechaInicio = today;
        newFilters.fechaFin = today;
      }

      return newFilters;
    });
  };

  const handleRefresh = () => {
    fetchDashboardMetrics();
  };

  // Componente para tarjetas de métricas
  const MetricCard = ({
    title,
    value,
  }: {
    title: string;
    value: string;
  }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography
            variant="h4"
            fontWeight="bold"
            color="text.primary"
            align="center"
          >
            {value}
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );

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

  if (!user?.localActual) {
    return (
      <PageContainer
        title="Resumen del Negocio"
        breadcrumbs={[{ label: 'Inicio', href: '/home' }, { label: 'Resumen del Negocio' }]}
      >
        <Alert severity="warning">
          Selecciona una tienda para ver las métricas del dashboard
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
    { label: 'Resumen del Negocio' }
  ];

  const headerActions = (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'stretch', md: 'center' }}
      sx={{
        width: '100%',
        justifyContent: 'flex-end',
        mt: { xs: 1, sm: 0 } // Separación extra en móvil si es necesario
      }}
    >
      <ToggleButtonGroup
        value={filters.periodo}
        exclusive
        onChange={(_, value) => value && handleFilterChange('periodo', value)}
        size="small"
        color="primary"
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 1,
          '& .MuiToggleButton-root': {
            flex: 1, // En móvil se expanden equitativamente
            px: { xs: 1, sm: 2 },
            py: 0.75,
            fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' },
            whiteSpace: 'nowrap'
          }
        }}
      >
        <ToggleButton value="dia">
          <Today sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: 18 }} />
          Día
        </ToggleButton>
        <ToggleButton value="semana">
          <ShowChart sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: 18 }} />
          {!isMobile && "Semana"}
          {isMobile && "Sem."}
        </ToggleButton>
        <ToggleButton value="mes">
          <CalendarMonth sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: 18 }} />
          Mes
        </ToggleButton>
        <ToggleButton value="anio" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          <CalendarMonth sx={{ mr: 1, fontSize: 18 }} />
          Año
        </ToggleButton>
        <ToggleButton value="personalizado">
          <DateRange sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: 18 }} />
          {isMobile ? "Pers." : "Personalizado"}
        </ToggleButton>
      </ToggleButtonGroup>

      {filters.periodo === 'personalizado' && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            type="date"
            label="Desde"
            value={filters.fechaInicio || ''}
            onChange={(e) => handleFilterChange('fechaInicio', e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              onClick: (e: any) => e.target.showPicker?.()
            }}
            sx={{
              flex: 1,
              minWidth: { xs: 120, sm: 140 },
              '& .MuiInputBase-root': { bgcolor: 'background.paper' },
              '& input': { cursor: 'pointer', fontSize: '0.875rem' }
            }}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            value={filters.fechaFin || ''}
            onChange={(e) => handleFilterChange('fechaFin', e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              onClick: (e: any) => e.target.showPicker?.()
            }}
            sx={{
              flex: 1,
              minWidth: { xs: 120, sm: 140 },
              '& .MuiInputBase-root': { bgcolor: 'background.paper' },
              '& input': { cursor: 'pointer', fontSize: '0.875rem' }
            }}
          />
        </Stack>
      )}

      <IconButton
        onClick={handleRefresh}
        disabled={loading || (filters.periodo === 'personalizado' && !filters.fechaInicio)}
        color="primary"
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          borderRadius: 1,
          '&:hover': { bgcolor: 'primary.dark' },
          '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
          height: 40,
          px: { xs: 2, sm: 3 },
          display: 'flex',
          gap: 1,
          width: { xs: '100%', md: 'auto' },
          boxShadow: 2
        }}
      >
        <Refresh sx={{ fontSize: 20 }} />
        <Typography variant="button" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
          Aplicar
        </Typography>
      </IconButton>
    </Stack>
  );

  return (
    <PageContainer
      title="Resumen del Negocio"
      subtitle={!isMobile ? `Métricas clave de ${user.localActual.nombre}` : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
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
        <Stack spacing={{md: 4}}>
          {/* Métricas principales */}
          <Grid container columnSpacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title={filters.periodo === 'dia' ? "Ventas de hoy" : filters.periodo === 'mes' ? "Ventas del mes" : "Ventas del período"}
                value={formatCurrency(metrics.ventas.totalPeriodo)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Unidades vendidas"
                value={formatNumber(metrics.ventas.unidadesVendidas)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Ganancia estimada"
                value={formatCurrency(metrics.ventas.gananciaTotal)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Productos c/ stock"
                value={formatNumber(metrics.ventas.productosActivos)}
              />
            </Grid>
          </Grid>

          {/* Gráficos y tablas */}
          <Grid container spacing={3}>
            {/* Top 10 productos más vendidos */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 10 productos más vendidos
                  </Typography>
                  {metrics.topProductos.length > 0 ? (
                    <Box sx={{ height: 300, width: '100%' }}>
                      <BarChart
                        dataset={metrics.topProductos}
                        xAxis={[{
                          scaleType: 'band',
                          dataKey: 'nombre',
                          tickLabelStyle: {
                            angle: 45,
                            textAnchor: 'start',
                            fontSize: 12,
                          },
                        }]}
                        series={[{ dataKey: 'unidades', label: 'Unidades vendidas', valueFormatter: (value) => formatNumber(value) }]}
                        height={300}
                        margin={{ top: 10, bottom: 70, left: 40, right: 10 }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">No hay datos disponibles</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Top 10 por ganancia generada */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 10 por ganancia generada
                  </Typography>
                  {metrics.topGanancias.length > 0 ? (
                    <Box sx={{ height: 300, width: '100%' }}>
                      <BarChart
                        dataset={metrics.topGanancias}
                        xAxis={[{
                          scaleType: 'band',
                          dataKey: 'nombre',
                          tickLabelStyle: {
                            angle: 45,
                            textAnchor: 'start',
                            fontSize: 12,
                          },
                        }]}
                        series={[{ dataKey: 'ganancia', label: 'Ganancia', valueFormatter: (value) => formatCurrency(value) }]}
                        height={300}
                        margin={{ top: 10, bottom: 70, left: 40, right: 10 }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">No hay datos disponibles</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Productos menos vendidos */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Productos menos vendidos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Unidades vendidas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {metrics.productosMenosVendidos.map((producto, index) => (
                          <TableRow key={index}>
                            <TableCell>{producto.nombre}</TableCell>
                            <TableCell align="right">{formatNumber(producto.unidades)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Productos menos rentables */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Productos menos rentables
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Rentabilidad</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {metrics.productosMenosRentables.map((producto, index) => (
                          <TableRow key={index}>
                            <TableCell>{producto.nombre}</TableCell>
                            <TableCell align="right">{producto.rentabilidad}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      ) : (
        <Alert severity="info">
          No hay datos disponibles para mostrar
        </Alert>
      )}
    </PageContainer>
  );
}
