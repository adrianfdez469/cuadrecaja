"use client";

import { Alert, Box, Card, CardContent, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

/** Shape the chart needs: a label plus one numeric field to plot. */
type RankingDatum = { nombre: string } & Record<string, string | number>;

type TopProductsChartProps = {
  title: string;
  data: RankingDatum[];
  /** Numeric field to plot. */
  valueKey: string;
  seriesLabel: string;
  formatValue: (value: number) => string;
};

/**
 * Horizontal ranking of products. Shared by the "most sold" and "most
 * profitable" charts, which differ only in which field they plot and how it is
 * formatted.
 */
export function TopProductsChart({
  title,
  data,
  valueKey,
  seriesLabel,
  formatValue,
}: TopProductsChartProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        {data.length > 0 ? (
          <Box sx={{ width: "100%" }}>
            <BarChart
              dataset={data}
              layout="horizontal"
              yAxis={[{ scaleType: "band", dataKey: "nombre", width: 160 }]}
              xAxis={[{ valueFormatter: (value) => formatValue(value) }]}
              series={[
                {
                  dataKey: valueKey,
                  label: seriesLabel,
                  valueFormatter: (value) => formatValue(value as number),
                },
              ]}
              barLabel={(item) =>
                item.value != null ? formatValue(item.value) : null
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
  );
}
