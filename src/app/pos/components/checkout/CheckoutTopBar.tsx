"use client";

import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { touch } from "@/theme";

interface CheckoutTopBarProps {
  title: string;
  subtitle?: string;
  /** Lines in the basket, on the cart glyph at the right end. */
  count?: number;
  onBack: () => void;
}

/**
 * The charge screen's own bar: the arrow back to the basket, «Cobrar» with
 * the account and its size under it, and the basket's count at the right
 * end. The amount is never here: it lives in the charge bar below.
 */

const BAR_SX = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  px: 1.25,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

const BACK_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  color: "text.primary",
} as const;

const TITLE_SX = {
  fontSize: "0.9375rem",
  fontWeight: 700,
  lineHeight: 1.25,
} as const;

const SUBTITLE_SX = {
  fontSize: "0.6875rem",
  lineHeight: 1.3,
  color: "text.secondary",
} as const;

const CART_SX = {
  position: "relative",
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "text.secondary",
} as const;

const BADGE_SX = {
  position: "absolute",
  top: 3,
  right: 3,
  minWidth: 16,
  height: 16,
  px: 0.5,
  borderRadius: "999px",
  bgcolor: "primary.main",
  color: "primary.contrastText",
  fontSize: "0.625rem",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontVariantNumeric: "tabular-nums",
} as const;

export function CheckoutTopBar({
  title,
  subtitle,
  count,
  onBack,
}: CheckoutTopBarProps) {
  return (
    <Box sx={BAR_SX}>
      <IconButton aria-label="Volver al carrito" onClick={onBack} sx={BACK_SX}>
        <ArrowBackIcon />
      </IconButton>
      <Box sx={{ flex: 1, minWidth: 0, pl: 0.25 }}>
        <Typography noWrap sx={TITLE_SX}>
          {title}
        </Typography>
        {subtitle && (
          <Typography noWrap sx={SUBTITLE_SX}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {count !== undefined && (
        <Box sx={CART_SX} aria-label={`${count} en la venta`}>
          <ShoppingCartOutlinedIcon fontSize="small" />
          <Box component="span" sx={BADGE_SX}>
            {count}
          </Box>
        </Box>
      )}
    </Box>
  );
}
