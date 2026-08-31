"use client";

import { memo } from "react";
import { Box, ButtonBase } from "@mui/material";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { BillPad } from "@/app/pos/components/checkout/BillPad";
import { shape, touch } from "@/theme";

export type KeypadTab = "keys" | "bills";

/** A key of the pad: a digit, the decimal comma, «000» or the backspace. */
export type KeypadKey = string;

interface InlineKeypadProps {
  /** Whether the currency has cents — decides between «,» and «000». */
  allowsDecimals: boolean;
  /** Active bills for this currency; empty hides the bills tab. */
  denominations: number[];
  tab: KeypadTab;
  onTabChange: (tab: KeypadTab) => void;
  onPress: (key: KeypadKey) => void;
  /** The bills tallied so far, on the bills tab. */
  bills: number[];
  onBillsChange: (bills: number[]) => void;
}

/**
 * The checkout's own keypad, drawn into the screen rather than opened over
 * it: 56px keys on the neutral wash, «000» where the currency has no cents
 * and the comma where it does, and «⌫». Never the system keyboard, which
 * would cover the change the cashier is about to count out.
 *
 * The bill tally that used to be a second tab of the keypad sheet stays as a
 * second tab here: tapping the bills received is still the quickest way to
 * enter a large cash amount without a mistake.
 */

const TABS_SX = { display: "flex", gap: 1, px: 2, pt: 1.5 } as const;

const TAB_SX = {
  flex: 1,
  height: touch.min,
  borderRadius: `${shape.radius.sm}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.secondary",
  fontSize: "0.84375rem",
  fontWeight: 600,
} as const;

const TAB_ACTIVE_SX = {
  ...TAB_SX,
  bgcolor: "primary.main",
  color: "primary.contrastText",
} as const;

const GRID_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 1,
  px: 2,
  pt: 1.5,
} as const;

const KEY_SX = {
  height: touch.comfortable,
  borderRadius: `${shape.radius.sm}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.primary",
  fontSize: "1.375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
} as const;

function InlineKeypadComponent({
  allowsDecimals,
  denominations,
  tab,
  onTabChange,
  onPress,
  bills,
  onBillsChange,
}: InlineKeypadProps) {
  const hasBills = denominations.length > 0;
  const keys: KeypadKey[] = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    allowsDecimals ? "," : "000",
    "0",
    "backspace",
  ];

  return (
    <Box>
      {hasBills && (
        <Box sx={TABS_SX} role="tablist">
          <ButtonBase
            role="tab"
            aria-selected={tab === "keys"}
            onClick={() => onTabChange("keys")}
            sx={tab === "keys" ? TAB_ACTIVE_SX : TAB_SX}
          >
            Teclado
          </ButtonBase>
          <ButtonBase
            role="tab"
            aria-selected={tab === "bills"}
            onClick={() => onTabChange("bills")}
            sx={tab === "bills" ? TAB_ACTIVE_SX : TAB_SX}
          >
            Billetes
          </ButtonBase>
        </Box>
      )}

      {tab === "keys" || !hasBills ? (
        <Box sx={GRID_SX}>
          {keys.map((key) => (
            <ButtonBase
              key={key}
              onClick={() => onPress(key)}
              aria-label={key === "backspace" ? "Borrar" : key}
              sx={KEY_SX}
            >
              {key === "backspace" ? <BackspaceOutlinedIcon /> : key}
            </ButtonBase>
          ))}
        </Box>
      ) : (
        <BillPad
          denominations={denominations}
          bills={bills}
          onChange={onBillsChange}
        />
      )}
    </Box>
  );
}

export const InlineKeypad = memo(InlineKeypadComponent);
