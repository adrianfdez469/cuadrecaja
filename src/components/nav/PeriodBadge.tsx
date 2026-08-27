"use client";

import { Box } from "@mui/material";
import { usePosPeriodStore } from "@/store/posPeriodStore";
import { formatDate } from "@/utils/formatters";
import { shape } from "@/theme";

/**
 * The open period, in the app bar.
 *
 * It used to be a violet filled pill inside the POS, on a row of its own with
 * the connection indicator — 44px of a phone screen spent on a date that
 * changes once a day. Violet also meant it read as something to press, on a
 * screen where violet is what you press.
 *
 * Here it is what it is: a quiet outlined pill stating a fact, with a green
 * dot for "open". Desktop only, as the redesign draws it — the phone has no
 * room for it and the period is not what a cashier checks mid-sale. It renders
 * nothing until a screen publishes a period (see `usePosPeriodStore`), so it
 * is absent everywhere except where it means something.
 */

const PILL_SX = {
  display: { xs: "none", md: "inline-flex" },
  alignItems: "center",
  gap: 0.875,
  height: 30,
  px: 1.5,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.pill}px`,
  fontSize: "0.78125rem",
  fontWeight: 600,
  color: "text.secondary",
  whiteSpace: "nowrap",
  flexShrink: 0,
  ml: 1,
} as const;

const DOT_SX = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  bgcolor: "semantic.hue.positive.main",
  flexShrink: 0,
} as const;

export function PeriodBadge() {
  const periodo = usePosPeriodStore((state) => state.periodo);

  if (!periodo?.fechaInicio) return null;

  return (
    <Box sx={PILL_SX}>
      <Box sx={DOT_SX} />
      Período {formatDate(periodo.fechaInicio)}
    </Box>
  );
}
