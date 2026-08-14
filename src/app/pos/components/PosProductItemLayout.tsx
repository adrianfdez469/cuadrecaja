"use client";

import { memo, useState, MouseEvent } from "react";
import {
  Box,
  ButtonBase,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { PosProductCard } from "../utils/buildProductIndex";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { ProductQuickActions } from "./ProductQuickActions";
import { StockAvailabilityBadge } from "./StockAvailabilityBadge";
import { useCartItemQuantity } from "@/store/cartStore";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";

// Hoisted so Emotion serializes them once for the whole catalog instead of
// once per card per render. Only the styles that never depend on props or
// state qualify; the rest stay inline.
const NAME_SX = {
  minWidth: 0,
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;
const QUICK_ACTIONS_SX = { flexShrink: 0 } as const;
const PRICE_BUTTON_BASE_SX = {
  justifyContent: "flex-end",
  borderRadius: 1.5,
  px: 0.75,
  py: 0.5,
  minHeight: 44,
  // Nunca por debajo de su contenido: antes que encogerse tiene que envolver
  // a la línea de abajo. `flexGrow` es para que una vez ahí ocupe el ancho
  // completo y siga alineado a la derecha.
  flexShrink: 0,
  flexGrow: 1,
  maxWidth: "100%",
} as const;
/** Tappable: the popover with the currency equivalents is reachable. */
const PRICE_BUTTON_SX = {
  ...PRICE_BUTTON_BASE_SX,
  cursor: "pointer",
} as const;
/** Inert: the equivalents are already on the card, so it is not a target. */
const PRICE_BUTTON_STATIC_SX = {
  ...PRICE_BUTTON_BASE_SX,
  cursor: "default",
} as const;
const PRICE_DETAIL_SX = { p: 1.5, minWidth: 200 } as const;
const PRICE_LABEL_SX = {
  mb: 0.25,
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: 0.4,
} as const;
const POPOVER_ANCHOR_ORIGIN = { vertical: "top", horizontal: "right" } as const;
const POPOVER_TRANSFORM_ORIGIN = {
  vertical: "bottom",
  horizontal: "right",
} as const;

interface PosProductItemLayoutProps {
  /**
   * Everything about this product the card needs, already resolved by
   * `buildProductIndex`. Passing primitives instead of the whole catalog is
   * what makes the memo on this component effective: a card used to recompute
   * its own availability and price on every render of the grid, each one
   * scanning the full product list.
   */
  card: PosProductCard;
  onClick?: () => void;
  highlightName?: boolean;
  sx?: SxProps<Theme>;
}

function PosProductItemLayoutComponent({
  card,
  onClick,
  highlightName = false,
  sx,
}: PosProductItemLayoutProps) {
  const { productoTienda, priceBase, disponible, esFraccion, existencia } =
    card;
  const { show: showAlternatives } = useShowAlternativeCurrencies();
  const [priceDetailAnchor, setPriceDetailAnchor] =
    useState<HTMLElement | null>(null);
  const cartQty = useCartItemQuantity(productoTienda.id);

  const openPriceDetail = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setPriceDetailAnchor(e.currentTarget);
  };
  const closePriceDetail = () => setPriceDetailAnchor(null);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: { xs: 1, sm: 1.25 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        overflow: "hidden",
        ...(onClick && {
          cursor: "pointer",
          transition: "background-color 0.15s ease",
          "&:hover": { bgcolor: "action.hover" },
          "&:active": { bgcolor: "action.selected" },
        }),
        ...sx,
      }}
    >
      {/* Fila 1: nombre + disponibilidad. Mismo esquema que CartItemCard
          (identidad arriba, metadato al lado): las dos tarjetas que ve el
          cajero en la misma venta ya no colocan el mismo dato en lugares
          distintos. La disponibilidad va aquí y no abajo junto al precio
          porque su largo es variable (un número suelto vs "8 · Stock 37") y
          allí decidía si la fila envolvía o no: dos tarjetas vecinas
          quedaban con el precio a distinta altura. El nombre se recorta a
          dos líneas en vez de truncarse: con el sufijo del proveedor, una
          sola línea escondía justo la parte que distingue un producto de
          otro. */}
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        mb={0.75}
      >
        <Typography
          variant="body2"
          fontWeight={highlightName ? 700 : 600}
          sx={NAME_SX}
        >
          {productoTienda.producto.nombre}
        </Typography>

        <StockAvailabilityBadge
          disponible={disponible}
          esFraccion={esFraccion}
          existencia={existencia}
          cartQty={cartQty}
        />
      </Box>

      {/* Fila 2: cantidad a la izquierda, importe a la derecha — el orden
          de CartItemCard. Los importes alineados a la derecha forman una
          columna legible de arriba abajo, como en un ticket. */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        // Red de seguridad para columnas muy estrechas: el stepper no
        // encoge, así que el precio baja a su propia línea antes que
        // comprimirse — sin esto se quedaba con unos pocos píxeles y
        // `wordBreak` lo partía en una letra por renglón.
        flexWrap="wrap"
        rowGap={0.5}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          // Ajustar cantidades no debe quitarle el foco al buscador: sin
          // esto, cada producto agregado cerraba el teclado a media venta.
          // Va solo sobre estos controles y no sobre la tarjeta entera, para
          // que tocar cualquier otro sitio sí cierre la búsqueda.
          onMouseDown={(e) => e.preventDefault()}
          sx={QUICK_ACTIONS_SX}
        >
          <ProductQuickActions
            productoTienda={productoTienda}
            disponible={disponible}
          />
        </Box>

        {/* The popover is the fallback for a card that only shows the base
            price: once the equivalents are on the card itself, tapping the
            price would just repeat what is already there, so it stops being
            a target at all. */}
        <ButtonBase
          onClick={showAlternatives ? undefined : openPriceDetail}
          disableRipple={showAlternatives}
          component={showAlternatives ? "div" : "button"}
          aria-label={
            showAlternatives
              ? undefined
              : `Ver detalle de precio de ${productoTienda.producto.nombre}`
          }
          sx={showAlternatives ? PRICE_BUTTON_STATIC_SX : PRICE_BUTTON_SX}
        >
          <MultiCurrencyAmount
            amount={priceBase}
            align="right"
            showAlternatives={showAlternatives}
          />
        </ButtonBase>
      </Box>

      {/* Mounted only once opened. A closed MUI Popover renders no DOM, but
          the element and its whole prop tree were still being built for every
          product in the catalog on every render of the grid. */}
      {priceDetailAnchor && (
        <Popover
          open
          anchorEl={priceDetailAnchor}
          onClose={closePriceDetail}
          anchorOrigin={POPOVER_ANCHOR_ORIGIN}
          transformOrigin={POPOVER_TRANSFORM_ORIGIN}
        >
          <Stack gap={1} sx={PRICE_DETAIL_SX}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={PRICE_LABEL_SX}
              >
                Precio
              </Typography>
              <MultiCurrencyAmount amount={priceBase} variant="compact" />
            </Box>
          </Stack>
        </Popover>
      )}
    </Paper>
  );
}

export const PosProductItemLayout = memo(PosProductItemLayoutComponent);
