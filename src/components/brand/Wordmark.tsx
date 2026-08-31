"use client";

import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

interface WordmarkProps {
  /** Font size in px. */
  size?: number;
  /** `inverse` sets the whole name in white, for a dark ground. */
  tone?: "default" | "inverse";
  sx?: SxProps<Theme>;
}

/**
 * The canonical lockup name for the product.
 *
 * Appears in 17px/700 weight, set on a violet ground as a branded element.
 * All text is white on the background — the three words form a single visual
 * unit that replaces the three prior treatments (splash, header, footer).
 */
export function Wordmark({ size = 17, tone = "default", sx }: WordmarkProps) {
  const onLilaBackground = tone === "inverse"; // Violet background uses inverse (white text)

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.24em",
        fontSize: `${size}px`,
        fontWeight: 700,
        letterSpacing: "-0.025em",
        whiteSpace: "nowrap",
        ...(onLilaBackground
          ? {
              backgroundColor: "primary.main",
              color: "white",
              px: "12px",
              py: "6px",
              borderRadius: "6px",
            }
          : {
              color: "text.primary",
            }),
        ...sx,
      }}
    >
      Cuadre de Caja
    </Box>
  );
}
