"use client";

import { Chip } from "@mui/material";
import type { ReactElement } from "react";
import type { SxProps, Theme } from "@mui/material";

/** The six hues, by the name the token layer gives them. */
export type PillHue =
  "positive" | "negative" | "caution" | "info" | "neutral" | "accent";

interface StatusPillProps {
  label: string;
  hue?: PillHue;
  /** Uppercase with wider tracking, for a category rather than a state. */
  caps?: boolean;
  /**
   * A small icon inside the pill. Only for the rare state whose distinction must
   * not rest on colour alone; it inherits the pill's ink and never carries one
   * of its own.
   */
  icon?: ReactElement;
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
  icon,
  sx,
}: StatusPillProps) {
  return (
    <Chip
      label={label}
      size="small"
      icon={icon}
      sx={{
        height: 22,
        "& .MuiChip-icon": { color: "inherit", fontSize: "0.875rem", ml: 0.75 },
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
