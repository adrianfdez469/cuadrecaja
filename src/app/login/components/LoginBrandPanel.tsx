"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { BrandMark, Wordmark } from "@/components/brand";

/** Repeated in the mobile layout, where it sits under the form instead. */
export const VERSION_LINE = "Versión 1.0 • Sistema de gestión comercial";

/**
 * The violet side of the login.
 *
 * On a wide screen it is a full-height column; on a phone it collapses to a
 * band above the form. Either way it is flat violet — the screen it leads to
 * is the app, so the first thing a user sees should already look like it. What
 * it replaces was a purple-to-indigo page gradient, a floating translucent
 * card, a second blue-to-crimson gradient inside the card's header, a dark
 * overlay on top of that, a shop icon in a glass circle and two text shadows
 * to rescue the contrast the gradients had cost.
 */
export function LoginBrandPanel() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flex: { xs: "0 0 auto", md: "0 0 596px" },
        width: { xs: "100%", md: 596 },
        px: { xs: 2.5, md: 7 },
        pt: { xs: 4.5, md: 7 },
        pb: { xs: 3.5, md: 7 },
        bgcolor: "semantic.hue.accent.main",
        color: "semantic.hue.accent.contrast",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          gap: 1.75,
        }}
      >
        <BrandMark size={44} boxed tone="inverse" />
        <Wordmark size={17} tone="inverse" />
      </Box>

      <Box>
        <BrandMark
          size={52}
          boxed
          tone="inverse"
          sx={{ display: { xs: "flex", md: "none" }, mb: 2.5 }}
        />
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "1.875rem", md: "2.75rem" },
            fontWeight: 700,
            lineHeight: { xs: 1.2, md: 1.15 },
            letterSpacing: { xs: "-0.025em", md: "-0.03em" },
            textWrap: "pretty",
          }}
        >
          Cuadre de Caja
        </Typography>
        <Typography
          sx={{
            mt: { xs: 0.75, md: 1.5 },
            fontSize: { xs: "1rem", md: "1.1875rem" },
            lineHeight: { xs: 1.45, md: 1.5 },
            color: (theme) =>
              alpha(theme.palette.semantic.hue.accent.contrast, 0.82),
          }}
        >
          Sistema de Punto de Venta
        </Typography>
      </Box>

      <Typography
        sx={{
          display: { xs: "none", md: "block" },
          fontSize: "0.8125rem",
          color: (theme) =>
            alpha(theme.palette.semantic.hue.accent.contrast, 0.7),
        }}
      >
        {VERSION_LINE}
      </Typography>
    </Box>
  );
}
