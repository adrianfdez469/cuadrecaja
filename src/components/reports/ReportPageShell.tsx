"use client";

import { ReactNode } from "react";
import { Alert, Box, CircularProgress, Stack } from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import { TasasBanner } from "@/components/TasasBanner";
import { useAppContext } from "@/context/AppContext";
import { ReportPeriodFilter } from "./ReportPeriodFilter";
import { ReportMetaFooter } from "./ReportMetaFooter";
import type { IReportMeta } from "@/schemas/reports/common";
import type { useReportFilters } from "@/hooks/useReportFilters";
import type { useDisplayCurrency } from "@/hooks/useDisplayCurrency";

type ReportPageShellProps = {
  title: string;
  subtitle?: string;
  filters: ReturnType<typeof useReportFilters>;
  currency: ReturnType<typeof useDisplayCurrency>;
  loading: boolean;
  error: string | null;
  meta: IReportMeta | null;
  onRefresh: () => void;
  children: ReactNode;
};

/**
 * Shared frame for the report pages: breadcrumbs, period and currency filters,
 * loading/error states and the provenance footer. Keeps each page focused on
 * its own charts and tables.
 */
export function ReportPageShell({
  title,
  subtitle,
  filters,
  currency,
  loading,
  error,
  meta,
  onRefresh,
  children,
}: ReportPageShellProps) {
  const { user, loadingContext, tasasVigentes } = useAppContext();

  if (loadingContext) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress size="3rem" />
      </Box>
    );
  }

  if (!user?.localActual) {
    return (
      <PageContainer
        title={title}
        breadcrumbs={[
          { label: "Inicio", href: "/home" },
          { label: "Reportes", href: "/reportes" },
          { label: title },
        ]}
      >
        <Alert severity="warning">
          Selecciona una tienda para ver este reporte
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title}
      subtitle={subtitle}
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        { label: "Reportes", href: "/reportes" },
        { label: title },
      ]}
      maxWidth="xl"
    >
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TasasBanner tasas={tasasVigentes} />
        <ReportPeriodFilter
          periodo={filters.filters.periodo}
          onPeriodoChange={filters.setPeriodo}
          fechaInicio={filters.filters.fechaInicio}
          fechaFin={filters.filters.fechaFin}
          onFechaInicioChange={filters.setFechaInicio}
          onFechaFinChange={filters.setFechaFin}
          onRefresh={onRefresh}
          loading={loading}
          ready={filters.ready}
          displayCurrency={currency.displayCurrency}
          onDisplayCurrencyChange={currency.setDisplayCurrency}
          availableCurrencies={currency.availableCurrencies}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {children}
          <ReportMetaFooter meta={meta} />
        </>
      )}
    </PageContainer>
  );
}
