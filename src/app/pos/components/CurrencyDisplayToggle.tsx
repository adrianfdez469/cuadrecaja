"use client";

import { IconButton, Tooltip } from "@mui/material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import { useMonedasAlternativas } from "@/components/MultiCurrencyAmount/useMonedasAlternativas";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";

/**
 * Turns the foreign-currency equivalents on the price cards on and off, for
 * this cashier only. It sits in the POS toolbar, next to the other things
 * that change what the screen shows, and renders nothing at all when the
 * business has a single currency — there would be nothing to convert to.
 */
export function CurrencyDisplayToggle() {
  const { hasAlternativas } = useMonedasAlternativas();
  const { show, toggle } = useShowAlternativeCurrencies();

  if (!hasAlternativas) return null;

  return (
    <Tooltip
      title={
        show
          ? "Ocultar precios en otras monedas"
          : "Mostrar precios en otras monedas"
      }
    >
      <IconButton
        size="small"
        onClick={toggle}
        color={show ? "primary" : "default"}
        aria-pressed={show}
        aria-label="Mostrar precios en otras monedas"
      >
        <CurrencyExchangeIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
