"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  CalendarMonth,
  Refresh,
  Today,
  DateRange,
  ShowChart,
} from "@mui/icons-material";
import { BarChart } from "@mui/x-charts/BarChart";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { TasasBanner } from "@/components/TasasBanner";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { convertFromBase } from "@/lib/currency";
import { getDashboardResumen } from "@/services/dashboardService";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";

// Interfaces para los datos del dashboard
interface DashboardResumenMetrics {
  ventas: {
    totalPeriodo: number;
    unidadesVendidas: number;
    gananciaTotal: number;
    totalGastos: number;
    gananciaFinal: number;
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
  periodo: "dia" | "semana" | "mes" | "anio" | "personalizado";
  fechaInicio?: Dayjs | null;
  fechaFin?: Dayjs | null;
}

export default function DashboardResumenPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [metrics, setMetrics] = useState<DashboardResumenMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    periodo: "mes",
    fechaInicio: null,
    fechaFin: null,
  });

  const { user, loadingContext, monedasNegocio, tasasVigentes, monedaBase } =
    useAppContext();
  const { showMessage } = useMessageContext();

  const [displayCurrency, setDisplayCurrency] = useState<string>(monedaBase);
  useEffect(() => {
    setDisplayCurrency(monedaBase);
  }, [monedaBase]);

  const availableCurrencies = [
    monedaBase,
    ...monedasNegocio
      .filter((m) => m.activo && m.monedaCode !== monedaBase)
      .map((m) => m.monedaCode),
  ];
  const hasMultipleCurrencies = availableCurrencies.length > 1;
  const fmtS = (amt: number) =>
    formatCurrency(
      convertFromBase(amt, displayCurrency, tasasVigentes, monedaBase),
    );

  // Función para obtener las métricas del dashboard
  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.localActual?.id) {
        throw new Error("No hay tienda seleccionada");
      }

      const data = await getDashboardResumen(
        user.localActual.id,
        filters as unknown as Record<string, unknown>,
      );
      setMetrics(data);
    } catch (error) {
      console.error("Error al obtener métricas del dashboard:", error);
      setError("Error al cargar las métricas del dashboard");
      showMessage("Error al cargar las métricas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingContext || !user?.localActual) return;
    // En "personalizado" solo se dispara cuando ambas fechas están definidas
    if (
      filters.periodo === "personalizado" &&
      (!filters.fechaInicio || !filters.fechaFin)
    ) {
      return;
    }
    fetchDashboardMetrics();
  }, [
    loadingContext,
    user?.localActual?.id,
    filters.periodo,
    filters.fechaInicio,
    filters.fechaFin,
  ]); // Se dispara al cambiar de tienda o al cambiar cualquier filtro

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [key]: value,
      };

      // Si cambia a personalizado y no hay fechas, poner hoy por defecto
      if (key === "periodo" && value === "personalizado" && !prev.fechaInicio) {
        const today = new Date().toISOString().split("T")[0];
        newFilters.fechaInicio = dayjs(today);
        newFilters.fechaFin = dayjs(today);
      }

      return newFilters;
    });
  };

  const handleRefresh = () => {
    fetchDashboardMetrics();
  };

  // Componente para tarjetas de métricas
  const MetricCard = ({ title, value }: { title: string; value: string }) => (
    <Card sx={{ height: "100%", position: "relative", overflow: "visible" }}>
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
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
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
        breadcrumbs={[
          { label: "Inicio", href: "/home" },
          { label: "Resumen del Negocio" },
        ]}
      >
        <Alert severity="warning">
          Selecciona una tienda para ver las métricas del dashboard
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Resumen del Negocio" },
  ];

  return (
    <PageContainer
      title="Resumen del Negocio"
      subtitle={
        !isMobile ? `Métricas clave de ${user.localActual.nombre}` : undefined
      }
      breadcrumbs={breadcrumbs}
      maxWidth="xl"
    >
      {isMobile ? (
        // Mobile: layout original (columna única), sin botón "Aplicar" manual —
        // los filtros disparan fetchDashboardMetrics solos vía el useEffect de arriba.
        <Stack spacing={1.5} alignItems="stretch" sx={{ width: "100%", mb: 3 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
          >
            {hasMultipleCurrencies && (
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  displayEmpty
                >
                  {availableCurrencies.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Tooltip title="Actualizar datos">
              <IconButton
                onClick={handleRefresh}
                disabled={
                  loading ||
                  (filters.periodo === "personalizado" &&
                    (!filters.fechaInicio || !filters.fechaFin))
                }
                color="primary"
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>

          <TasasBanner tasas={tasasVigentes} />

          <ToggleButtonGroup
            value={filters.periodo}
            exclusive
            onChange={(_, value) =>
              value && handleFilterChange("periodo", value)
            }
            size="small"
            color="primary"
            sx={{
              bgcolor: "background.paper",
              boxShadow: 1,
              "& .MuiToggleButton-root": {
                flex: 1, // En móvil se expanden equitativamente
                px: 1,
                py: 0.75,
                fontSize: "0.7rem",
                whiteSpace: "nowrap",
              },
            }}
          >
            <ToggleButton value="dia">
              <Today sx={{ mr: 0.5, fontSize: 18 }} />
              Día
            </ToggleButton>
            <ToggleButton value="semana">
              <ShowChart sx={{ mr: 0.5, fontSize: 18 }} />
              Sem.
            </ToggleButton>
            <ToggleButton value="mes">
              <CalendarMonth sx={{ mr: 0.5, fontSize: 18 }} />
              Mes
            </ToggleButton>
            <ToggleButton value="anio">
              <CalendarMonth sx={{ mr: 0.5, fontSize: 18 }} />
              Año
            </ToggleButton>
            <ToggleButton value="personalizado">
              <DateRange sx={{ mr: 0.5, fontSize: 18 }} />
              Pers.
            </ToggleButton>
          </ToggleButtonGroup>

          {filters.periodo === "personalizado" && (
            <Stack direction="row" spacing={1} alignItems="center">
              <DatePicker
                label="Desde"
                value={filters.fechaInicio}
                onChange={(d) =>
                  setFilters((prev) => ({ ...prev, fechaInicio: d }))
                }
                slotProps={{ textField: { fullWidth: true, size: "small" } }}
              />
              <DatePicker
                label="Hasta"
                value={filters.fechaFin}
                onChange={(d) =>
                  setFilters((prev) => ({ ...prev, fechaFin: d }))
                }
                slotProps={{ textField: { fullWidth: true, size: "small" } }}
              />
            </Stack>
          )}
        </Stack>
      ) : (
        // Desktop: título en su fila (arriba), filtros repartidos en filas propias.
        <Stack spacing={1.5} alignItems="flex-start" sx={{ mb: 3 }}>
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: "100%" }}
          >
            <TasasBanner tasas={tasasVigentes} />

            <Stack direction="row" spacing={1} alignItems="center">
              {hasMultipleCurrencies && (
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <Select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value)}
                    displayEmpty
                  >
                    {availableCurrencies.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Tooltip title="Actualizar datos">
                <IconButton
                  onClick={handleRefresh}
                  disabled={
                    loading ||
                    (filters.periodo === "personalizado" &&
                      (!filters.fechaInicio || !filters.fechaFin))
                  }
                  color="primary"
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
            alignItems="center"
          >
            <ToggleButtonGroup
              value={filters.periodo}
              exclusive
              onChange={(_, value) =>
                value && handleFilterChange("periodo", value)
              }
              size="small"
              color="primary"
              sx={{
                bgcolor: "background.paper",
                boxShadow: 1,
                "& .MuiToggleButton-root": {
                  px: 2,
                  py: 0.75,
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                },
              }}
            >
              <ToggleButton value="dia">
                <Today sx={{ mr: 1, fontSize: 18 }} />
                Día
              </ToggleButton>
              <ToggleButton value="semana">
                <ShowChart sx={{ mr: 1, fontSize: 18 }} />
                Semana
              </ToggleButton>
              <ToggleButton value="mes">
                <CalendarMonth sx={{ mr: 1, fontSize: 18 }} />
                Mes
              </ToggleButton>
              <ToggleButton value="anio">
                <CalendarMonth sx={{ mr: 1, fontSize: 18 }} />
                Año
              </ToggleButton>
              <ToggleButton value="personalizado">
                <DateRange sx={{ mr: 1, fontSize: 18 }} />
                Personalizado
              </ToggleButton>
            </ToggleButtonGroup>

            {filters.periodo === "personalizado" && (
              <Stack
                direction="row"
                flexWrap="wrap"
                spacing={1}
                alignItems="center"
              >
                <DatePicker
                  label="Desde"
                  value={filters.fechaInicio}
                  onChange={(d) =>
                    setFilters((prev) => ({ ...prev, fechaInicio: d }))
                  }
                  slotProps={{
                    textField: { size: "small", sx: { width: 160 } },
                  }}
                />
                <DatePicker
                  label="Hasta"
                  value={filters.fechaFin}
                  onChange={(d) =>
                    setFilters((prev) => ({ ...prev, fechaFin: d }))
                  }
                  slotProps={{
                    textField: { size: "small", sx: { width: 160 } },
                  }}
                />
              </Stack>
            )}
          </Stack>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando métricas...
          </Typography>
        </Box>
      ) : metrics ? (
        <Stack spacing={{ md: 4 }}>
          {/* Métricas principales */}
          <Grid container columnSpacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title={
                  filters.periodo === "dia"
                    ? "Ventas de hoy"
                    : filters.periodo === "mes"
                      ? "Ventas del mes"
                      : "Ventas del período"
                }
                value={fmtS(metrics.ventas.totalPeriodo)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Ganancia estimada"
                value={fmtS(
                  metrics.ventas.gananciaFinal ?? metrics.ventas.gananciaTotal,
                )}
              />
            </Grid>

            {(metrics.ventas.totalGastos || 0) > 0 && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <MetricCard
                  title="Gastos"
                  value={fmtS(metrics.ventas.totalGastos)}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Unidades vendidas"
                value={formatNumber(metrics.ventas.unidadesVendidas)}
              />
            </Grid>
          </Grid>

          {/* Gráficos y tablas */}
          <Grid container spacing={3}>
            {/* Top 10 productos más vendidos */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 10 productos más vendidos
                  </Typography>
                  {metrics.topProductos.length > 0 ? (
                    <Box sx={{ width: "100%" }}>
                      <BarChart
                        dataset={metrics.topProductos}
                        layout="horizontal"
                        yAxis={[
                          { scaleType: "band", dataKey: "nombre", width: 160 },
                        ]}
                        xAxis={[
                          { valueFormatter: (value) => formatNumber(value) },
                        ]}
                        series={[
                          {
                            dataKey: "unidades",
                            label: "Unidades vendidas",
                            valueFormatter: (value) => formatNumber(value),
                          },
                        ]}
                        barLabel={(item) =>
                          item.value != null ? formatNumber(item.value) : null
                        }
                        height={350}
                        margin={{ top: 10, bottom: 20, left: 10, right: 10 }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">No hay datos disponibles</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Top 10 por ganancia generada */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 10 por ganancia generada
                  </Typography>
                  {metrics.topGanancias.length > 0 ? (
                    <Box sx={{ width: "100%" }}>
                      <BarChart
                        dataset={metrics.topGanancias}
                        layout="horizontal"
                        yAxis={[
                          { scaleType: "band", dataKey: "nombre", width: 160 },
                        ]}
                        xAxis={[{ valueFormatter: (value) => fmtS(value) }]}
                        series={[
                          {
                            dataKey: "ganancia",
                            label: "Ganancia",
                            valueFormatter: (value) => fmtS(value),
                          },
                        ]}
                        barLabel={(item) =>
                          item.value != null ? fmtS(item.value) : null
                        }
                        height={350}
                        margin={{ top: 10, bottom: 20, left: 10, right: 10 }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">No hay datos disponibles</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Productos menos vendidos */}
            <Grid size={{ xs: 12, md: 6 }}>
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
                        {metrics.productosMenosVendidos.map(
                          (producto, index) => (
                            <TableRow key={index}>
                              <TableCell>{producto.nombre}</TableCell>
                              <TableCell align="right">
                                {formatNumber(producto.unidades)}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Productos menos rentables */}
            <Grid size={{ xs: 12, md: 6 }}>
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
                        {metrics.productosMenosRentables.map(
                          (producto, index) => (
                            <TableRow key={index}>
                              <TableCell>{producto.nombre}</TableCell>
                              <TableCell align="right">
                                {producto.rentabilidad}%
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      ) : (
        <Alert severity="info">No hay datos disponibles para mostrar</Alert>
      )}
    </PageContainer>
  );
}
