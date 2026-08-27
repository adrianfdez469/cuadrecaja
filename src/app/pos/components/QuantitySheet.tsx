"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import { IProductoTiendaPos } from "@/schemas/producto";
import { useCartStore } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import { formatMontoEnMoneda, formatQuantity } from "@/utils/formatters";
import {
  clampQuantity,
  getQuickAddChips,
  parseQuantityText,
  sanitizeQuantityDraft,
} from "@/app/pos/utils/quantityInput";
import { QuantityKeypad, type QuantityKey } from "./QuantityKeypad";
import { shape, touch } from "@/theme";

/**
 * How many, as the redesign draws it: a sheet, not a dialog.
 *
 * The dialog it replaces was a centred box holding a «−N / value / +N» stepper
 * and a row of chips that chose the *step* rather than adding anything — so
 * asking for a thousand loose cigarettes meant first picking «100», then
 * tapping «+100» ten times, and the price of what was being asked for never
 * appeared until it was already in the basket.
 *
 * Here the figure is typed on a keypad of the sheet's own, the shortcuts add
 * instead of configuring, and the subtotal is recomputed above the confirm
 * button before anything is committed. It rises from the bottom because that
 * is where the thumb is and where every other decision of the sale is taken.
 */

const PAPER_SX = {
  borderTopLeftRadius: `${shape.radius.lg}px`,
  borderTopRightRadius: `${shape.radius.lg}px`,
  pb: "calc(14px + env(safe-area-inset-bottom))",
} as const;

const HEAD_SX = {
  display: "flex",
  alignItems: "flex-end",
  gap: 1.5,
  px: 2,
  pt: 1.75,
  pb: 1.5,
} as const;

const VALUE_SX = {
  fontSize: "2.375rem",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
  color: "primary.main",
} as const;

const QUICK_ROW_SX = {
  display: "flex",
  gap: 0.875,
  px: 1.75,
  pb: 0.5,
} as const;

const QUICK_CHIP_SX = {
  flex: 1,
  minWidth: 0,
  height: touch.min,
  borderRadius: `${shape.radius.md}px`,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  fontSize: "0.875rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  px: 0.5,
} as const;

const ACTIONS_SX = { px: 1.75, pt: 1.75, display: "grid", gap: 1.125 } as const;

const CTA_SX = {
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  fontSize: "1.03125rem",
  fontWeight: 700,
} as const;

const CTA_DETAIL_SX = { ml: 1.25, fontWeight: 400, opacity: 0.8 } as const;

const SECONDARY_SX = {
  minHeight: 52,
  borderRadius: `${shape.radius.md}px`,
  borderColor: "divider",
  color: "text.primary",
  fontSize: "0.9375rem",
} as const;

interface QuantitySheetProps {
  productoTienda: IProductoTiendaPos | null;
  onClose: () => void;
  /** Adds and jumps straight to the charge screen. */
  onConfirm: () => void;
  /** Runs after anything lands in the basket — reopens the camera scanner. */
  onAddToCart?: () => void;
  /**
   * What can still be sold, worked out by the caller: for a fraction it
   * includes the units still inside unopened parents, which this component
   * cannot know on its own.
   */
  maxDisponibleOverride?: number;
}

/** The internal draft uses "." so the parsing helpers can read it; the cashier sees ",". */
const toDisplay = (draft: string) =>
  draft === "" ? "0" : draft.replace(".", ",");

export const QuantitySheet = ({
  productoTienda,
  onClose,
  onConfirm,
  onAddToCart,
  maxDisponibleOverride,
}: QuantitySheetProps) => {
  const { tasasVigentes, monedaBase } = useAppContext();
  const items = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addToCart);

  const [draft, setDraft] = useState("1");
  // The opening figure is a suggestion, not something typed: the first digit
  // replaces it instead of being appended, which is what every till does and
  // what stops «1» turning into «15» when the cashier means five.
  const [pristine, setPristine] = useState(true);

  const allowDecimal = productoTienda?.producto?.permiteDecimal ?? false;
  const minQuantity = allowDecimal ? 0.01 : 1;

  const maxQuantity = useMemo(() => {
    if (!productoTienda) return 0;
    const inCart =
      items.find((item) => item.id === productoTienda.id)?.quantity ?? 0;
    const disponible =
      typeof maxDisponibleOverride === "number" && maxDisponibleOverride >= 0
        ? maxDisponibleOverride
        : Math.max(0, productoTienda.existencia || 0);
    return Math.max(0, disponible - inCart);
  }, [productoTienda, items, maxDisponibleOverride]);

  const hasStock = maxQuantity >= minQuantity;

  useEffect(() => {
    if (!productoTienda) return;
    const opening = hasStock
      ? clampQuantity(1, minQuantity, maxQuantity, allowDecimal)
      : 0;
    setDraft(String(opening));
    setPristine(true);
    // Re-arms for each product the scanner or the catalogue hands over; the
    // sheet is not remounted between them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoTienda]);

  const quantity = parseQuantityText(draft, allowDecimal) ?? 0;

  const unitPriceBase = productoTienda
    ? convertToBase(
        productoTienda.precio,
        productoTienda.monedaPrecioCode ?? monedaBase,
        tasasVigentes,
        monedaBase,
      )
    : 0;

  const commit = (next: string) => {
    const cleaned = sanitizeQuantityDraft(next, allowDecimal);
    const parsed = parseQuantityText(cleaned, allowDecimal);
    if (parsed === null) {
      setDraft(cleaned);
      return;
    }
    const clamped = clampQuantity(parsed, 0, maxQuantity, allowDecimal);
    // Only rewrite the text when the ceiling actually bit: otherwise a
    // half-typed «1,» would be normalized away between keystrokes.
    setDraft(clamped !== parsed ? String(clamped) : cleaned);
  };

  const handleKey = (key: QuantityKey) => {
    if (key === "backspace") {
      setPristine(false);
      commit(draft.slice(0, -1));
      return;
    }
    if (key === ",") {
      if (!allowDecimal || draft.includes(".")) return;
      setPristine(false);
      commit(pristine ? "0." : `${draft}.`);
      return;
    }
    const next = pristine ? key : `${draft}${key}`;
    setPristine(false);
    commit(next);
  };

  const setQuantity = (value: number) => {
    setPristine(false);
    setDraft(String(clampQuantity(value, 0, maxQuantity, allowDecimal)));
  };

  const quickChips = useMemo(() => {
    if (!productoTienda) return [];
    return getQuickAddChips(
      allowDecimal,
      maxQuantity,
      productoTienda.producto.unidadesPorFraccion,
    ).slice(0, 3);
  }, [productoTienda, allowDecimal, maxQuantity]);

  const canCommit =
    Boolean(productoTienda) &&
    quantity >= minQuantity &&
    quantity <= maxQuantity;

  const add = () => {
    if (!productoTienda || !canCommit) return;
    addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: unitPriceBase,
      },
      quantity,
    );
    onAddToCart?.();
  };

  const handleAdd = () => {
    if (!canCommit) return;
    add();
    onClose();
  };

  const handleAddAndCharge = () => {
    if (!canCommit) return;
    add();
    onConfirm();
  };

  const isFraction = Boolean(productoTienda?.producto?.fraccionDeId);
  const subtitle = hasStock
    ? `${formatQuantity(maxQuantity)} disponibles${isFraction ? " · unidad suelta" : ""}`
    : "Sin stock disponible";

  return (
    <Drawer
      anchor="bottom"
      open={Boolean(productoTienda)}
      onClose={onClose}
      PaperProps={{ sx: PAPER_SX }}
    >
      {productoTienda && (
        <>
          <Box sx={HEAD_SX}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body1" fontWeight={600} lineHeight={1.25}>
                {productoTienda.producto.nombre}
              </Typography>
              <Typography
                variant="caption"
                color={hasStock ? "text.secondary" : "error.main"}
              >
                {subtitle}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography component="p" sx={VALUE_SX}>
                {toDisplay(draft)}
              </Typography>
              <MultiCurrencyAmount
                amount={unitPriceBase * quantity}
                variant="compact"
                align="right"
                sx={{ mt: 0.75 }}
              />
            </Box>
          </Box>

          {hasStock && (
            <Box sx={QUICK_ROW_SX}>
              {quickChips.map((chip) => (
                <ButtonBase
                  key={chip.label}
                  sx={QUICK_CHIP_SX}
                  // While the opening «1» is still untouched it is a
                  // suggestion, not a figure: «+10» on it means ten, not
                  // eleven. Once anything has been typed the chips add, which
                  // is what they say they do.
                  onClick={() =>
                    setQuantity(pristine ? chip.value : quantity + chip.value)
                  }
                >
                  {chip.label}
                </ButtonBase>
              ))}
              <ButtonBase
                sx={QUICK_CHIP_SX}
                onClick={() => setQuantity(maxQuantity)}
              >
                Máx {formatQuantity(maxQuantity)}
              </ButtonBase>
            </Box>
          )}

          <QuantityKeypad
            onKey={handleKey}
            allowDecimal={allowDecimal}
            disabled={!hasStock}
          />

          <Stack sx={ACTIONS_SX}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              disabled={!canCommit}
              onClick={handleAdd}
              sx={CTA_SX}
            >
              Agregar {formatQuantity(quantity)}
              <Box component="span" sx={CTA_DETAIL_SX}>
                {formatMontoEnMoneda(unitPriceBase * quantity, monedaBase)}
              </Box>
            </Button>

            {/* Was «Venta Rápida», with a caption underneath explaining what it
                did. The sheet has one primary action, so this one says what it
                does in its own label and takes the redesign's outlined
                secondary — the same pair as the charge screen's closing step. */}
            <Button
              variant="outlined"
              size="large"
              disabled={!canCommit}
              onClick={handleAddAndCharge}
              sx={SECONDARY_SX}
            >
              Agregar y cobrar
            </Button>
          </Stack>
        </>
      )}
    </Drawer>
  );
};
