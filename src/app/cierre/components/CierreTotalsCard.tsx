"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { formatCurrency } from "@/utils/formatters";

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
}

interface CellProps {
  label: string;
  value: number;
  tone?: string;
  note?: string;
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
  extra,
  borderRight,
  borderTop,
  isMobile,
}: CellProps) {
  if (isMobile) {
    return (
      <Box
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
          {extra}
        </Box>
      </Box>
    );
  }

  return (
    <Box
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
}: Props) {
  const hasDescuento = (totalDescuentos || 0) > 0;

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
    },
    { label: "Total Ganancia", value: totalGanancia, tone: "positive" },
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
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
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
