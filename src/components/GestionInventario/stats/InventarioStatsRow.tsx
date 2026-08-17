"use client";

import { Box, Tooltip } from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { StatCard } from "@/components/StatCard";
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
    <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
      <StatCard
        variant="compact"
        label="Total productos"
        value={total}
        icon={<InventoryIcon fontSize="small" />}
        tone="neutral"
      />
      <StatCard
        variant="compact"
        label="Con stock"
        value={conStock}
        icon={<TrendingUpIcon fontSize="small" />}
        tone="positive"
      />
      <StatCard
        variant="compact"
        label="Sin stock"
        value={sinStock}
        icon={<TrendingDownIcon fontSize="small" />}
        tone="negative"
      />
      {/*
        Compact in the tile, exact on hover: in CUP this total runs to eleven
        digits and used to overflow the card, which made the two figures beside
        it impossible to compare at a glance.
      */}
      <StatCard
        variant="compact"
        label="Valor inventario"
        value={
          <Tooltip title={formatCurrency(valorInventario)}>
            <span>{formatCurrencyCompact(valorInventario)}</span>
          </Tooltip>
        }
        icon={<AttachMoneyIcon fontSize="small" />}
        tone="caution"
      />
    </Box>
  );
}
