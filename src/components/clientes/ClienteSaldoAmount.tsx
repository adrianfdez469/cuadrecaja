"use client";

import { Typography } from "@mui/material";
import { CLIENTES_COPY } from "@/constants/clientes";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { useMonedaOptions } from "@/hooks/useMonedaOptions";

/**
 * A cliente's live balance, in base currency.
 *
 * The currency comes from `useMonedaOptions`, never from a list built here: `NegocioMoneda`
 * does NOT contain the base currency (E-059).
 *
 * A balance of zero says nothing: in the table it shows the dash so the column keeps its
 * alignment, and everywhere else it draws nothing — a label repeated on every row is not
 * information.
 */
export function ClienteSaldoAmount({
  saldo,
  showDash = false,
}: Readonly<{ saldo: number; showDash?: boolean }>) {
  const { monedaBase } = useMonedaOptions();

  if (!(saldo > 0)) {
    if (!showDash) return null;
    return (
      <Typography
        component="span"
        variant="body2"
        sx={{ color: "semantic.text.secondary" }}
      >
        {CLIENTES_COPY.sinSaldo}
      </Typography>
    );
  }

  return (
    <Typography
      component="span"
      variant="body2"
      sx={{
        color: "semantic.money.negative.main",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatMontoEnMoneda(saldo, monedaBase)}
    </Typography>
  );
}

export default ClienteSaldoAmount;
