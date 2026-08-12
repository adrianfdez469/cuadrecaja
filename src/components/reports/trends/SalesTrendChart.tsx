"use client";

import { Alert, useMediaQuery, useTheme } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { ContentCard } from "@/components/ContentCard";
import type { ISalesTrendPoint } from "@/schemas/reports/salesTrends";
import type { IReportBucketing } from "@/schemas/reports/common";

/**
 * Short axis labels for narrow screens: "30k", "1,3M".
 *
 * Hand-rolled rather than `Intl` compact notation, which in Spanish renders
 * "30 mil" — exactly as wide as "30.000", so it would save nothing.
 */
function compactAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString("es-ES", { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })}k`;
  }
  return value.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

type SalesTrendChartProps = {
  serie: ISalesTrendPoint[];
  bucketing: IReportBucketing;
  /** Base-currency → display-currency conversion at current rates. */
  convert: (amountInBase: number) => number;
  /** Formats a value that is already in the display currency. */
  formatConverted: (amount: number) => string;
  currencyLabel: string;
};

/** Bucket key → short human label. */
function labelFor(bucket: string, bucketing: IReportBucketing): string {
  const [year, month, day] = bucket.split("-");
  if (bucketing === "month") return `${month}/${year.slice(2)}`;
  return `${day}/${month}`;
}

/**
 * Sales and profit over time — the first time-series in the app.
 *
 * Points are only emitted for buckets that had sales; gaps stay gaps rather
 * than being drawn as zeros, because under closed-period scoping a missing day
 * usually means "no closing included", not "sold nothing".
 */
export function SalesTrendChart({
  serie,
  bucketing,
  convert,
  formatConverted,
  currencyLabel,
}: SalesTrendChartProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  if (serie.length === 0) {
    return (
      <ContentCard title="Evolución de ventas y ganancia">
        <Alert severity="info">No hay datos disponibles para el período</Alert>
      </ContentCard>
    );
  }

  const labels = serie.map((point) => labelFor(point.bucket, bucketing));

  return (
    <ContentCard
      title="Evolución de ventas y ganancia"
      subtitle={`Importes en ${currencyLabel}`}
    >
      <LineChart
        height={340}
        xAxis={[
          {
            scaleType: "point",
            data: labels,
            // Smaller ticks on phones so more dates fit before MUI thins them out.
            tickLabelStyle: isMobile ? { fontSize: 10 } : undefined,
          },
        ]}
        yAxis={[
          {
            // Ticks stay short ("28k") at every size: the currency is already
            // stated in the subtitle, and repeating "$" plus two decimals on
            // every tick only widens the axis. The exact figure lives in the
            // tooltip.
            width: isMobile ? 42 : 52,
            tickLabelStyle: isMobile ? { fontSize: 10 } : undefined,
            valueFormatter: compactAmount,
          },
        ]}
        series={[
          {
            data: serie.map((point) => convert(point.ventasNetas)),
            label: "Ventas netas",
            curve: "monotoneX",
            valueFormatter: (value) =>
              value === null ? "—" : formatConverted(value as number),
          },
          {
            data: serie.map((point) => convert(point.ganancia)),
            label: "Ganancia",
            curve: "monotoneX",
            valueFormatter: (value) =>
              value === null ? "—" : formatConverted(value as number),
          },
        ]}
        // The axes reserve their own space via `width`/`height`, so these are
        // just the outer gaps. Left stays at 0 on mobile: every pixel there is
        // plot area. Right has to fit half of the last x-axis label ("07/08"),
        // which otherwise gets clipped at the edge.
        margin={{
          left: isMobile ? 0 : 8,
          right: isMobile ? 22 : 28,
          top: 30,
          bottom: 0,
        }}
      />
    </ContentCard>
  );
}
