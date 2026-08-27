"use client";

import { Tooltip } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { StatStrip } from "@/components/StatStrip";
import { formatCurrency, formatCurrencyCompact } from "@/utils/formatters";

interface InventarioStatsRowProps {
  productos: IProductoTiendaV2[];
}

export function InventarioStatsRow({ productos }: InventarioStatsRowProps) {
  const total = productos.length;
  const conStock = productos.filter((p) => p.existencia > 0).length;
  const sinStock = productos.filter((p) => p.existencia <= 0).length;
  const valorInventario = productos.reduce(
    (acc, p) => acc + p.existencia * p.costo,
    0,
  );

  return (
    <StatStrip
      stats={[
        { label: "Total productos", value: total },
        { label: "Con stock", value: conStock },
        {
          // The exception speaks, the norm keeps quiet: zero out-of-stock
          // products is good news and gets no colour for it.
          label: "Sin stock",
          value: sinStock,
          tone: sinStock > 0 ? "negative" : undefined,
        },
        {
          // Compact in the strip, exact on hover: in CUP this total runs to
          // eleven digits and used to overflow its tile, which made the two
          // figures beside it impossible to compare at a glance.
          label: "Valor inventario",
          value: (
            <Tooltip title={formatCurrency(valorInventario)}>
              <span>{formatCurrencyCompact(valorInventario)}</span>
            </Tooltip>
          ),
        },
      ]}
    />
  );
}
