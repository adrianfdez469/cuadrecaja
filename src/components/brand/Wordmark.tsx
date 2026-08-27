"use client";

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material";

interface WordmarkProps {
  /** Font size in px. */
  size?: number;
  /** `inverse` sets the whole name in white, for a dark ground. */
  tone?: "default" | "inverse";
  sx?: SxProps<Theme>;
}

/**
 * The name, set once and the same way everywhere.
 *
 * The app used to give it three different treatments depending on the screen —
 * the splash went as far as uppercase at weight 900 with a black-to-violet
 * gradient. There is one treatment now: the product's own family, weight 700,
 * with «de» dropped to weight 400 and secondary ink so the two words that
 * matter carry the name and the small one only sets its rhythm.
 */
export function Wordmark({ size = 17, tone = "default", sx }: WordmarkProps) {
  const inverse = tone === "inverse";

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.32em",
        fontSize: `${size}px`,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        whiteSpace: "nowrap",
        color: inverse ? "semantic.text.onInverse" : "text.primary",
        ...sx,
      }}
    >
      Cuadre
      <Box
        component="span"
        sx={{
          fontWeight: 400,
          color: inverse
            ? (theme) => alpha(theme.palette.semantic.text.onInverse, 0.6)
            : "text.secondary",
        }}
      >
        de
      </Box>
      Caja
    </Box>
  );
}
