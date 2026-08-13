"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Chip, Menu, MenuItem } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

interface CurrencyChipSelectProps {
  /** Currency the card is currently denominated in. */
  value: string;
  /**
   * Currencies this card could switch to. Empty means the chip is a plain
   * label — there is nothing to switch to, so nothing suggests otherwise.
   */
  options: string[];
  onChange: (currency: string) => void;
}

/**
 * The currency badge on a payment card, doubling as the control that
 * re-denominates it. Before this, changing the currency of a payment meant
 * deleting the card and adding a new one from "Agregar forma de pago".
 */
export function CurrencyChipSelect({
  value,
  options,
  onChange,
}: CurrencyChipSelectProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const chipSx = {
    height: 28,
    fontSize: "0.9rem",
    fontWeight: 700,
    px: 0.5,
  } as const;

  if (options.length === 0) {
    return <Chip label={value} color="primary" variant="filled" sx={chipSx} />;
  }

  const open = (event: MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);

  return (
    <>
      <Chip
        label={value}
        color="primary"
        variant="filled"
        onClick={open}
        // `onDelete` is what renders the trailing icon; here it opens the same
        // menu the chip body does, so the caret is not a dead pixel target.
        onDelete={open}
        deleteIcon={<ArrowDropDownIcon sx={{ color: "inherit !important" }} />}
        aria-label={`Cambiar la moneda de este pago (${value})`}
        sx={chipSx}
      />
      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        {options.map((currency) => (
          <MenuItem
            key={currency}
            onClick={() => {
              onChange(currency);
              setAnchorEl(null);
            }}
            sx={{ minHeight: 44, fontWeight: 600 }}
          >
            {currency}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
