"use client";

import { memo, useState, MouseEvent } from "react";
import { Box, ButtonBase, Popover, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { SxProps, Theme } from "@mui/material";
import type { PosProductCard } from "../utils/buildProductIndex";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useCartItemQuantity, useCartStore } from "@/store/cartStore";
import { useAppContext } from "@/context/AppContext";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";
import { convertToBase } from "@/lib/currency";
import { formatQuantity } from "@/utils/formatters";
import { POS_CATALOG_ROW_HEIGHT } from "@/constants/pos";
import { shape, touch } from "@/theme";

/**
 * A catalogue entry, as the redesign draws it: a row, not a card.
 *
 * The card it replaces spent 110px and a border on every product to hold a
 * name, a stock badge, a three-button stepper and a price — four controls
 * competing at the same weight, of which the cashier uses one nine times out
 * of ten. The row is 60px, has a single target, and lets twice as many
 * products fit above the fold, which is the actual scarce resource on a
 * phone held one-handed.
 *
 * Quantity did not disappear with the stepper: «+» adds one, tapping the row
 * opens the quantity sheet for an exact figure, and the basket keeps its own
 * «−/+» per line. What used to be three controls per product in the catalogue
 * is now one, plus the two places that already existed.
 */

// Hoisted so Emotion serializes them once for the whole catalog instead of
// once per row per render.
const ROW_SX = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  minHeight: POS_CATALOG_ROW_HEIGHT,
  px: 0.25,
  borderTop: "1px solid",
  borderColor: "divider",
  width: "100%",
  minWidth: 0,
} as const;

const ROW_TAPPABLE_SX = {
  ...ROW_SX,
  cursor: "pointer",
  // Pointer devices only: on touch the hover sticks after the tap, and here
  // that would leave a highlighted row behind for every product added.
  "@media (hover: hover)": {
    "&:hover": { bgcolor: "semantic.surface.sunken" },
  },
  "&:active": { bgcolor: "semantic.surface.border" },
} as const;

const NAME_COL_SX = { flex: 1, minWidth: 0 } as const;

// A block, not the inline span `caption` renders by default: `noWrap` only
// clips a box with a width of its own, and as an inline the stock line ran
// straight under the price column on a narrow screen.
const STOCK_SX = { display: "block" } as const;

// 14.5px, not the 13px of `body2`. The redesign sets the catalogue name at
// this exact step and it is the one string a cashier reads at arm's length
// while the phone is on the counter; the theme's body2 is sized for tables.
const NAME_SX = {
  fontSize: "0.90625rem",
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

const PRICE_BASE_SX = {
  flex: "0 0 auto",
  maxWidth: "55%",
  justifyContent: "flex-end",
  borderRadius: `${shape.radius.sm}px`,
  px: 0.5,
} as const;

/** Tappable: the popover with the currency equivalents is reachable. */
const PRICE_BUTTON_SX = { ...PRICE_BASE_SX, cursor: "pointer" } as const;

/** Inert: the equivalents are already on the row, so it is not a target. */
const PRICE_STATIC_SX = { ...PRICE_BASE_SX, cursor: "default" } as const;

const ADD_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "primary.main",
  color: "primary.contrastText",
  "@media (hover: hover)": {
    "&:hover": { bgcolor: "primary.dark" },
  },
  "&.Mui-disabled": {
    bgcolor: "action.disabledBackground",
    color: "action.disabled",
  },
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
   * Everything about this product the row needs, already resolved by
   * `buildProductIndex`. Passing primitives instead of the whole catalog is
   * what makes the memo on this component effective: a row used to recompute
   * its own availability and price on every render of the grid, each one
   * scanning the full product list.
   */
  card: PosProductCard;
  /**
   * Opens the quantity sheet. The «+» never reaches it.
   *
   * Takes the card rather than being a bound closure: the grid renders one of
   * these per product, and a `() => onSelect(card)` built up there would be a
   * fresh identity per row on every render, which alone defeats this
   * component's memo for the whole catalog.
   */
  onSelect?: (card: PosProductCard) => void;
  highlightName?: boolean;
  sx?: SxProps<Theme>;
}

function PosProductItemLayoutComponent({
  card,
  onSelect,
  highlightName = false,
  sx,
}: PosProductItemLayoutProps) {
  const { productoTienda, priceBase, disponible, esFraccion, existencia } =
    card;
  const { show: showAlternatives } = useShowAlternativeCurrencies();
  const { tasasVigentes, monedaBase } = useAppContext();
  const [priceDetailAnchor, setPriceDetailAnchor] =
    useState<HTMLElement | null>(null);
  const cartQty = useCartItemQuantity(productoTienda.id);

  const openPriceDetail = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setPriceDetailAnchor(e.currentTarget);
  };

  const restante = Math.max(0, disponible - cartQty);
  const canAdd = restante >= 1;

  const handleAdd = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!canAdd) return;
    useCartStore.getState().addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: convertToBase(
          productoTienda.precio,
          productoTienda.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        ),
      },
      1,
    );
  };

  // One line under the name, in the order the cashier needs it: what is left
  // to sell first, and what this sale has already taken second. The stock
  // badge this replaces was a boxed icon that said the same thing in a place
  // where every product name had to make room for it.
  const stockLine = `${formatQuantity(restante)} en stock${
    cartQty > 0 ? ` · ${formatQuantity(cartQty)} en la venta` : ""
  }`;

  const handleRowClick = onSelect ? () => onSelect(card) : undefined;

  return (
    <Box
      onClick={handleRowClick}
      sx={
        sx
          ? { ...(onSelect ? ROW_TAPPABLE_SX : ROW_SX), ...sx }
          : onSelect
            ? ROW_TAPPABLE_SX
            : ROW_SX
      }
    >
      <Box sx={NAME_COL_SX}>
        <Typography
          variant="body2"
          fontWeight={highlightName ? 700 : 600}
          sx={NAME_SX}
        >
          {productoTienda.producto.nombre}
        </Typography>
        <Typography
          variant="caption"
          color={restante === 0 ? "error.main" : "text.secondary"}
          noWrap
          sx={STOCK_SX}
          title={
            esFraccion
              ? `${formatQuantity(restante)} disponibles para vender (${formatQuantity(existencia)} sueltas, el resto dentro de paquetes sin abrir)`
              : `${formatQuantity(restante)} disponibles para vender`
          }
        >
          {stockLine}
        </Typography>
      </Box>

      {/* The popover is the fallback for a row that only shows the base
          price: once the equivalents are on the row itself, tapping the
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
        sx={showAlternatives ? PRICE_STATIC_SX : PRICE_BUTTON_SX}
      >
        <MultiCurrencyAmount
          amount={priceBase}
          variant="emphasized"
          align="right"
          showAlternatives={showAlternatives}
        />
      </ButtonBase>

      <ButtonBase
        onClick={handleAdd}
        disabled={!canAdd}
        aria-label={`Agregar uno de ${productoTienda.producto.nombre} al carrito`}
        sx={ADD_SX}
      >
        <AddIcon />
      </ButtonBase>

      {/* Mounted only once opened. A closed MUI Popover renders no DOM, but
          the element and its whole prop tree were still being built for every
          product in the catalog on every render of the grid. */}
      {priceDetailAnchor && (
        <Popover
          open
          anchorEl={priceDetailAnchor}
          onClose={() => setPriceDetailAnchor(null)}
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
    </Box>
  );
}

export const PosProductItemLayout = memo(PosProductItemLayoutComponent);
