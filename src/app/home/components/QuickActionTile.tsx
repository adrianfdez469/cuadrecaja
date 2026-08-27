"use client";

import type { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { shape, touch } from "@/theme";

interface QuickActionTileProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  /**
   * `hero` is the one action the screen exists to launch — Punto de Venta.
   * Solid accent, white on violet. There is exactly one per screen.
   */
  variant?: "hero" | "standard";
  /** A count or a chevron on the trailing edge. Standard tiles only. */
  trailing?: ReactNode;
}

/**
 * A tile in the «Operación» group.
 *
 * The five tiles used to be five colours: each carried its own hardcoded
 * gradient, so the dashboard read as five equally-loud options and none of them
 * was the one the cashier actually opens. The redesign spends colour once —
 * on Punto de Venta — and leaves the rest white with the accent kept to a
 * small washed icon square. Rank, not decoration.
 *
 * The standard tile turns: a column on desktop, where it sits in a grid of
 * four, and a row on phones, where a list scans faster than a grid of squares.
 */
export function QuickActionTile({
  title,
  description,
  icon,
  onClick,
  variant = "standard",
  trailing,
}: QuickActionTileProps) {
  const isHero = variant === "hero";

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        textAlign: "left",
        justifyContent: "flex-start",
        borderRadius: `${shape.radius.md}px`,
        p: isHero ? 2.5 : { xs: 1.75, md: 2.5 },
        gap: isHero ? 2.5 : { xs: 1.75, md: 1.75 },
        minHeight: isHero ? undefined : { xs: touch.rowLarge, md: "auto" },
        flexDirection: isHero ? "column" : { xs: "row", md: "column" },
        alignItems: isHero ? "flex-start" : { xs: "center", md: "flex-start" },
        ...(isHero
          ? { bgcolor: "primary.main", color: "primary.contrastText" }
          : {
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              "@media (hover: hover)": {
                "&:hover": { borderColor: "semantic.surface.borderStrong" },
              },
            }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          width: isHero ? touch.min : 44,
          height: isHero ? touch.min : 44,
          borderRadius: `${shape.radius.md}px`,
          // On the hero the square is a lightened hole in the violet; on a
          // white tile it is the accent's own wash.
          bgcolor: isHero
            ? (theme) => alpha(theme.palette.common.white, 0.16)
            : "semantic.hue.accent.surface",
          color: isHero ? "inherit" : "primary.main",
        }}
      >
        {icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: isHero ? { xs: "1.25rem", md: "1.375rem" } : "1.0625rem",
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 0.5,
            lineHeight: 1.45,
            color: isHero
              ? (theme) => alpha(theme.palette.common.white, 0.82)
              : "text.secondary",
          }}
        >
          {description}
        </Typography>
      </Box>

      {trailing && (
        <Box sx={{ flex: "0 0 auto", display: "flex", alignItems: "center" }}>
          {trailing}
        </Box>
      )}
    </ButtonBase>
  );
}
