"use client";

import { Box, Typography } from "@mui/material";

import { shape } from "@/theme/tokens";

export interface SuspensionFact {
  label: string;
  value: string;
  /** Tints the figure. Only the two that state the problem take it. */
  negative?: boolean;
  /** A word rather than a number: set smaller, so it does not wrap. */
  text?: boolean;
}

/**
 * The three numbers that say where the account stands.
 *
 * They were two red chips and a line of body text, which made «Cuenta
 * Suspendida» look like something you could click and hid the grace period
 * under the fold of a paragraph. As a strip they read as what they are: three
 * facts, two of them bad.
 */
export function SuspensionFacts({ facts }: { facts: SuspensionFact[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: `repeat(${facts.length}, minmax(0, 1fr))`,
        },
        overflow: "hidden",
        bgcolor: "semantic.surface.raised",
        border: "1px solid",
        borderColor: "semantic.surface.border",
        borderRadius: `${shape.radius.md}px`,
      }}
    >
      {facts.map((fact, index) => (
        <Box
          key={fact.label}
          sx={{
            px: 2.75,
            py: 2.25,
            ...(index < facts.length - 1 && {
              borderRight: { xs: "none", sm: "1px solid" },
              borderBottom: { xs: "1px solid", sm: "none" },
              borderColor: "semantic.surface.border",
            }),
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
            {fact.label}
          </Typography>
          <Typography
            sx={{
              mt: "3px",
              fontSize: fact.text ? "1.0625rem" : "1.5rem",
              fontWeight: 700,
              lineHeight: fact.text ? 1.35 : 1.15,
              letterSpacing: fact.text ? undefined : "-0.025em",
              fontVariantNumeric: "tabular-nums",
              color: fact.negative
                ? "semantic.hue.negative.main"
                : "text.primary",
            }}
          >
            {fact.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
