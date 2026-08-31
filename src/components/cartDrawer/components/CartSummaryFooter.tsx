"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { DiscountField } from "@/components/cartDrawer/components/DiscountField";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { shape, touch } from "@/theme";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

interface CartSummaryFooterProps {
  total: number;
  finalTotal: number;
  discountTotal: number;
  base: string;
  applied: DiscountApplicationResultItem[];
  promoCode: string;
  canCheckout: boolean;
  /** Which account is being charged. Read straight from the charge bar. */
  cartName?: string;
  /** Units in the cart, not lines — the count the direction puts here. */
  unitCount?: number;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onCheckout: () => void;
}

/**
 * The charge bar.
 *
 * The direction's central bet: the total, its conversions and the action that
 * commits them are one object on the flipped ground, not three things scattered
 * over a white panel. That is also what fixes the defect this screen carried —
 * the total, every cart line and the button were all the same green, so a sum,
 * a detail and an action were painted identically on the one screen where
 * telling them apart matters most.
 *
 * Green now means only what the palette says it means: change owed and success.
 * The action is violet, like every other action in the app.
 */

// Hoisted: this repaints on every `+` and `−`, and an inline literal made
// Emotion re-serialize the whole block each time.
//
// A rule, not a shadow: the redesign separates the discount row from the
// lines above with the same 1px the lines use between themselves. The
// shadow this replaces was the only one left in the panel.
const ADJUSTMENTS_SX = {
  borderTop: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
} as const;

const SUBTOTAL_SX = { px: 1.75, pt: 1.25 } as const;

// 14/14/16, and the home-indicator edge on a phone.
const BAR_SX = {
  px: 1.75,
  pt: 1.75,
  pb: "calc(16px + env(safe-area-inset-bottom))",
  bgcolor: "semantic.surface.inverse",
} as const;

// 11.5px, as the drawing measures the two labels over the total.
const LABEL_SX = {
  color: "semantic.text.onInverseMuted",
  fontSize: "0.71875rem",
  lineHeight: 1.3,
} as const;

const CTA_SX = {
  mt: 1.625,
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  // The direction sizes this one step above the app's button text: it is the
  // only control on the screen a cashier hits without looking.
  fontSize: "1.0625rem",
  fontWeight: 700,
} as const;

const CTA_COUNT_SX = {
  ml: 1.25,
  fontWeight: 400,
  opacity: 0.75,
  fontSize: "0.875rem",
} as const;

export function CartSummaryFooter({
  total,
  finalTotal,
  discountTotal,
  base,
  applied,
  promoCode,
  canCheckout,
  cartName,
  unitCount,
  onCodeChange,
  onApply,
  onCheckout,
}: CartSummaryFooterProps) {
  const countLabel =
    unitCount === undefined
      ? undefined
      : `${unitCount} ${unitCount === 1 ? "artículo" : "artículos"}`;

  return (
    <Box flex="0 0 auto">
      {/* Adjustments stay on the light ground: a discount is a decision taken
          before the charge, not part of the amount being charged. */}
      <Box sx={ADJUSTMENTS_SX}>
        {discountTotal > 0 && (
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={SUBTOTAL_SX}
          >
            <Typography variant="caption" color="text.secondary">
              Subtotal
            </Typography>
            <Typography
              variant="caption"
              sx={{ textDecoration: "line-through", color: "text.disabled" }}
            >
              {formatMontoEnMoneda(total, base)}
            </Typography>
          </Stack>
        )}

        <DiscountField
          promoCode={promoCode}
          applied={applied}
          discountTotal={discountTotal}
          base={base}
          onCodeChange={onCodeChange}
          onApply={onApply}
        />
      </Box>

      <Box sx={BAR_SX}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          mb={0.75}
        >
          <Typography component="span" sx={LABEL_SX}>
            {cartName ? `A cobrar · ${cartName}` : "A cobrar"}
          </Typography>
          {countLabel && (
            <Typography component="span" sx={LABEL_SX}>
              {countLabel}
            </Typography>
          )}
        </Stack>

        <MultiCurrencyAmount amount={finalTotal} variant="total" onInverse />

        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          disabled={!canCheckout}
          onClick={onCheckout}
          sx={CTA_SX}
        >
          Cobrar
          {countLabel && (
            <Box component="span" sx={CTA_COUNT_SX}>
              {countLabel}
            </Box>
          )}
        </Button>
      </Box>
    </Box>
  );
}
