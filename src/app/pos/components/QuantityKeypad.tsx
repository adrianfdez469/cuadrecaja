"use client";

import { memo } from "react";
import { Box, ButtonBase } from "@mui/material";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { shape } from "@/theme";

/**
 * The quantity sheet's own keypad.
 *
 * Twelve keys of 60px, as the redesign draws them. It exists so the system
 * keyboard never opens on this sheet: on a phone that keyboard is 200px tall
 * and rises from exactly where the sheet's confirm button is, so the cashier
 * would be typing a figure while the price it produces and the button that
 * commits it are both underneath it. The same reasoning already put a private
 * keypad on the charge screen (see `checkout/AmountKeypad`).
 *
 * The decimal key is rendered for every product so the grid never reflows
 * between one product and the next; it is simply inert where the product is
 * sold whole.
 */

const GRID_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 1,
  px: 1.75,
  pt: 1.25,
} as const;

const KEY_SX = {
  height: 60,
  borderRadius: `${shape.radius.md}px`,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "semantic.hue.neutral.surface",
  fontSize: "1.4375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  "@media (hover: hover)": {
    "&:hover": { bgcolor: "action.hover" },
  },
  "&.Mui-disabled": { color: "action.disabled" },
} as const;

export type QuantityKey = string;

interface QuantityKeypadProps {
  /** A digit, "," or "backspace". */
  onKey: (key: QuantityKey) => void;
  allowDecimal: boolean;
  disabled?: boolean;
}

const KEYS: QuantityKey[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ",",
  "0",
  "backspace",
];

function QuantityKeypadComponent({
  onKey,
  allowDecimal,
  disabled = false,
}: QuantityKeypadProps) {
  return (
    <Box sx={GRID_SX}>
      {KEYS.map((key) => {
        const inert = disabled || (key === "," && !allowDecimal);
        return (
          <ButtonBase
            key={key}
            sx={KEY_SX}
            disabled={inert}
            onClick={() => onKey(key)}
            aria-label={
              key === "backspace"
                ? "Borrar el último dígito"
                : key === ","
                  ? "Coma decimal"
                  : key
            }
          >
            {key === "backspace" ? <BackspaceOutlinedIcon /> : key}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export const QuantityKeypad = memo(QuantityKeypadComponent);
