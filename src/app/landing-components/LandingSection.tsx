"use client";

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";

interface LandingSectionProps {
  children: ReactNode;
  id?: string;
  /**
   * `page` is white, `sunken` the tinted ground that separates pricing from
   * what surrounds it, and `inverse` the near-black block — used once, for the
   * closing figure, so the one number the page is arguing about is never the
   * same colour as the page.
   */
  tone?: "page" | "sunken" | "inverse";
  /** Hairline above the section. */
  divider?: boolean;
  /** Applied to the inner 1200px column rather than the full-bleed band. */
  innerSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
}

/**
 * A full-bleed band with the landing's column inside it.
 *
 * Every section on the page is this: colour and hairline run edge to edge,
 * content stops at 1200px. Keeping it in one place is what stops the vertical
 * rhythm drifting section by section, which is how the old page ended up
 * 9.700px tall.
 */
export function LandingSection({
  children,
  id,
  tone = "page",
  divider = false,
  innerSx,
  sx,
}: LandingSectionProps) {
  return (
    <Box
      id={id}
      component="section"
      sx={{
        py: { xs: 5, md: 9 },
        px: { xs: 2, md: 3 },
        bgcolor:
          tone === "inverse"
            ? "semantic.surface.inverse"
            : tone === "sunken"
              ? "semantic.surface.page"
              : "semantic.surface.raised",
        ...(divider && {
          borderTop: "1px solid",
          borderColor:
            tone === "inverse"
              ? (theme) => alpha(theme.palette.semantic.text.onInverse, 0.12)
              : "semantic.surface.border",
        }),
        ...sx,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", ...innerSx }}>{children}</Box>
    </Box>
  );
}
