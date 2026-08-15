"use client";

import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { DiscountField } from "@/components/cartDrawer/components/DiscountField";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

interface CartSummaryFooterProps {
  total: number;
  finalTotal: number;
  discountTotal: number;
  base: string;
  applied: DiscountApplicationResultItem[];
  promoCode: string;
  canCheckout: boolean;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onCheckout: () => void;
}

// Hoisted: this footer repaints on every `+` and `−` (the total changes), and
// an inline literal made Emotion re-serialize the whole block — shadow
// included — each time.
const FOOTER_SX = {
  mt: 1,
  pt: 1.5,
  pb: 1.5,
  px: 2,
  // Cancels the parent drawer's own horizontal padding (theme.spacing(2))
  // so this panel reaches the drawer's true edges instead of sitting
  // inset like the rest of the content — "occupies the whole space."
  mx: -2,
  bgcolor: "background.paper",
  // The shadow alone reads as "a panel floating above the content
  // below it" — a divider line reads as a boundary, not elevation.
  boxShadow: "0px -6px 16px rgba(0,0,0,0.12)",
} as const;

export function CartSummaryFooter({
  total,
  finalTotal,
  discountTotal,
  base,
  applied,
  promoCode,
  canCheckout,
  onCodeChange,
  onApply,
  onCheckout,
}: CartSummaryFooterProps) {
  return (
    <Box flex="0 0 auto" sx={FOOTER_SX}>
      {discountTotal > 0 && (
        <Stack direction="row" justifyContent="space-between" mb={0.5}>
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

      <Divider sx={{ my: 1 }} />

      <Box mb={1}>
        <MultiCurrencyAmount
          amount={finalTotal}
          variant="hero"
          color="success.main"
          layout="inline"
        />
      </Box>

      <Button
        variant="contained"
        color="success"
        fullWidth
        size="large"
        disabled={!canCheckout}
        onClick={onCheckout}
        sx={{ fontWeight: "bold", py: 1.25, minHeight: 48 }}
      >
        COBRAR
      </Button>
    </Box>
  );
}
