"use client";

import { Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

/** The six hues, by the name the token layer gives them. */
export type PillHue =
  "positive" | "negative" | "caution" | "info" | "neutral" | "accent";

interface StatusPillProps {
  label: string;
  hue?: PillHue;
  /** Uppercase with wider tracking, for a category rather than a state. */
  caps?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * A state, as a tinted pill.
 *
 * The one shape the redesign uses for "this thing is in this condition":
 * the hue's wash behind the hue's own ink. Never a solid fill — solid is
 * reserved for things you can press — and never MUI's `variant="outlined"`,
 * which drew a hard ring around every «Activo» and «Global» in the app and
 * made a table of unremarkable rows look like a list of alerts.
 *
 * The default hue is `neutral` on purpose: a label that repeats on every row
 * is not news, and most of them were coloured only because a colour was free.
 */
export function StatusPill({
  label,
  hue = "neutral",
  caps = false,
  sx,
}: StatusPillProps) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 22,
        fontSize: caps ? "0.71875rem" : "0.75rem",
        fontWeight: caps ? 700 : 600,
        ...(caps && { letterSpacing: "0.04em" }),
        bgcolor: `semantic.hue.${hue}.surface`,
        color: `semantic.hue.${hue}.main`,
        ...sx,
      }}
    />
  );
}
