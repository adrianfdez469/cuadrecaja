"use client";

import { Box } from "@mui/material";

import { shape } from "@/theme/tokens";

/**
 * A currency's three letters, as a token rather than a chip.
 *
 * The base currency is filled violet — it is the one the whole business is
 * denominated in, and every other amount on every screen is a conversion of
 * it. The rest sit in the neutral wash, because being enabled is not news.
 */
export function CurrencyCode({ code, base = false }: { code: string; base?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 56,
        height: 26,
        px: 1.5,
        borderRadius: `${shape.radius.pill}px`,
        bgcolor: base ? "semantic.hue.accent.main" : "semantic.surface.sunken",
        color: base ? "semantic.hue.accent.contrast" : "text.primary",
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      {code}
    </Box>
  );
}
