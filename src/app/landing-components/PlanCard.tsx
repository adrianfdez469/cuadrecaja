"use client";

import { Box, Typography } from "@mui/material";

import { shape } from "@/theme/tokens";

import { LandingButton } from "./LandingButton";

export interface PlanCardData {
  id: string;
  name: string;
  /** Already formatted, e.g. «$20» or «$0». */
  price: string;
  /** e.g. «/mes». Empty when the price is not periodic. */
  period: string;
  /** The small line under the price: currency and how long it lasts. */
  validity: string;
  limits: string[];
  /** «Empezar» for the free trial, «Elegir …» for the rest. */
  ctaLabel: string;
  recommended: boolean;
}

interface PlanCardProps {
  plan: PlanCardData;
  onChoose: () => void;
}

/**
 * One plan.
 *
 * The recommended one is marked with the accent — a ring and a filled button —
 * and nothing else changes: same size, same order of information. The old page
 * grew the card, coloured the price, added a floating badge and a different
 * verb on the button, which made the other three look broken rather than this
 * one look chosen.
 */
export function PlanCard({ plan, onChoose }: PlanCardProps) {
  const { name, price, period, validity, limits, ctaLabel, recommended } = plan;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // Stacked, the recommended plan leads; in the grid it keeps its column.
        order: { xs: recommended ? -1 : 0, lg: 0 },
        p: 3,
        bgcolor: "semantic.surface.raised",
        border: "1px solid",
        borderColor: recommended
          ? "semantic.hue.accent.main"
          : "semantic.surface.border",
        borderRadius: `${shape.radius.md}px`,
        ...(recommended && {
          boxShadow: (theme) =>
            `0 0 0 1px ${theme.palette.semantic.hue.accent.main}`,
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.25,
        }}
      >
        <Typography
          component="h3"
          sx={{ fontSize: "1.1875rem", fontWeight: 700 }}
        >
          {name}
        </Typography>
        {recommended && (
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              height: 22,
              px: 1.125,
              borderRadius: `${shape.radius.pill}px`,
              bgcolor: "semantic.hue.accent.surface",
              color: "semantic.hue.accent.main",
              fontSize: "0.75rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Más popular
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          gap: 0.5,
          mt: 1.5,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: "2.125rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
          }}
        >
          {price}
        </Typography>
        {period && (
          <Typography
            component="span"
            sx={{ fontSize: "0.9375rem", color: "text.secondary" }}
          >
            {period}
          </Typography>
        )}
      </Box>

      <Typography
        sx={{ mt: 0.5, fontSize: "0.8125rem", color: "text.disabled" }}
      >
        {validity}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          mt: 2.5,
          mb: 3,
          pt: 2.5,
          borderTop: "1px solid",
          borderColor: "semantic.surface.border",
          fontSize: "0.875rem",
          lineHeight: 1.5,
          color: "text.secondary",
        }}
      >
        {limits.map((limit) => (
          <Typography key={limit} component="span" sx={{ fontSize: "inherit" }}>
            {limit}
          </Typography>
        ))}
      </Box>

      <LandingButton
        tone={recommended ? "solid" : "ghost"}
        onClick={onChoose}
        sx={{ mt: "auto", minHeight: 48, fontSize: "0.9375rem" }}
      >
        {ctaLabel}
      </LandingButton>
    </Box>
  );
}
