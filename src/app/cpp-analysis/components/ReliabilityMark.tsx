"use client";

import { Typography } from "@mui/material";

import { StatusPill } from "@/components/StatusPill";

/** Threshold below which reliability is considered poor and should be highlighted. */
const RELIABILITY_THRESHOLD = 80;

/**
 * How much of the cost history a product actually has.
 *
 * Coloured only when reliability is poor (< 80%). When reliability is good,
 * it displays as plain text without a pill. This follows the principle that
 * a complete record is the expected case and has nothing to announce.
 */
export function ReliabilityMark({
  value,
  suffix = "",
}: {
  value: number;
  /** Appended to the figure — the mobile card ("100% confiable") reads in
   * isolation, without a "Confiabilidad" column header for context. */
  suffix?: string;
}) {
  const label = `${value.toFixed(0)}%${suffix}`;

  if (value >= RELIABILITY_THRESHOLD) {
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

  return <StatusPill label={label} hue="negative" />;
}
