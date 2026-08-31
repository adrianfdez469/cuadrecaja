"use client";

import { memo, useState } from "react";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CartAccountSheet } from "@/app/pos/components/CartAccountSheet";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useCartStore } from "@/store/cartStore";
import { useCartTotals } from "@/store/useCartTotals";
import { shape, touch } from "@/theme";

interface PosPayBarProps {
  /** Opens the basket — the «N artículos ▾» handle. */
  onOpenCart: () => void;
  /** Goes straight to the charge screen. */
  onCheckout: () => void;
  /** Hidden where the cart panel is a real sibling and owns the total. */
  hidden?: boolean;
}

/**
 * The charge bar: the POS's floor on phones.
 *
 * Four things, as the redesign draws them and nothing more: the label row,
 * the total with its code set apart, the conversions, and the button that
 * commits them. The floating cart button this replaces hid the one number
 * the cashier and the customer both look at behind a tap, and put the action
 * somewhere else again. Here they are a single object anchored to the bottom
 * of the screen, where the thumb already is.
 *
 * The basket itself is not here. The right handle opens it; keeping the lines
 * out of the bar is what leaves the catalogue above with room to be read.
 *
 * A plain flex child at the foot of the POS column, not `position: fixed`. The
 * keyboard problem that once forced `fixed` on the work row is gone now that
 * the row lives at the top; down here, staying in flow is what lets the
 * catalogue above shrink by exactly this bar's height instead of scrolling its
 * last row underneath it.
 */

const BAR_SX = {
  flexShrink: 0,
  bgcolor: "semantic.surface.inverse",
  color: "semantic.text.onInverse",
  px: 1.75,
  pt: 1.75,
  // Sits on the home-indicator edge: the button must not end under it.
  pb: "calc(16px + env(safe-area-inset-bottom))",
} as const;

// Two labels, two menus, one caret each — the redesign draws both pointing
// down. The left one names the account being charged and switches it, the
// right one counts the basket and opens it. The whole row used to be a single
// target that only did the second, so the account could be read here and
// changed nowhere near.
const LABEL_ROW_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 1,
  mb: 0.75,
} as const;

const HANDLE_SX = {
  minHeight: touch.min,
  px: 0.5,
  mx: -0.5,
  gap: 0.25,
  borderRadius: `${shape.radius.sm}px`,
  color: "semantic.text.onInverseMuted",
  minWidth: 0,
} as const;

// 11.5px, as the drawing measures it.
const LABEL_SX = { fontSize: "0.71875rem", lineHeight: 1.3 } as const;

const CTA_SX = {
  mt: 1.625,
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  fontSize: "1.0625rem",
  fontWeight: 700,
} as const;

const CTA_COUNT_SX = {
  ml: 1.25,
  fontWeight: 400,
  opacity: 0.75,
  fontSize: "0.875rem",
} as const;

function PosPayBar({ onOpenCart, onCheckout, hidden = false }: PosPayBarProps) {
  const { finalTotal, unitCount } = useCartTotals();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const cartName = useCartStore(
    (state) => state.carts.find((c) => c.id === state.activeCartId)?.name,
  );

  // An empty basket has no amount to charge and no action to offer: the bar
  // would be a black band saying zero. The catalogue gets the room instead.
  if (hidden || unitCount === 0) return null;

  const countLabel = `${unitCount} ${unitCount === 1 ? "artículo" : "artículos"}`;

  return (
    <Box sx={BAR_SX}>
      <Box sx={LABEL_ROW_SX}>
        <ButtonBase
          sx={HANDLE_SX}
          onClick={() => setAccountsOpen(true)}
          aria-label="Cambiar de cuenta"
        >
          <Typography component="span" noWrap sx={LABEL_SX}>
            {cartName ? `A cobrar · ${cartName}` : "A cobrar"}
          </Typography>
          <ExpandMoreIcon fontSize="small" />
        </ButtonBase>

        <ButtonBase
          sx={HANDLE_SX}
          onClick={onOpenCart}
          aria-label="Ver la venta"
        >
          <Typography component="span" noWrap sx={LABEL_SX}>
            {countLabel}
          </Typography>
          <ExpandMoreIcon fontSize="small" />
        </ButtonBase>
      </Box>

      <CartAccountSheet
        open={accountsOpen}
        onClose={() => setAccountsOpen(false)}
      />

      <MultiCurrencyAmount amount={finalTotal} variant="total" onInverse />

      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        onClick={onCheckout}
        sx={CTA_SX}
      >
        Cobrar
        <Box component="span" sx={CTA_COUNT_SX}>
          {countLabel}
        </Box>
      </Button>
    </Box>
  );
}

export default memo(PosPayBar);
