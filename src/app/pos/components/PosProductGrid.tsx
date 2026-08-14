"use client";

import { memo } from "react";
import { Box, Typography } from "@mui/material";
import type { PosProductCard } from "../utils/buildProductIndex";
import { PosProductItemLayout } from "./PosProductItemLayout";
import { normalizeSearch } from "@/utils/formatters";

const EMPTY_SX = { p: 3, textAlign: "center" } as const;

// Plain CSS Grid rather than MUI's <Grid container>/<Grid item>: the latter
// mounts a wrapper component and resolves five breakpoints for every single
// product, which is the kind of per-card cost that adds up to a visible stall
// on a phone with a full catalog on screen.
//
// The column counts are the exact equivalent of the previous
// xs=12 / sm=6 / md=6 / lg=4 / xl=3 — one, two, two, three, four columns
// (md is omitted because it matched sm). `minmax(0, 1fr)` is required for the
// card's own `minWidth: 0` to keep working; plain `1fr` floors at the content
// width and long product names would push the columns apart.
const GRID_CONTAINER_SX = {
  display: "grid",
  gap: 1.5,
  p: 1,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(3, minmax(0, 1fr))",
    xl: "repeat(4, minmax(0, 1fr))",
  },
} as const;

// Hoisted out of the render: an object literal inside the map is a new
// identity per card per render, which alone would defeat the memo on
// PosProductItemLayout and make Emotion re-serialize the style N times.
const SEARCH_CARD_SX = { flexShrink: 0 } as const;
const GRID_CARD_SX = { height: "100%" } as const;

interface PosProductGridProps {
  products: PosProductCard[];
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
}

function PosProductGridComponent({
  products,
  emptyMessage,
  searchQuery,
  bottomUp = false,
}: PosProductGridProps) {
  if (products.length === 0) {
    return (
      <Box sx={EMPTY_SX}>
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  // Normalized once for the whole list rather than once per card: the term is
  // the same for every product, and `normalizeSearch` is an NFD pass plus two
  // regexes — N times over a full catalog is measurable on a phone.
  const normalizedQuery =
    searchQuery.trim() !== "" ? normalizeSearch(searchQuery) : null;

  // The card's name was already normalized once, when the catalog loaded.
  const highlightFor = (card: PosProductCard) =>
    normalizedQuery !== null && card.normalizedName.startsWith(normalizedQuery);

  if (bottomUp) {
    // No wrapping Box here on purpose: the parent scroll container owns
    // `flexDirection: column-reverse` directly, so these need to be its
    // *direct* children for the reversed stacking/scroll-anchor to apply
    // to them — an extra level of nesting here would only reverse this
    // single Box relative to nothing.
    return (
      <>
        {products.map((card) => (
          <PosProductItemLayout
            key={card.productoTienda.id}
            card={card}
            highlightName={highlightFor(card)}
            // Aquí son items flex, y `flex-shrink: 1` es el valor por
            // defecto: en cuanto los resultados superan el alto visible,
            // el navegador los aplasta en vez de dejar que la lista haga
            // scroll. Las tarjetas deben medir siempre lo mismo que en la
            // grilla normal, haya 2 resultados o 40.
            sx={SEARCH_CARD_SX}
          />
        ))}
      </>
    );
  }

  return (
    // Un escalón por encima de lo que sugeriría el ancho de pantalla: desde
    // 700px esta grilla comparte el viewport con el panel del carrito, así
    // que el contenedor real ronda dos tercios de lo que miden los
    // breakpoints. Con los valores directos, una pantalla de 1200px pintaba
    // cuatro columnas de ~200px.
    <Box sx={GRID_CONTAINER_SX}>
      {products.map((card) => (
        <PosProductItemLayout
          key={card.productoTienda.id}
          card={card}
          highlightName={highlightFor(card)}
          sx={GRID_CARD_SX}
        />
      ))}
    </Box>
  );
}

export const PosProductGrid = memo(PosProductGridComponent);
