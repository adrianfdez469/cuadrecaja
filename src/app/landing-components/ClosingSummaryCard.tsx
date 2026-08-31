"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material";

import { shape } from "@/theme/tokens";

/**
 * A sample close, shown as the app draws it.
 *
 * The figures are illustrative — this is a public page, not a report — but the
 * shape is the real one: the profit on top at the size the app gives it, and
 * under a rule the four totals the owner actually reconciles, consignment kept
 * apart from what is theirs.
 */

/** On the flipped ground the hairline is the inverse ink, thinned. */
const hairline = (theme: Theme) => alpha(theme.palette.semantic.text.onInverse, 0.12);

const BREAKDOWN = [
  { label: "Total vendido", value: "$4318,32" },
  { label: "Efectivo", value: "$2397,00" },
  { label: "Transferencia", value: "$1921,32" },
  { label: "Consignación", value: "$7,15" },
] as const;

export function ClosingSummaryCard() {
  return (
    <Box
      sx={{
        p: { xs: 2.25, md: 3 },
        border: "1px solid",
        borderColor: hairline,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: (theme) => alpha(theme.palette.semantic.text.onInverse, 0.04),
      }}
    >
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "semantic.text.onInverseMuted",
        }}
      >
        Ganancia del período
      </Typography>

      <Typography
        sx={{
          mt: { xs: 1, md: 1.25 },
          fontSize: { xs: "2.5rem", md: "3.25rem" },
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: "semantic.text.onInverse",
        }}
      >
        $1.284,50
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: { xs: "16px 20px", md: "18px 24px" },
          mt: { xs: 2.5, md: 3 },
          pt: { xs: 2.25, md: 2.5 },
          borderTop: "1px solid",
          borderColor: hairline,
        }}
      >
        {BREAKDOWN.map(({ label, value }) => (
          <Box key={label}>
            <Typography
              sx={{
                fontSize: "0.8125rem",
                color: "semantic.text.onInverseMuted",
              }}
            >
              {label}
            </Typography>
            <Typography
              sx={{
                mt: "2px",
                fontSize: { xs: "1.125rem", md: "1.1875rem" },
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: "semantic.text.onInverse",
              }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
