"use client";

import { FormControl, MenuItem, Select } from "@mui/material";

type DisplayCurrencySelectProps = {
  value: string;
  onChange: (currency: string) => void;
  currencies: string[];
  /** Hidden when the business only operates in one currency. */
  visible?: boolean;
};

/**
 * Presentation-only currency switch: it re-expresses base-currency figures at
 * current rates, it never re-queries.
 */
export function DisplayCurrencySelect({
  value,
  onChange,
  currencies,
  visible = true,
}: DisplayCurrencySelectProps) {
  if (!visible || currencies.length <= 1) return null;

  return (
    <FormControl size="small" sx={{ minWidth: 90 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        displayEmpty
      >
        {currencies.map((code) => (
          <MenuItem key={code} value={code}>
            {code}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
