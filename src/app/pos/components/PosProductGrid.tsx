"use client";

import { ReactNode } from "react";
import { Box, Grid, Typography } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { PosProductItemLayout } from "./PosProductItemLayout";
import { normalizeSearch } from "@/utils/formatters";

interface PosProductGridProps {
  products: IProductoTiendaV2[];
  allProductosTienda: IProductoTiendaV2[];
  emptyMessage: string;
  searchQuery: string;
  /**
   * Renders as a single column stacked bottom-up instead of the
   * responsive multi-column grid. Used inside PosBottomBar's mobile
   * search overlay, whose list is `column-reverse`: the best match ends
   * up pinned right above the field the cashier is typing in, and every
   * result sits within thumb reach rather than at the top of the screen.
   */
  bottomUp?: boolean;
  /**
   * Way out of the empty state, rendered under the message. The search
   * overlay needs this: it hides the category pills, so telling the
   * cashier to "tap Todas" there points at something they can't see.
   */
  emptyAction?: ReactNode;
}

export function PosProductGrid({
  products,
  allProductosTienda,
  emptyMessage,
  searchQuery,
  bottomUp = false,
  emptyAction,
}: PosProductGridProps) {
  if (products.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
        {emptyAction && <Box sx={{ mt: 1.5 }}>{emptyAction}</Box>}
      </Box>
    );
  }

  const highlightFor = (productoTienda: IProductoTiendaV2) =>
    searchQuery.trim() !== "" &&
    normalizeSearch(productoTienda.producto.nombre).startsWith(
      normalizeSearch(searchQuery),
    );

  if (bottomUp) {
    // No wrapping Box here on purpose: the parent scroll container owns
    // `flexDirection: column-reverse` directly, so these need to be its
    // *direct* children for the reversed stacking/scroll-anchor to apply
    // to them — an extra level of nesting here would only reverse this
    // single Box relative to nothing.
    return (
      <>
        {products.map((productoTienda) => (
          <PosProductItemLayout
            key={productoTienda.id}
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
            highlightName={highlightFor(productoTienda)}
            // Aquí son items flex, y `flex-shrink: 1` es el valor por
            // defecto: en cuanto los resultados superan el alto visible,
            // el navegador los aplasta en vez de dejar que la lista haga
            // scroll. Las tarjetas deben medir siempre lo mismo que en la
            // grilla normal, haya 2 resultados o 40.
            sx={{ flexShrink: 0 }}
          />
        ))}
      </>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ p: 1 }}>
      {products.map((productoTienda) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={productoTienda.id}>
          <PosProductItemLayout
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
            highlightName={highlightFor(productoTienda)}
            sx={{ height: "100%" }}
          />
        </Grid>
      ))}
    </Grid>
  );
}
