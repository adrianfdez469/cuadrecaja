"use client";

import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { PageContainer } from "@/components/PageContainer";
import { TasasBanner } from "@/components/TasasBanner";
import { ReportPeriodFilter } from "@/components/reports/ReportPeriodFilter";
import { DashboardKpiRow } from "@/components/dashboard/DashboardKpiRow";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import { SimpleRankingTable } from "@/components/dashboard/SimpleRankingTable";
import { DashboardReportLinks } from "@/components/dashboard/DashboardReportLinks";
import { useAppContext } from "@/context/AppContext";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useReportData } from "@/hooks/useReportData";
import { getDashboardResumen } from "@/services/dashboardService";
import { formatNumber } from "@/utils/formatters";
import type { IDashboardSummary } from "@/schemas/reports/dashboardSummary";

export default function DashboardResumenPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { user, loadingContext, tasasVigentes } = useAppContext();
  const filters = useReportFilters();
  const currency = useDisplayCurrency();

  const { data, loading, error, refetch } = useReportData<IDashboardSummary>(
    getDashboardResumen,
    filters.toQuery,
    filters.ready,
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

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Resumen del Negocio" },
  ];

  if (!user?.localActual) {
    return (
      <PageContainer title="Resumen del Negocio" breadcrumbs={breadcrumbs}>
        <Alert severity="warning">
          Selecciona una tienda para ver las métricas del dashboard
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Resumen del Negocio"
      subtitle={
        !isMobile ? `Métricas clave de ${user.localActual.nombre}` : undefined
      }
      breadcrumbs={breadcrumbs}
      maxWidth="xl"
    >
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        <TasasBanner tasas={tasasVigentes} />
        <ReportPeriodFilter
          periodo={filters.filters.periodo}
          onPeriodoChange={filters.setPeriodo}
          fechaInicio={filters.filters.fechaInicio}
          fechaFin={filters.filters.fechaFin}
          onFechaInicioChange={filters.setFechaInicio}
          onFechaFinChange={filters.setFechaFin}
          onRefresh={refetch}
          loading={loading}
          ready={filters.ready}
          displayCurrency={currency.displayCurrency}
          onDisplayCurrencyChange={currency.setDisplayCurrency}
          availableCurrencies={currency.availableCurrencies}
        />
        <DashboardReportLinks />
      </Stack>

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
      ) : data ? (
        <Stack spacing={{ md: 4 }}>
          <DashboardKpiRow
            ventas={data.ventas}
            periodo={filters.filters.periodo}
            format={currency.format}
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopProductsChart
                title="Top 10 productos más vendidos"
                data={data.topProductos}
                valueKey="unidades"
                seriesLabel="Unidades vendidas"
                formatValue={formatNumber}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TopProductsChart
                title="Top 10 por ganancia generada"
                data={data.topGanancias}
                valueKey="ganancia"
                seriesLabel="Ganancia"
                formatValue={currency.format}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleRankingTable
                title="Productos menos vendidos"
                valueLabel="Unidades vendidas"
                rows={data.productosMenosVendidos}
                getName={(row) => row.nombre}
                getValue={(row) => formatNumber(row.unidades)}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SimpleRankingTable
                title="Productos menos rentables"
                valueLabel="Rentabilidad"
                rows={data.productosMenosRentables}
                getName={(row) => row.nombre}
                getValue={(row) => `${row.rentabilidad}%`}
              />
            </Grid>
          </Grid>
        </Stack>
      ) : (
        <Alert severity="info">No hay datos disponibles para mostrar</Alert>
      )}
    </PageContainer>
  );
}
