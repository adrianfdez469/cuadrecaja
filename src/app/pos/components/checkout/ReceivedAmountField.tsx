"use client";

import type { ChangeEvent, FocusEvent } from "react";
import { Box, useMediaQuery } from "@mui/material";
import { shape } from "@/theme";
import { formatNumberWith } from "@/utils/numberFormat";

interface ReceivedAmountFieldProps {
  /** The text being edited — dot-decimal, as the keypad builds it. */
  draft: string;
  /**
   * The word beside the figure: the currency code on the main field, what
   * the amount is («Transferencia», «USD») on a secondary one.
   */
  label: string;
  ariaLabel: string;
  onDraftChange: (draft: string) => void;
  /**
   * «primary» is the 64px box with the near-black rule and the figure at
   * 26px; «secondary» is the quieter 56px box with the label on the left,
   * for the transfer under it and the tip per currency.
   */
  variant?: "primary" | "secondary";
  /** Opens the on-screen keypad on a touch device. */
  onOpenKeypad?: () => void;
  /** Keeps the box highlighted while the keypad owns the value. */
  keypadOpen?: boolean;
}

/**
 * An amount handed over: the box the cashier types into.
 *
 * Two ways in, decided by the device rather than by a setting. Where there is
 * a mouse there is a physical keyboard, so this is a real text field. On a
 * touch-only device the system keyboard is suppressed and tapping opens the
 * keypad sheet — it never covers the change, which the system keyboard would.
 */

const GROUPED: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

/** «2900000» → «2.900.000»; a trailing separator survives as «12,». */
function formatDraft(draft: string): string {
  if (draft === "") return "";
  const [whole, decimals] = draft.split(".");
  const grouped = formatNumberWith(Number(whole || 0), GROUPED);
  if (decimals === undefined) return grouped;
  return `${grouped},${decimals}`;
}

const PRIMARY_SX = {
  height: 64,
  border: "2px solid",
  borderColor: "semantic.surface.inverse",
  borderRadius: `${shape.radius.md}px`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  px: 2,
  "&:focus-within": { borderColor: "primary.main" },
} as const;

const SECONDARY_SX = {
  ...PRIMARY_SX,
  height: 56,
  border: "1.5px solid",
  borderColor: "divider",
  flexDirection: "row-reverse",
} as const;

const KEYPAD_OPEN_SX = { borderColor: "primary.main" } as const;

const INPUT_SX = {
  flex: 1,
  minWidth: 0,
  border: 0,
  p: 0,
  bgcolor: "transparent",
  color: "text.primary",
  font: "inherit",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  outline: "none",
} as const;

const LABEL_SX = {
  flex: "0 0 auto",
  fontSize: "0.8125rem",
  color: "text.secondary",
} as const;

export function ReceivedAmountField({
  draft,
  label,
  ariaLabel,
  onDraftChange,
  variant = "primary",
  onOpenKeypad,
  keypadOpen = false,
}: ReceivedAmountFieldProps) {
  // `hover` rules out touch screens; `pointer: fine` rules out anything
  // driven by a thumb. Both together are what "laptop or desktop" means.
  const hasPhysicalKeyboard = useMediaQuery(
    "(hover: hover) and (pointer: fine)",
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Digits and separators only: everything else would parse to NaN.
    onDraftChange(event.target.value.replace(/[^\d.,]/g, "").replace(",", "."));
  };

  // On a touch screen the figure is only ever read, so it is grouped like
  // every other amount on the screen — «2.900.000», not «2900000». Under a
  // physical keyboard the raw text stays, because reformatting an input
  // while it is being typed into moves the caret and eats the decimal.
  const shown = hasPhysicalKeyboard
    ? draft.replace(".", ",")
    : formatDraft(draft);

  const secondary = variant === "secondary";

  return (
    <Box
      sx={{
        ...(secondary ? SECONDARY_SX : PRIMARY_SX),
        ...(keypadOpen ? KEYPAD_OPEN_SX : null),
      }}
    >
      <Box
        component="input"
        inputMode={hasPhysicalKeyboard ? "decimal" : "none"}
        value={shown}
        placeholder="0"
        aria-label={ariaLabel}
        readOnly={!hasPhysicalKeyboard}
        onClick={hasPhysicalKeyboard ? undefined : onOpenKeypad}
        // Typing replaces the suggested amount instead of appending to it.
        onFocus={(event: FocusEvent<HTMLInputElement>) =>
          event.currentTarget.select()
        }
        onChange={handleChange}
        sx={{
          ...INPUT_SX,
          fontSize: secondary ? "1.25rem" : "1.625rem",
          textAlign: secondary ? "right" : "left",
        }}
      />
      <Box component="span" sx={LABEL_SX}>
        {label}
      </Box>
    </Box>
  );
}
