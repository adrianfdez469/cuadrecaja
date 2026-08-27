"use client";

import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { shape, touch } from "@/theme";

interface CheckoutTopBarProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

/**
 * The charge screen's own bar: where the cashier is, and how to get back.
 *
 * One 44px square for the arrow on the neutral wash, then the title at 15px
 * and a second line at 11px — «Cobrar · Cuenta #1 / Tienda Principal», then
 * «Efectivo CUP / Cuenta #1 · 4.317,91 USD» once a form of payment is open.
 * The amount is never here: it has a block of its own right under.
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
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.neutral.surface",
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

export function CheckoutTopBar({
  title,
  subtitle,
  onBack,
}: CheckoutTopBarProps) {
  return (
    <Box sx={BAR_SX}>
      <IconButton aria-label="Volver" onClick={onBack} sx={BACK_SX}>
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
    </Box>
  );
}
