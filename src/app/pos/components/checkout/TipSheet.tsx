"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { Box, Button, Chip, Drawer, Stack, Typography } from "@mui/material";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { tipTotalFromAmounts, type TipAmounts } from "@/app/pos/utils/tipMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface TipSheetProps {
  open: boolean;
  /** Every currency the business takes — the tip need not be in the one paid. */
  currencies: string[];
  /** Amounts currently committed, so reopening resumes rather than resets. */
  value: TipAmounts;
  rates: ITasaSnapshot;
  base: string;
  onClose: () => void;
  onConfirm: (amounts: TipAmounts) => void;
}

/**
 * Tip entry, one amount per currency.
 *
 * Lives in a sheet rather than beside the payment cards because a tip is not
 * a form of payment: leaving it inline made the checkout read as if the
 * business were charging one more line. It is also why the tip is stated per
 * currency — a customer paying in USD may leave the tip in CUP, or split it
 * across both, and guessing the currency from the payment would put the
 * money in the wrong pile at closing.
 */
export function TipSheet({
  open,
  currencies,
  value,
  rates,
  base,
  onClose,
  onConfirm,
}: TipSheetProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // The sheet is mounted for the whole sale, so its state has to be seeded
  // each time it opens; otherwise it would still hold the previous edit.
  useEffect(() => {
    if (!open) return;
    setDrafts(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, monto]) => monto > 0)
          .map(([moneda, monto]) => [moneda, String(monto)]),
      ),
    );
  }, [open, value]);

  const parsed: TipAmounts = Object.fromEntries(
    Object.entries(drafts).map(([moneda, text]) => {
      const amount = Number(text.replace(",", "."));
      return [moneda, Number.isFinite(amount) && amount > 0 ? amount : 0];
    }),
  );
  const totalBase = tipTotalFromAmounts(parsed, rates, base);

  const handleChange =
    (moneda: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const cleaned = event.target.value.replace(/[^\d.,]/g, "");
      setDrafts((prev) => ({ ...prev, [moneda]: cleaned }));
    };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // Same reason as ChangeSheet: this portals to document.body and the
      // cart sidebar sits at drawer + 1, so it needs an explicit zIndex.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      <Stack
        gap={1.25}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
        >
          <Typography variant="caption" color="text.secondary">
            PROPINA
          </Typography>
          {totalBase > 0 && (
            <Typography
              variant="caption"
              color="secondary.main"
              fontWeight={700}
            >
              {formatMontoEnMoneda(totalBase, base)} en total
            </Typography>
          )}
        </Stack>

        <Stack gap={0.75}>
          {currencies.map((moneda) => {
            const text = drafts[moneda] ?? "";
            const amount = parsed[moneda] ?? 0;
            const active = amount > 0;
            return (
              <Stack
                key={moneda}
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                  p: 1.25,
                  minHeight: 56,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: active ? "secondary.main" : "divider",
                }}
              >
                <Chip label={moneda} size="small" />
                <Box
                  component="input"
                  inputMode="decimal"
                  value={text}
                  placeholder="0"
                  aria-label={`Propina en ${moneda}`}
                  onFocus={(event: FocusEvent<HTMLInputElement>) =>
                    event.currentTarget.select()
                  }
                  onChange={handleChange(moneda)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    bgcolor: "transparent",
                    color: "text.primary",
                    font: "inherit",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    outline: "none",
                  }}
                />
                {/* The equivalent is what makes a mixed tip legible: without
                    it there is no way to tell what 2 USD plus 300 CUP adds
                    up to. Hidden for the base currency, where it is noise. */}
                {active && moneda !== base && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexShrink: 0 }}
                  >
                    ≈{" "}
                    {formatMontoEnMoneda(
                      tipTotalFromAmounts({ [moneda]: amount }, rates, base),
                      base,
                    )}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Stack>

        <Stack direction="row" gap={1}>
          <Button
            onClick={() => {
              setDrafts({});
              onConfirm({});
              onClose();
            }}
            sx={{ minHeight: 48, flexShrink: 0 }}
            color="inherit"
          >
            Quitar
          </Button>
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            onClick={() => {
              onConfirm(parsed);
              onClose();
            }}
            sx={{ minHeight: 48 }}
          >
            Listo
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
