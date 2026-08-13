"use client";

import { useState } from "react";
import type { ChangeEvent, FocusEvent, ReactNode } from "react";
import { Box, Stack, useMediaQuery } from "@mui/material";

interface AmountFieldProps {
  /** Amount currently held by the payment line. */
  value: number;
  ariaLabel: string;
  /** Rendered inside the field's underline, at its right edge. */
  action?: ReactNode;
  onChange: (amount: number) => void;
  /** Opens the on-screen keypad. Never called on a device with a keyboard. */
  onOpenKeypad: () => void;
  /** Keeps the underline highlighted while the keypad owns the focus. */
  keypadOpen?: boolean;
}

/**
 * The amount input of a payment card — one per cash line, one more for the
 * transfer embedded in it.
 *
 * Two input methods, decided by the device rather than by a setting: where
 * there is a mouse or trackpad there is a physical keyboard, so this behaves
 * like any other text field and the custom keypad never opens. On a
 * touch-only device the system keyboard is suppressed (`inputMode="none"`)
 * and tapping opens `AmountKeypad` instead, which is far quicker to hit with
 * a thumb than a phone keyboard.
 *
 * While typing, the raw text is kept locally: parsing straight into a number
 * on every keystroke would erase a trailing decimal separator the moment it
 * is typed ("12," → 12 → "12"), making decimals impossible to enter.
 */
export function AmountField({
  value,
  ariaLabel,
  action,
  onChange,
  onOpenKeypad,
  keypadOpen = false,
}: AmountFieldProps) {
  // `hover` rules out touch screens; `pointer: fine` rules out anything
  // driven by a thumb. Both together are what "laptop or desktop" means to
  // CSS, and a touchscreen laptop still qualifies — correctly, since it does
  // have a keyboard.
  const hasPhysicalKeyboard = useMediaQuery(
    "(hover: hover) and (pointer: fine)",
  );

  const [draft, setDraft] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Digits and separators only: everything else would parse to NaN, and
    // silently turning a typo into 0 loses an amount the cashier can see.
    const cleaned = event.target.value.replace(/[^\d.,]/g, "");
    setDraft(cleaned);
    const parsed = Number(cleaned.replace(",", "."));
    onChange(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={0.5}
      sx={{
        borderBottom: "2px solid",
        // While the keypad is open focus lives inside its dialog, so
        // :focus-within alone would drop the highlight on the very field
        // being edited.
        borderColor: keypadOpen ? "primary.main" : "divider",
        "&:focus-within": { borderColor: "primary.main" },
      }}
    >
      <Box
        component="input"
        inputMode={hasPhysicalKeyboard ? "decimal" : "none"}
        value={draft ?? (value || "")}
        placeholder="0"
        aria-label={ariaLabel}
        onClick={hasPhysicalKeyboard ? undefined : onOpenKeypad}
        // Typing replaces the suggested amount instead of appending to it —
        // the field arrives preloaded with the total, and "400" + "1234" is
        // never what anyone meant.
        onFocus={(event: FocusEvent<HTMLInputElement>) =>
          event.currentTarget.select()
        }
        onChange={handleChange}
        // Handing the value back to the line's own number drops any trailing
        // separator left over from typing.
        onBlur={() => setDraft(null)}
        sx={{
          flex: 1,
          minWidth: 0,
          border: 0,
          bgcolor: "transparent",
          color: "text.primary",
          font: "inherit",
          fontSize: "1.4rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          py: 0.5,
          outline: "none",
        }}
      />
      {action}
    </Stack>
  );
}
