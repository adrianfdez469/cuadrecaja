"use client";

import type { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";

interface NavItemProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /**
   * `muted` is the footer — Ayuda, Descargar App. Same row, lower voice: they
   * are always there and are almost never what you opened the menu for.
   */
  variant?: "default" | "muted";
  /** Onboarding tour anchor, when this row has one. */
  tourAttr?: string;
}

/**
 * One row in the navigation drawer.
 *
 * Flush with the section heading above it, not indented under it. The drawer
 * used to nest every row inside an `Accordion` and then inset it by two more
 * steps, so the eye had to cross a moving left edge to read a list of five
 * words. The redesign carries the hierarchy in weight and colour instead —
 * the heading is small, grey and uppercase; the row is large and dark — which
 * leaves the icons on one axis all the way down.
 */
export function NavItem({
  label,
  icon,
  onClick,
  variant = "default",
  tourAttr,
}: NavItemProps) {
  const muted = variant === "muted";

  return (
    <ButtonBase
      {...(tourAttr ? { "data-tour": tourAttr } : {})}
      onClick={onClick}
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-start",
        gap: 1.75,
        minHeight: 52,
        px: 2.5,
        textAlign: "left",
        color: muted ? "text.secondary" : "text.primary",
        "& .MuiSvgIcon-root": {
          fontSize: 21,
          color: muted ? "text.disabled" : "primary.main",
        },
        "@media (hover: hover)": {
          "&:hover": {
            backgroundColor: "background.default",
            ...(muted && { color: "text.primary" }),
          },
        },
      }}
    >
      {/* Fixed slot: the labels line up even when an icon draws wider than
          the others. */}
      <Box
        sx={{
          flex: "0 0 21px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}
