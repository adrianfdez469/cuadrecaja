"use client";

import { type ChangeEvent, type FocusEvent } from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";

/**
 * The figure at the top of the quantity sheet.
 *
 * Two ways to change it, decided by the device rather than by a setting.
 * Where there is a mouse there is a physical keyboard, so this is a real,
 * editable text field there. On a touch-only device it stays read-only text —
 * the sheet's own `QuantityKeypad` is what edits it, so the system keyboard
 * never has a reason to open. Mirrors the split `ReceivedAmountField` already
 * draws for the checkout amount.
 */

const VALUE_SX = {
  fontSize: "2.375rem",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
  color: "primary.main",
} as const;

const VALUE_INPUT_SX = {
  ...VALUE_SX,
  width: "100%",
  border: 0,
  p: 0,
  m: 0,
  bgcolor: "transparent",
  // Not `font: "inherit"` — that shorthand resets font-size and font-weight
  // to their inherited values too, wiping the 2.375rem/700 above it.
  fontFamily: "inherit",
  textAlign: "right",
  outline: "none",
} as const;

interface QuantityValueFieldProps {
  /** What the cashier sees — comma-decimal. */
  display: string;
  disabled: boolean;
  allowDecimal: boolean;
  onDraftChange: (raw: string) => void;
}

export function QuantityValueField({
  display,
  disabled,
  allowDecimal,
  onDraftChange,
}: QuantityValueFieldProps) {
  const hasPhysicalKeyboard = useMediaQuery(
    "(hover: hover) and (pointer: fine)",
  );

  if (!hasPhysicalKeyboard) {
    return (
      <Typography component="p" sx={VALUE_SX}>
        {display}
      </Typography>
    );
  }

  return (
    <Box
      component="input"
      value={display}
      disabled={disabled}
      // The caller remounts this field (via `key`) for every product the
      // sheet opens on, so autoFocus fires each time, not just the first.
      autoFocus
      inputMode={allowDecimal ? "decimal" : "numeric"}
      aria-label="Cantidad"
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onDraftChange(e.target.value)
      }
      onFocus={(e: FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
      sx={VALUE_INPUT_SX}
    />
  );
}
