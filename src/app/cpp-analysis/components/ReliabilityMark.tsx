"use client";

import { Typography } from "@mui/material";

import { StatusPill } from "@/components/StatusPill";

/** Below this the figure is worth arguing with. */
const HALF_TRUSTED = 50;

/**
 * How much of the cost history a product actually has.
 *
 * Coloured only when it is not clean. Every row used to carry a filled chip —
 * green at 100%, which is most of them — so the two products whose average
 * cost cannot be trusted were the same amount of ink as the twenty-five that
 * can. A complete record is the expected case; it has nothing to announce.
 */
export function ReliabilityMark({ value }: { value: number }) {
  const label = `${value.toFixed(0)}%`;

  if (value >= 100) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </Typography>
    );
  }

  return (
    <StatusPill
      label={label}
      hue={value > HALF_TRUSTED ? "caution" : "negative"}
    />
  );
}
