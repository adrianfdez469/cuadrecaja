"use client";

import { useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { convertToBase } from "@/lib/currency";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { ChangeDistribution } from "@/app/pos/utils/changeMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface CustomChangeFieldsProps {
  /** The currencies the cashier states. The remainder one is not among them. */
  currencies: string[];
  amounts: ChangeDistribution;
  /** The currency filled in with whatever the typed amounts leave over. */
  remainderCurrency: string;
  remainderAmount: number;
  /** How much the typed amounts exceed the change by, in base. */
  overshootBase: number;
  rates: ITasaSnapshot;
  base: string;
  onChange: (currency: string, amount: number) => void;
}

/**
 * Hand-typed change: one field per currency, with the finest one filled in
 * automatically so the split always adds up to what is owed.
 *
 * The auto-filled row is not editable on purpose. Letting both sides be typed
 * would put the cashier back in charge of the subtraction — which is exactly
 * what the pre-computed options were introduced to take away, after production
 * data showed 215 sales fixed up by hand.
 */
export function CustomChangeFields({
  currencies,
  amounts,
  remainderCurrency,
  remainderAmount,
  overshootBase,
  rates,
  base,
  onChange,
}: CustomChangeFieldsProps) {
  // Text, not numbers: the parsed amount lives in the hook, but "1," and a
  // half-deleted field only exist as text and would be erased on every
  // keystroke if the value were rendered back from the number.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(amounts)
        .filter(([, amount]) => amount > 0)
        .map(([currency, amount]) => [currency, String(amount)]),
    ),
  );

  const handleChange =
    (currency: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const cleaned = event.target.value.replace(/[^\d.,]/g, "");
      setDrafts((prev) => ({ ...prev, [currency]: cleaned }));
      const amount = Number(cleaned.replace(",", "."));
      onChange(currency, Number.isFinite(amount) && amount > 0 ? amount : 0);
    };

  return (
    <Stack gap={0.5} sx={{ px: 1.25, pb: 1.25 }}>
      {currencies.map((currency) => {
        const text = drafts[currency] ?? "";
        const amount = amounts[currency] ?? 0;
        return (
          <Stack key={currency} direction="row" alignItems="center" gap={1}>
            <Chip label={currency} size="small" sx={{ flexShrink: 0 }} />
            <Box
              component="input"
              inputMode="decimal"
              value={text}
              placeholder="0"
              aria-label={`Cambio en ${currency}`}
              onFocus={(event: FocusEvent<HTMLInputElement>) =>
                event.currentTarget.select()
              }
              onChange={handleChange(currency)}
              sx={{
                flex: 1,
                minWidth: 0,
                border: 0,
                bgcolor: "transparent",
                color: "text.primary",
                font: "inherit",
                fontSize: "1.125rem",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
                outline: "none",
              }}
            />
            {/* Without the equivalent there is no way to tell how much of the
                change a foreign amount has already covered. */}
            {amount > 0 && currency !== base && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexShrink: 0 }}
              >
                ≈{" "}
                {formatMontoEnMoneda(
                  convertToBase(amount, currency, rates, base),
                  base,
                )}
              </Typography>
            )}
          </Stack>
        );
      })}

      <Divider sx={{ my: 0.25 }} />

      {/* No chip and no field: the row reads as a total, not as one more
          amount waiting to be typed into. */}
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          Resto
        </Typography>
        <Typography
          variant="body1"
          fontWeight={700}
          sx={{
            flex: 1,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMontoEnMoneda(remainderAmount, remainderCurrency)}
        </Typography>
      </Stack>

      {overshootBase > 0 && (
        <Typography variant="caption" color="error" fontWeight={600}>
          Te pasas por {formatMontoEnMoneda(overshootBase, base)}. Baja algún
          monto.
        </Typography>
      )}
    </Stack>
  );
}
