"use client";

import { Box, Typography } from "@mui/material";
import { BottomSheet } from "@/app/pos/components/checkout/BottomSheet";
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
 * «Cómo dar el cambio»: every pre-computed row is a complete split, so there
 * is no arithmetic for the cashier to get wrong. «Otro reparto» is the way
 * out for what those cannot express, and only when there is a currency to
 * type into. «Listo» lives in the sheet, never under the fold.
 */

const TOTAL_SX = {
  px: 2,
  pb: 0.5,
  fontSize: "0.78125rem",
  color: "text.secondary",
  fontVariantNumeric: "tabular-nums",
} as const;

const SPLIT_SX = {
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
} as const;

const NOTE_SX = {
  px: 2,
  pt: 1,
  fontSize: "0.71875rem",
  fontWeight: 600,
  color: "semantic.hue.negative.main",
} as const;

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
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Cómo dar el cambio"
      primaryLabel="Listo"
      onPrimary={onClose}
    >
      <Typography sx={TOTAL_SX}>
        {formatMontoEnMoneda(changeTotalBase, base)} a dar
      </Typography>

      <Box>
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
              <Box
                component="span"
                sx={{
                  ...SPLIT_SX,
                  color: unavailable ? "text.disabled" : "text.primary",
                }}
              >
                {formatChangeSplit(option.distribution)}
              </Box>
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
            <Box component="span" sx={SPLIT_SX}>
              Otro reparto
            </Box>
          </ChangeOptionRow>
        )}
      </Box>

      {firstError && (
        <Typography sx={NOTE_SX}>
          En caja hay{" "}
          {formatMontoEnMoneda(firstError.available, firstError.currency)}.
          Elige otra forma de dar el cambio.
        </Typography>
      )}
    </BottomSheet>
  );
}
