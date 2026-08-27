"use client";

import { Box, Typography } from "@mui/material";
import type { ElementType } from "react";

import { shape } from "@/theme/tokens";

interface PillarCardProps {
  icon: ElementType;
  title: string;
  description: string;
}

/**
 * One of the three claims the page rests on.
 *
 * No card, on purpose: a border and a background around each of three items
 * side by side adds two hairlines and buys nothing — the icon's violet wash
 * already marks where each one starts.
 */
export function PillarCard({
  icon: Icon,
  title,
  description,
}: PillarCardProps) {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: { xs: 44, md: 48 },
          height: { xs: 44, md: 48 },
          mb: { xs: 1.75, md: 2.25 },
          borderRadius: `${shape.radius.md}px`,
          bgcolor: "semantic.hue.accent.surface",
          color: "semantic.hue.accent.main",
        }}
      >
        <Icon sx={{ fontSize: { xs: 24, md: 26 } }} />
      </Box>

      <Typography
        component="h3"
        sx={{
          fontSize: { xs: "1.25rem", md: "1.375rem" },
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: "-0.015em",
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          mt: 1,
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color: "text.secondary",
        }}
      >
        {description}
      </Typography>
    </Box>
  );
}
