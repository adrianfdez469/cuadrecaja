"use client";

import { Stack, Typography } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";

interface StockAvailabilityBadgeProps {
  productoTienda: IProductoTiendaV2;
  allProductosTienda: IProductoTiendaV2[];
  /** Units of this product already in the cart, which are no longer available. */
  cartQty: number;
}

/**
 * How many units the cashier can still sell, on a product card.
 *
 * The box icon replaces the "Disp:" prefix rather than joining it: with the
 * icon carrying the meaning, the word was spending the card's scarcest
 * resource — horizontal space in the row it shares with the product name —
 * to say what the icon already says. What is left is the number, which is
 * what actually gets read, at a size that survives a glance.
 *
 * Fractioned products keep their parent stock as a second, deliberately
 * quieter figure: it is context, not the number a sale depends on.
 */
export function StockAvailabilityBadge({
  productoTienda,
  allProductosTienda,
  cartQty,
}: StockAvailabilityBadgeProps) {
  const { maxPorTransaccion, esFraccion } = calcularDisponibilidadReal(
    productoTienda,
    allProductosTienda,
  );
  const disponible = Math.max(0, maxPorTransaccion - cartQty);
  const sinStock = disponible === 0;
  const color = sinStock ? "error.main" : "text.secondary";

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={0.375}
      sx={{ flexShrink: 0 }}
      // An icon is not self-describing the first time it is seen, and this
      // number decides whether a sale can happen.
      title={
        esFraccion
          ? `${disponible} disponibles para vender · ${Math.max(0, productoTienda.existencia || 0)} en stock`
          : `${disponible} disponibles para vender`
      }
    >
      <Inventory2OutlinedIcon sx={{ fontSize: "0.95rem", color }} />
      <Typography
        variant="caption"
        color={color}
        noWrap
        sx={{
          fontSize: "0.82rem",
          fontWeight: 700,
          lineHeight: 1.6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {disponible}
      </Typography>
      {esFraccion && (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ fontSize: "0.7rem", lineHeight: 1.9 }}
        >
          · Stock {Math.max(0, productoTienda.existencia || 0)}
        </Typography>
      )}
    </Stack>
  );
}
