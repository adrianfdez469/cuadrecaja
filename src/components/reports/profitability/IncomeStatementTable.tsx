"use client";

import {
  Alert,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import type { IIncomeStatement } from "@/schemas/reports/profitabilityReport";

type IncomeStatementTableProps = {
  data: IIncomeStatement;
  format: (amountInBase: number) => string;
};

type Line = {
  label: string;
  value: number;
  /** Rendered as a subtraction. */
  negative?: boolean;
  emphasis?: boolean;
  indent?: boolean;
};

/**
 * Period profit and loss, from gross sales down to final profit.
 *
 * Anchored to the totals stored on each closing rather than recomputed, so the
 * bottom line always matches what the closings summary shows.
 */
export function IncomeStatementTable({
  data,
  format,
}: IncomeStatementTableProps) {
  const lines: Line[] = [
    { label: "Ventas brutas", value: data.ventasBrutas },
    { label: "Descuentos", value: data.descuentos, negative: true },
    { label: "Ventas netas", value: data.ventasNetas, emphasis: true },
    {
      label: "Costo de la mercancía vendida",
      value: data.costoMercanciaVendida,
      negative: true,
    },
    { label: "Margen bruto", value: data.margenBruto, emphasis: true },
    ...data.gastosPorCategoria.map((expense) => ({
      label: expense.categoria,
      value: expense.monto,
      negative: true,
      indent: true,
    })),
    {
      label: "Total gastos operativos",
      value: data.gastosOperativos,
      negative: true,
    },
    { label: "Merma", value: data.merma, negative: true },
    { label: "Devoluciones", value: data.devoluciones, negative: true },
    { label: "Ganancia final", value: data.gananciaFinal, emphasis: true },
  ];

  return (
    <ContentCard
      title="Estado de resultados"
      subtitle={`Margen bruto: ${data.margenBrutoPorcentaje.toFixed(1)}% sobre ventas netas`}
    >
      <Stack spacing={2}>
        <Table size="small">
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={`${line.label}-${index}`}>
                <TableCell
                  sx={{
                    pl: line.indent ? 4 : 2,
                    fontWeight: line.emphasis ? "bold" : "normal",
                    color: line.indent ? "text.secondary" : "text.primary",
                    borderBottom: line.emphasis ? undefined : "none",
                  }}
                >
                  {line.label}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: line.emphasis ? "bold" : "normal",
                    color: line.negative ? "error.main" : "text.primary",
                    borderBottom: line.emphasis ? undefined : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {line.negative ? "− " : ""}
                  {format(Math.abs(line.value))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {data.ajusteConciliacion !== 0 && (
          <Alert severity="warning">
            El desglose de gastos por categoría no cuadra con el total
            registrado en los cierres por{" "}
            {format(Math.abs(data.ajusteConciliacion))}. El total mostrado es el
            del cierre, que es el valor autoritativo.
          </Alert>
        )}

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
