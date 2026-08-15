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

// Search mode: one column stacked bottom-up, so the best match ends up pinned
// right above the field being typed in.
//
// `column-reverse` used to live on the parent scroll container, which forced
// this component to return a bare fragment so the cards would be its *direct*
// children. Alternating between a <Box> and a fragment changes the element
// type in that position, and React answers by unmounting and rebuilding every
// card in the catalog — on each entry to and exit from search. Owning the
// layout here keeps the element type stable, so the cards are merely
// reconciled. `minHeight: 100%` is what keeps a short result list pinned to
// the bottom, which the parent's own reversed flow used to provide.
const SEARCH_LIST_SX = {
  display: "flex",
  flexDirection: "column-reverse",
  gap: 1.5,
  p: 1.5,
  minHeight: "100%",
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

  return (
    // Siempre un <Box>, nunca un fragmento: mantener el mismo tipo de
    // elemento en esta posición es lo que permite a React reconciliar las
    // tarjetas al entrar y salir de la búsqueda en vez de reconstruirlas.
    //
    // En modo grilla, un escalón por encima de lo que sugeriría el ancho de
    // pantalla: desde 700px esta grilla comparte el viewport con el panel del
    // carrito, así que el contenedor real ronda dos tercios de lo que miden
    // los breakpoints. Con los valores directos, una pantalla de 1200px
    // pintaba cuatro columnas de ~200px.
    <Box sx={bottomUp ? SEARCH_LIST_SX : GRID_CONTAINER_SX}>
      {products.map((card) => (
        <PosProductItemLayout
          key={card.productoTienda.id}
          card={card}
          highlightName={highlightFor(card)}
          // En modo búsqueda son items flex, y `flex-shrink: 1` es el valor
          // por defecto: en cuanto los resultados superan el alto visible, el
          // navegador los aplasta en vez de dejar que la lista haga scroll.
          // Las tarjetas deben medir siempre lo mismo, haya 2 resultados o 40.
          sx={bottomUp ? SEARCH_CARD_SX : GRID_CARD_SX}
        />
      ))}
    </Box>
  );
}

export const PosProductGrid = memo(PosProductGridComponent);
