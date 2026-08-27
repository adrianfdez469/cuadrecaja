"use client";

import { memo, useMemo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PosProductCard } from "../utils/buildProductIndex";
import { PosProductItemLayout } from "./PosProductItemLayout";
import { PosListHeading } from "./PosListHeading";
import { normalizeSearch } from "@/utils/formatters";
import {
  POS_CARD_ESTIMATED_HEIGHT,
  POS_VIRTUALIZATION_MIN_ITEMS,
} from "@/constants/pos";

// El mensaje ocupa el alto disponible en vez de quedarse pegado arriba: en
// modo búsqueda la cabecera está replegada, así que un texto anclado al tope
// aparecía contra la barra del menú y a media pantalla de distancia de donde
// el cajero está mirando, que es el buscador.
const EMPTY_BASE_SX = {
  p: 3,
  textAlign: "center",
  minHeight: "100%",
  display: "flex",
  justifyContent: "center",
} as const;

/** Centrado vertical: en la grilla no hay ningún borde al que anclarlo. */
const EMPTY_SX = { ...EMPTY_BASE_SX, alignItems: "center" } as const;

/** Junto al buscador, igual que los resultados que sustituye. */
const EMPTY_SEARCH_SX = { ...EMPTY_BASE_SX, alignItems: "flex-end" } as const;

// Plain CSS Grid rather than MUI's <Grid container>/<Grid item>: the latter
// mounts a wrapper component and resolves five breakpoints for every single
// product, which is the kind of per-card cost that adds up to a visible stall
// on a phone with a full catalog on screen.
//
// Two columns at most, as the redesign draws it. The cards this replaced
// went up to four, which at 60px a row and a name that has to stay readable
// would put the price of one product under the name of the next.
//
// `minmax(0, 1fr)` is required for the row's own `minWidth: 0` to keep
// working; plain `1fr` floors at the content width and long product names
// would push the columns apart.
const GRID_TEMPLATE_COLUMNS = {
  xs: "1fr",
  sm: "repeat(2, minmax(0, 1fr))",
} as const;

// No row gap: the rows are separated by their own 1px rule, which is what
// makes a list read as one column instead of a stack of loose objects. The
// column gap is the redesign's 24px.
const GRID_CONTAINER_SX = {
  display: "grid",
  columnGap: 3,
  px: 1.5,
  pb: 1.5,
  gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
} as const;

/** The header is a grid child in the plain path and a plain block above the
 *  virtualized one, which cannot hold anything in normal flow. */
const VIRTUAL_HEADER_SX = { px: 1.5 } as const;

const HEADER_SX = { gridColumn: "1 / -1" } as const;

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
  px: 1.5,
  py: 1,
  minHeight: "100%",
} as const;

// Hoisted out of the render: an object literal inside the map is a new
// identity per card per render, which alone would defeat the memo on
// PosProductItemLayout and make Emotion re-serialize the style N times.
const SEARCH_CARD_SX = { flexShrink: 0 } as const;

/** Row of the virtualized list: same grid track definition as the plain one. */
const VIRTUAL_ROW_SX = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  display: "grid",
  columnGap: 3,
  px: 1.5,
  gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
} as const;

const VIRTUAL_ROW_SEARCH_SX = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  display: "grid",
  px: 1.5,
  gridTemplateColumns: "1fr",
} as const;

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
  /**
   * The scrolling ancestor, as the element rather than a ref: the virtualizer
   * has to know when it becomes available, and a ref cannot tell it. Until it
   * arrives the grid falls back to rendering everything, so the catalog is
   * never invisible.
   */
  scrollElement: HTMLDivElement | null;
  /** Tapping a row asks for an exact quantity. The row's «+» never gets here. */
  onProductClick?: (card: PosProductCard) => void;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function PosProductGridComponent({
  products,
  emptyMessage,
  searchQuery,
  bottomUp = false,
  scrollElement,
  onProductClick,
}: PosProductGridProps) {
  const theme = useTheme();
  // The same viewport breakpoints the CSS grid above uses, so the column count
  // JavaScript chunks by and the one CSS lays out with can never disagree.
  // These only re-render on a breakpoint crossing, which is rare.
  const isSm = useMediaQuery(theme.breakpoints.up("sm"));

  // Normalized once for the whole list rather than once per card: the term is
  // the same for every product, and `normalizeSearch` is an NFD pass plus two
  // regexes — N times over a full catalog is measurable on a phone.
  const normalizedQuery =
    searchQuery.trim() !== "" ? normalizeSearch(searchQuery) : null;

  // The card's name was already normalized once, when the catalog loaded.
  const highlightFor = (card: PosProductCard) =>
    normalizedQuery !== null && card.normalizedName.startsWith(normalizedQuery);

  // «Catálogo · 30 productos». The list used to start with no heading at
  // all, so nothing on screen said whether a short list was the whole shop or
  // the tail of a filter.
  const header = (
    <PosListHeading sx={HEADER_SX}>
      {`${normalizedQuery === null ? "Catálogo" : "Resultados"} · ${products.length} ${products.length === 1 ? "producto" : "productos"}`}
    </PosListHeading>
  );

  const needsVirtualization = products.length >= POS_VIRTUALIZATION_MIN_ITEMS;
  const virtualize = needsVirtualization && scrollElement !== null;
  const columns = bottomUp || !isSm ? 1 : 2;

  // In search mode the best match must sit at the bottom, nearest the field.
  // The short-list path gets that from `column-reverse`; the virtualized one
  // cannot (rows are absolutely positioned), so the data is reversed instead
  // and the parent scrolls to the end. Same result, and it lets the rows flow
  // top-down like any other virtual list.
  const rows = useMemo(
    () =>
      virtualize
        ? chunk(bottomUp ? [...products].reverse() : products, columns)
        : [],
    [virtualize, bottomUp, products, columns],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => POS_CARD_ESTIMATED_HEIGHT,
    overscan: 4,
  });

  if (products.length === 0) {
    return (
      <Box sx={bottomUp ? EMPTY_SEARCH_SX : EMPTY_SX}>
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  // Below the threshold the whole catalog is cheap to mount, and the plain
  // layout keeps behaviours the virtualized one would have to reimplement —
  // pinning a short result list to the bottom, above all.
  //
  // Keyed on `needsVirtualization`, not on `virtualize`: while the scroll
  // container is still being mounted this must not fall back to drawing the
  // entire catalog, not even for one frame. That single render is worth
  // seconds of main thread on a large shop.
  if (!needsVirtualization) {
    return (
      // Siempre un <Box>, nunca un fragmento: mantener el mismo tipo de
      // elemento en esta posición es lo que permite a React reconciliar las
      // filas al entrar y salir de la búsqueda en vez de reconstruirlas.
      <Box sx={bottomUp ? SEARCH_LIST_SX : GRID_CONTAINER_SX}>
        {!bottomUp && header}
        {products.map((card) => (
          <PosProductItemLayout
            key={card.productoTienda.id}
            card={card}
            highlightName={highlightFor(card)}
            onSelect={onProductClick}
            // En modo búsqueda son items flex, y `flex-shrink: 1` es el valor
            // por defecto: en cuanto los resultados superan el alto visible, el
            // navegador los aplasta en vez de dejar que la lista haga scroll.
            // Las tarjetas deben medir siempre lo mismo, haya 2 resultados o 40.
            sx={bottomUp ? SEARCH_CARD_SX : undefined}
          />
        ))}
      </Box>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      {!bottomUp && <Box sx={VIRTUAL_HEADER_SX}>{header}</Box>}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: `${rowVirtualizer.getTotalSize()}px`,
          // Vertical breathing room matching the plain layouts' padding; the
          // horizontal half lives on each row so the absolute positioning
          // above still spans the full width.
          pb: 1.5,
          pt: bottomUp ? 1 : 0,
        }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <Box
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              sx={bottomUp ? VIRTUAL_ROW_SEARCH_SX : VIRTUAL_ROW_SX}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {row.map((card) => (
                <PosProductItemLayout
                  key={card.productoTienda.id}
                  card={card}
                  highlightName={highlightFor(card)}
                  onSelect={onProductClick}
                />
              ))}
            </Box>
          );
        })}
      </Box>
    </>
  );
}

export const PosProductGrid = memo(PosProductGridComponent);
