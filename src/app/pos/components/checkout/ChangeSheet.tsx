"use client";

import { Button, Drawer, Stack, Typography } from "@mui/material";
import { ChangeOptionRow } from "@/app/pos/components/checkout/ChangeOptionRow";
import { CustomChangeFields } from "@/app/pos/components/checkout/CustomChangeFields";
import { formatChangeSplit, formatMontoEnMoneda } from "@/utils/formatters";
import {
  CUSTOM_CHANGE_ID,
  type ChangeDistribution,
  type ChangeErrors,
  type ChangeOption,
} from "@/app/pos/utils/changeMath";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/** Everything the hand-typed row needs, as the hook hands it over. */
interface CustomChangeState {
  amounts: ChangeDistribution;
  currencies: string[];
  remainderCurrency: string;
  remainderAmount: number;
  setAmount: (currency: string, amount: number) => void;
}

interface ChangeSheetProps {
  open: boolean;
  options: ChangeOption[];
  selectedId: string | null;
  /** Splits the drawer cannot cover — still selectable, but marked. */
  unavailableIds: Set<string>;
  /** Drawer shortfalls for the currently selected split. */
  errors: ChangeErrors;
  /** How much the typed split exceeds the change by, in base. 0 otherwise. */
  overshootBase: number;
  custom: CustomChangeState;
  changeTotalBase: number;
  rates: ITasaSnapshot;
  base: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

/**
 * Picks how to hand the change over. Every pre-computed row is a complete
 * split, so there is no arithmetic for the cashier to get wrong and no way to
 * leave the drawer holding an amount that does not add up.
 *
 * The last row is the way out for what those cannot express — a third
 * currency, an amount off the denomination grid. It sits below them, and only
 * when there is a currency to type into: it is the exception, not the offer.
 */
export function ChangeSheet({
  open,
  options,
  selectedId,
  unavailableIds,
  errors,
  overshootBase,
  custom,
  changeTotalBase,
  rates,
  base,
  onClose,
  onSelect,
}: ChangeSheetProps) {
  const firstError = Object.values(errors).find((error) => error !== null);
  const customSelected = selectedId === CUSTOM_CHANGE_ID;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // See AmountKeypad.tsx: the pinned cart sidebar and the mobile
      // CartDrawer sit at theme.zIndex.drawer + 1, and this Drawer portals to
      // document.body regardless of nesting, so it needs an explicit zIndex
      // above them or it renders behind whichever one is on screen.
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
            CÓMO DAR EL CAMBIO
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatMontoEnMoneda(changeTotalBase, base)} a dar
          </Typography>
        </Stack>

        <Stack gap={0.75}>
          {options.map((option) => {
            const selected = option.id === selectedId;
            const unavailable = unavailableIds.has(option.id);
            return (
              <ChangeOptionRow
                key={option.id}
                selected={selected}
                onSelect={() => onSelect(option.id)}
                end={
                  unavailable && (
                    <Typography variant="caption" color="error">
                      Sin saldo
                    </Typography>
                  )
                }
              >
                <Typography
                  variant="body1"
                  fontWeight={selected ? 700 : 500}
                  color={unavailable ? "text.disabled" : "text.primary"}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatChangeSplit(option.distribution)}
                </Typography>
              </ChangeOptionRow>
            );
          })}

          {custom.currencies.length > 0 && (
            <ChangeOptionRow
              selected={customSelected}
              onSelect={() => onSelect(CUSTOM_CHANGE_ID)}
              detail={
                customSelected && (
                  <CustomChangeFields
                    currencies={custom.currencies}
                    amounts={custom.amounts}
                    remainderCurrency={custom.remainderCurrency}
                    remainderAmount={custom.remainderAmount}
                    overshootBase={overshootBase}
                    rates={rates}
                    base={base}
                    onChange={custom.setAmount}
                  />
                )
              }
            >
              <Typography
                variant="body1"
                fontWeight={customSelected ? 700 : 500}
                color="text.primary"
              >
                Otro reparto
              </Typography>
            </ChangeOptionRow>
          )}
        </Stack>

        {firstError && (
          <Typography variant="caption" color="error">
            En caja hay{" "}
            {formatMontoEnMoneda(firstError.available, firstError.currency)}.
            Elige otra forma de dar el cambio.
          </Typography>
        )}

        <Button variant="contained" onClick={onClose} sx={{ minHeight: 48 }}>
          Listo
        </Button>
      </Stack>
    </Drawer>
  );
}
