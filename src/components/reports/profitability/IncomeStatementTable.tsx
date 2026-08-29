"use client";

import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import type { IIncomeStatement } from "@/schemas/reports/profitabilityReport";

type IncomeStatementTableProps = {
  data: IIncomeStatement;
  format: (amountInBase: number) => string;
};

type LineType =
  | "detail" // Línea gris (deducción)
  | "subtotal" // Negrita con fondo leve
  | "final"; // La ganancia final

type Line = {
  label: string;
  value: number;
  type: LineType;
  /** Rendered as a subtraction (prefix "−"). */
  negative?: boolean;
  indent?: boolean;
};

/**
 * Period profit and loss, from gross sales down to final profit.
 *
 * Displayed as a cascading P&L statement with visual hierarchy:
 * - Detail lines (gray, with "−" prefix for deductions)
 * - Subtotal lines (bold, light background)
 * - Final line (prominent, green, thick top border)
 *
 * Anchored to the totals stored on each closing rather than recomputed, so the
 * bottom line always matches what the closings summary shows.
 */
export function IncomeStatementTable({
  data,
  format,
}: IncomeStatementTableProps) {
  const lines: Line[] = [
    { label: "Ventas brutas", value: data.ventasBrutas, type: "detail" },
    {
      label: "Descuentos",
      value: data.descuentos,
      negative: true,
      type: "detail",
    },
    { label: "Ventas netas", value: data.ventasNetas, type: "subtotal" },
    {
      label: "Costo de la mercancía vendida",
      value: data.costoMercanciaVendida,
      negative: true,
      type: "detail",
    },
    { label: "Margen bruto", value: data.margenBruto, type: "subtotal" },
    ...data.gastosPorCategoria.map((expense) => ({
      label: expense.categoria,
      value: expense.monto,
      negative: true,
      indent: true,
      type: "detail" as const,
    })),
    {
      label: "Total gastos operativos",
      value: data.gastosOperativos,
      negative: true,
      type: "detail",
    },
    { label: "Merma", value: data.merma, negative: true, type: "detail" },
    {
      label: "Devoluciones",
      value: data.devoluciones,
      negative: true,
      type: "detail",
    },
    { label: "Ganancia final", value: data.gananciaFinal, type: "final" },
  ];

  const renderLine = (line: Line) => {
    const isSubtotal = line.type === "subtotal";
    const isFinal = line.type === "final";

    if (isFinal) {
      return (
        <Box
          key={line.label}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 2,
            px: 2,
            height: 60,
            fontWeight: "bold",
            fontSize: "17px",
            borderTop: "3px solid",
            borderTopColor: "divider",
            bgcolor: (theme) => theme.palette.neutral.surface,
          }}
        >
          <Typography
            sx={{
              fontWeight: "bold",
              fontSize: "17px",
            }}
          >
            {line.label}
          </Typography>
          <Typography
            sx={{
              fontWeight: "bold",
              fontSize: "17px",
              color: "success.main",
              whiteSpace: "nowrap",
              ml: 2,
            }}
          >
            {line.negative ? "− " : ""}
            {format(Math.abs(line.value))}
          </Typography>
        </Box>
      );
    }

    if (isSubtotal) {
      return (
        <Box
          key={line.label}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 1.5,
            px: 2,
            fontWeight: "bold",
            bgcolor: (theme) => theme.palette.neutral.surface,
          }}
        >
          <Typography sx={{ fontWeight: "bold" }}>{line.label}</Typography>
          <Typography
            sx={{
              fontWeight: "bold",
              whiteSpace: "nowrap",
              ml: 2,
            }}
          >
            {line.negative ? "− " : ""}
            {format(Math.abs(line.value))}
          </Typography>
        </Box>
      );
    }

    // Detail line
    return (
      <Box
        key={line.label}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          py: 1.5,
          pl: line.indent ? 4 : 2,
          pr: 2,
          color: line.indent ? "text.secondary" : "text.primary",
        }}
      >
        <Typography sx={{ color: "inherit" }}>{line.label}</Typography>
        <Typography
          sx={{
            color: "inherit",
            whiteSpace: "nowrap",
            ml: 2,
          }}
        >
          {line.negative ? "− " : ""}
          {format(Math.abs(line.value))}
        </Typography>
      </Box>
    );
  };

  return (
    <ContentCard
      title="Estado de resultados"
      subtitle={`Margen bruto: ${data.margenBrutoPorcentaje.toFixed(1)}% sobre ventas netas`}
    >
      <Stack spacing={1.5}>
        {/* P&L Cascade */}
        <Stack spacing={0} sx={{ bgcolor: "background.paper" }}>
          {lines.map((line) => renderLine(line))}
        </Stack>

        {/* Reconciliation warning if needed */}
        {data.ajusteConciliacion !== 0 && (
          <Alert severity="warning">
            El desglose de gastos por categoría no cuadra con el total
            registrado en los cierres por{" "}
            {format(Math.abs(data.ajusteConciliacion))}. El total mostrado es el
            del cierre, que es el valor autoritativo.
          </Alert>
        )}

        {/* Investment section */}
        {data.gastosInversion > 0 && (
          <>
            <Divider />
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" fontWeight="bold">
                Inversión: {format(data.gastosInversion)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Los gastos de naturaleza INVERSIÓN salen de caja pero no reducen
                la ganancia, por eso no aparecen arriba.
              </Typography>
              {data.inversionPorCategoria.map((expense) => (
                <Typography
                  key={expense.categoria}
                  variant="caption"
                  color="text.secondary"
                  sx={{ pl: 2 }}
                >
                  {expense.categoria}: {format(expense.monto)}
                </Typography>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </ContentCard>
  );
}
