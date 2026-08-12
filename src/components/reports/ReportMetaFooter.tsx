"use client";

import { Alert, Stack, Typography } from "@mui/material";
import { formatDate } from "@/utils/formatters";
import type { IReportMeta } from "@/schemas/reports/common";

type ReportMetaFooterProps = {
  meta: IReportMeta | null;
};

/**
 * States where the numbers come from, and warns when they are incomplete.
 *
 * Reports only count *closed* periods, so a month can legitimately show fewer
 * days than the calendar. Without saying so, a short month reads as a sales
 * collapse — this is the note that prevents that misreading.
 */
export function ReportMetaFooter({ meta }: ReportMetaFooterProps) {
  if (!meta) return null;

  const { closingPeriodsIncluded: closings } = meta;
  const hasClosings = closings.count > 0;

  return (
    <Stack spacing={1} sx={{ mt: 3 }}>
      {!hasClosings && (
        <Alert severity="info">
          No hay cierres de período completos dentro del rango seleccionado. Los
          reportes solo incluyen períodos ya cerrados, así que el período en
          curso todavía no aparece.
        </Alert>
      )}

      {meta.salesWithoutRates > 0 && (
        <Alert severity="warning">
          {meta.salesWithoutRates} venta(s) no tienen tasas de cambio
          registradas. Sus importes en moneda extranjera se convirtieron a tasa
          1, así que los totales pueden estar subestimados.
        </Alert>
      )}

      {meta.truncated && (
        <Alert severity="warning">
          El rango supera el máximo de ventas analizables y se procesó de forma
          parcial. Reduce el período para obtener cifras completas.
        </Alert>
      )}

      {meta.unknownProducts > 0 && (
        <Alert severity="info">
          {meta.unknownProducts} línea(s) de venta apuntan a productos que ya no
          existen en la tienda y se agrupan como “Producto desconocido”.
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary">
        {hasClosings
          ? `${closings.count} cierre(s) incluido(s), del ${formatDate(
              new Date(closings.from),
            )} al ${formatDate(new Date(closings.to))}. `
          : ""}
        {meta.salesScanned} venta(s) analizadas. Importes en {meta.monedaBase}{" "}
        convertidos a la moneda seleccionada con las tasas vigentes.
      </Typography>
    </Stack>
  );
}
