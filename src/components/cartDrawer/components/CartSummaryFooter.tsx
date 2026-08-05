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
    <Box
      flex="0 0 auto"
      sx={{
        mt: 1,
        pt: 1.5,
        px: 0.5,
        borderTop: "2px solid",
        borderColor: "divider",
        boxShadow: "0px -4px 12px rgba(0,0,0,0.08)",
      }}
    >
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
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
        >
          Total
        </Typography>
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
