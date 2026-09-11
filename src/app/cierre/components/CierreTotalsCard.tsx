"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { formatCurrency } from "@/utils/formatters";
import {
  CREDIT_FIGURE_EPSILON,
  CREDIT_TEST_IDS,
} from "@/app/cierre/utils/creditoCierre";
import { CREDIT_COPY } from "@/app/cierre/utils/creditoCierreCopy";

export interface ITransferenciaDestino {
  id: string;
  nombre: string;
  total: number;
}

interface Props {
  totalVenta: number;
  totalVentasBrutas?: number;
  totalDescuentos?: number;
  totalGanancia: number;
  totalTransferencia: number;
  transferenciasPorDestino?: ITransferenciaDestino[];
  totalVentasPropias?: number;
  totalVentasConsignacion?: number;
  isMobile?: boolean;
  /**
   * Gates "Total Ganancia" — same permission (`operaciones.cierre.gananciascostos`)
   * `GananciaCard` and `TablaProductosCierre`'s `showOnlyCants` already check.
   * Defaults to hidden: a caller that forgets to pass this must not leak profit.
   */
  canViewGanancia?: boolean;
  /**
   * Credit granted inside `totalVenta`, base currency. Painted as a footnote
   * under the net sales cell; it adds NO cell (criterion 7).
   */
  creditGranted?: number;
}

interface CellProps {
  label: string;
  value: number;
  tone?: string;
  note?: string;
  /**
   * A plain secondary line under the figure. Not `note`: `note` is painted
   * struck through, which reads as "this value was replaced", and on the net
   * sales cell it is already taken by the pre-discount gross.
   */
  footnote?: string;
  extra?: ReactNode;
  borderRight?: boolean;
  borderTop?: boolean;
  isMobile?: boolean;
}

// One row on a phone (`.tot`, stacked, a divider between each); one cell in a
// grid on desktop (a border-right instead). Same content either way.
function Cell({
  label,
  value,
  tone,
  note,
  footnote,
  extra,
  borderRight,
  borderTop,
  isMobile,
}: CellProps) {
  if (isMobile) {
    return (
      <Box
        data-testid={CREDIT_TEST_IDS.totalsCell}
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1.5,
          minHeight: 52,
          px: 2,
          borderTop: borderTop ? 1 : 0,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ textAlign: "right" }}>
          <Typography
            sx={{
              fontSize: "1.1875rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              ...(tone && { color: `semantic.hue.${tone}.main` }),
            }}
          >
            {formatCurrency(value)}
          </Typography>
          {note && (
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "text.secondary",
                textDecoration: "line-through",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {note}
            </Typography>
          )}
          {footnote && (
            <Typography
              data-testid={CREDIT_TEST_IDS.totalsFootnote}
              sx={{
                fontSize: "0.75rem",
                color: "text.secondary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {footnote}
            </Typography>
          )}
          {extra}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid={CREDIT_TEST_IDS.totalsCell}
      sx={{
        py: 2,
        px: 3,
        borderRight: borderRight ? 1 : 0,
        borderTop: borderTop ? 1 : 0,
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {note && (
        <Typography
          sx={{
            fontSize: "0.8125rem",
            color: "text.secondary",
            textDecoration: "line-through",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {note}
        </Typography>
      )}
      <Typography
        sx={{
          mt: 0.375,
          fontSize: "1.25rem",
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          ...(tone && { color: `semantic.hue.${tone}.main` }),
        }}
      >
        {formatCurrency(value)}
      </Typography>
      {/* Under the value in both branches, not above: `note` is painted above
          the figure on desktop, and criterion 7 asks for the note BELOW. */}
      {footnote && (
        <Typography
          data-testid={CREDIT_TEST_IDS.totalsFootnote}
          sx={{
            fontSize: "0.8125rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {footnote}
        </Typography>
      )}
      {extra}
    </Box>
  );
}

/**
 * The period's five headline totals, on one scale. It replaces a `StatStrip`
 * that split "Ventas Propias" and "Ventas Consignación" away from the rest of
 * the accounting recap into a grid of counts they had nothing to do with —
 * product counts on one hand, money on the other.
 *
 * "Total Venta" is the net figure (post-discount); when a discount was
 * applied, the gross reappears as a struck-through note underneath, the same
 * bruto→final pattern `GananciaCard` uses.
 */
export default function CierreTotalsCard({
  totalVenta,
  totalVentasBrutas,
  totalDescuentos,
  totalGanancia,
  totalTransferencia,
  transferenciasPorDestino = [],
  totalVentasPropias = 0,
  totalVentasConsignacion = 0,
  isMobile = false,
  canViewGanancia = false,
  creditGranted,
}: Props) {
  const hasDescuento = (totalDescuentos || 0) > 0;

  // Absolute value, like every other credit gate (ADR 0129): for this figure
  // both forms coincide, because `Venta.creditoBase` is non-negative, and
  // writing it the same way everywhere keeps anyone from "simplifying" the
  // one gate whose sign does matter.
  const hasCreditGranted =
    Math.abs(creditGranted ?? 0) > CREDIT_FIGURE_EPSILON;

  // El desglose por destino vivía en la banda de totales vieja de
  // TablaProductosCierre; se muda acá para no perderlo al reemplazarla.
  const transferenciaExtra =
    transferenciasPorDestino.length > 0 ? (
      <Box
        sx={{ display: "flex", flexDirection: "column", gap: 0.25, mt: 0.5 }}
      >
        {transferenciasPorDestino.map((destino) => (
          <Box
            key={destino.id}
            sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
          >
            <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
              {destino.nombre}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                color: "text.secondary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrency(destino.total)}
            </Typography>
          </Box>
        ))}
      </Box>
    ) : undefined;

  const cells = [
    {
      label: "Total Venta",
      value: totalVenta,
      tone: "accent",
      note: hasDescuento
        ? formatCurrency(
            totalVentasBrutas ?? totalVenta + (totalDescuentos || 0),
          )
        : undefined,
      footnote: hasCreditGranted
        ? CREDIT_COPY.totalsFootnote(formatCurrency(creditGranted))
        : undefined,
    },
    ...(canViewGanancia
      ? [{ label: "Total Ganancia", value: totalGanancia, tone: "positive" }]
      : []),
    {
      label: "Total Transferencia",
      value: totalTransferencia,
      tone: "info",
      extra: transferenciaExtra,
    },
  ];

  if (isMobile) {
    return (
      <Box
        sx={{
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: "12px",
          overflow: "hidden",
          mb: 2,
        }}
      >
        {cells.map((cell, i) => (
          <Cell key={cell.label} {...cell} isMobile borderTop={i > 0} />
        ))}
        <Cell
          label="Ventas Propias (Bruto)"
          value={totalVentasPropias}
          isMobile
          borderTop
        />
        <Cell
          label="Ventas Consignación"
          value={totalVentasConsignacion}
          isMobile
          borderTop
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: "12px",
        overflow: "hidden",
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
        }}
      >
        {cells.map((cell, i) => (
          <Cell key={cell.label} {...cell} borderRight={i < cells.length - 1} />
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Cell
          label="Ventas Propias (Bruto)"
          value={totalVentasPropias}
          borderRight
        />
        <Cell label="Ventas Consignación" value={totalVentasConsignacion} />
      </Box>
    </Box>
  );
}
