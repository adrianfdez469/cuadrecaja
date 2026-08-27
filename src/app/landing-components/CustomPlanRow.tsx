"use client";

import { Box, Typography } from "@mui/material";

import { shape } from "@/theme/tokens";

import { LandingButton } from "./LandingButton";

interface CustomPlanRowProps {
  name: string;
  description: string;
  onRequestQuote: () => void;
}

/**
 * The negotiated plan, as a row rather than a fifth card.
 *
 * It has no price and no limits to compare, so putting it in the grid forced
 * an empty column where the other three list theirs. A row says the same thing
 * and stops it competing with the plans a visitor can actually pick.
 */
export function CustomPlanRow({
  name,
  description,
  onRequestQuote,
}: CustomPlanRowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "stretch", md: "center" },
        justifyContent: "space-between",
        gap: { xs: 1.75, md: 2.5 },
        mt: 2,
        p: { xs: 2.25, md: "20px 24px" },
        bgcolor: "semantic.surface.raised",
        border: "1px solid",
        borderColor: "semantic.surface.border",
        borderRadius: `${shape.radius.md}px`,
      }}
    >
      <Box>
        <Typography
          component="h3"
          sx={{ fontSize: "1.0625rem", fontWeight: 700 }}
        >
          {name}
        </Typography>
        <Typography
          sx={{
            mt: "2px",
            fontSize: "0.875rem",
            lineHeight: 1.55,
            color: "text.secondary",
          }}
        >
          {description}
        </Typography>
      </Box>

      <LandingButton
        tone="ghost"
        onClick={onRequestQuote}
        sx={{ flexShrink: 0, minHeight: 48, fontSize: "0.9375rem" }}
      >
        Pedir cotización
      </LandingButton>
    </Box>
  );
}
