"use client";

import { Box, ButtonBase, Chip, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import CloseIcon from "@mui/icons-material/Close";
import { formatChangeSplit, formatMontoEnMoneda } from "@/utils/formatters";
import {
  CUSTOM_CHANGE_ID,
  type ChangeDistribution,
  type ChangeOption,
} from "@/app/pos/utils/changeMath";
import { shape } from "@/theme";

interface ChangeBlockProps {
  /** The change owed, in the base currency. */
  changeAmountBase: number;
  /** The split about to be handed over. */
  distribution: ChangeDistribution;
  /** Every complete way of handing it over the drawer can express. */
  options: ChangeOption[];
  selectedId: string | null;
  /** Splits the drawer cannot cover — still selectable, but marked. */
  unavailableIds: Set<string>;
  onSelect: (id: string) => void;
  /** There is a currency to type a split into by hand. */
  customAvailable: boolean;
  /** Opens the sheet with the hand-typed split. */
  onOpenCustom: () => void;
  base: string;
  /** Drawer balance shortfall for the split chosen. */
  error: { available: number; currency: string } | null;
  /** How much a hand-typed split exceeds the change by, in base. 0 otherwise. */
  overshootBase: number;
  /** Tip already committed on this sale, in base currency. */
  tipAmount: number;
  /** Turns the pending change into a tip. */
  onLeaveTip: () => void;
  /** Opens the per-currency tip sheet. */
  onOpenTip: () => void;
  /** Takes the tip back off the sale. */
  onClearTip?: () => void;
}

/**
 * The change, in green and at 24px, apart from the total — and the currency
 * it is handed back in, as tiles already converted so nobody subtracts by
 * hand. Every tile is a complete split the drawer can express; «Otro
 * reparto» opens the typed one for what those cannot say.
 *
 * Green means only this and success: money going back to the customer.
 * The tip lives here too, because this is the moment the customer says
 * «quédate con el vuelto».
 */

const positiveLine = (theme: Theme) =>
  alpha(theme.palette.semantic.hue.positive.main, 0.25);

const BLOCK_SX = {
  mx: 2,
  mt: 1.5,
  px: 1.75,
  pt: 1.5,
  pb: 1.5,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.positive.surface",
  border: "1px solid",
  borderColor: positiveLine,
} as const;

const HEAD_SX = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 1,
  flexWrap: "wrap",
} as const;

const LABEL_SX = {
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "semantic.hue.positive.main",
  opacity: 0.85,
} as const;

const AMOUNT_SX = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "semantic.hue.positive.main",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.2,
} as const;

const TILES_SX = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.75,
  mt: 1.125,
} as const;

const TILE_SX = {
  flex: "1 1 auto",
  minHeight: 38,
  px: 1.25,
  borderRadius: "9px",
  border: "1px solid",
  borderColor: positiveLine,
  bgcolor: "background.paper",
  color: "semantic.hue.positive.main",
  fontSize: "0.78125rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
} as const;

const TILE_ACTIVE_SX = {
  ...TILE_SX,
  bgcolor: "semantic.hue.positive.main",
  borderColor: "semantic.hue.positive.main",
  color: "semantic.hue.positive.contrast",
} as const;

const TILE_UNAVAILABLE_SX = {
  ...TILE_SX,
  opacity: 0.5,
  textDecoration: "line-through",
} as const;

const NOTE_SX = {
  display: "block",
  mt: 1,
  fontSize: "0.71875rem",
  fontWeight: 600,
  color: "semantic.hue.negative.main",
} as const;

const TIP_ROW_SX = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 0.5,
  mt: 1,
} as const;

const TIP_ACTION_SX = {
  minHeight: 36,
  px: 1,
  gap: 0.5,
  borderRadius: `${shape.radius.sm}px`,
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "primary.main",
} as const;

const TIP_ACTION_QUIET_SX = {
  ...TIP_ACTION_SX,
  color: "text.secondary",
} as const;

export function ChangeBlock({
  changeAmountBase,
  distribution,
  options,
  selectedId,
  unavailableIds,
  onSelect,
  customAvailable,
  onOpenCustom,
  base,
  error,
  overshootBase,
  tipAmount,
  onLeaveTip,
  onOpenTip,
  onClearTip,
}: ChangeBlockProps) {
  const split = formatChangeSplit(distribution);
  const customSelected = selectedId === CUSTOM_CHANGE_ID;

  return (
    <Box sx={BLOCK_SX} aria-live="polite">
      <Box sx={HEAD_SX}>
        <Box component="span" sx={LABEL_SX}>
          Vuelto
        </Box>
        <Box component="span" sx={AMOUNT_SX}>
          {split || formatMontoEnMoneda(changeAmountBase, base)}
        </Box>
      </Box>

      {(options.length > 1 || customAvailable) && (
        <Box sx={TILES_SX} role="radiogroup" aria-label="Moneda del vuelto">
          {options.map((option) => {
            const selected = option.id === selectedId;
            const unavailable = unavailableIds.has(option.id);
            return (
              <ButtonBase
                key={option.id}
                role="radio"
                aria-checked={selected}
                title={unavailable ? "Sin saldo en caja" : undefined}
                onClick={() => onSelect(option.id)}
                sx={
                  selected
                    ? TILE_ACTIVE_SX
                    : unavailable
                      ? TILE_UNAVAILABLE_SX
                      : TILE_SX
                }
              >
                {formatChangeSplit(option.distribution)}
              </ButtonBase>
            );
          })}
          {customAvailable && (
            <ButtonBase
              role="radio"
              aria-checked={customSelected}
              onClick={onOpenCustom}
              sx={customSelected ? TILE_ACTIVE_SX : TILE_SX}
            >
              {customSelected && split ? split : "Otro reparto"}
            </ButtonBase>
          )}
        </Box>
      )}

      {error && (
        <Typography component="span" sx={NOTE_SX}>
          En caja hay {formatMontoEnMoneda(error.available, error.currency)}.
          {options.length > 1 || customAvailable
            ? " Elige otra forma de dar el cambio."
            : " Reparte el cambio en otra moneda."}
        </Typography>
      )}

      {overshootBase > 0 && (
        <Typography component="span" sx={NOTE_SX}>
          El reparto entrega {formatMontoEnMoneda(overshootBase, base)} de más.
          Ajústalo.
        </Typography>
      )}

      <Box sx={TIP_ROW_SX}>
        {tipAmount > 0 ? (
          <Chip
            icon={<VolunteerActivismIcon />}
            label={`Propina ${formatMontoEnMoneda(tipAmount, base)}`}
            color="secondary"
            variant="outlined"
            size="small"
            onClick={onOpenTip}
            onDelete={onClearTip}
            deleteIcon={<CloseIcon />}
            sx={{ fontWeight: 600 }}
          />
        ) : (
          <>
            <ButtonBase onClick={onLeaveTip} sx={TIP_ACTION_SX}>
              <VolunteerActivismIcon fontSize="small" />
              Dejar como propina
            </ButtonBase>
            <ButtonBase onClick={onOpenTip} sx={TIP_ACTION_QUIET_SX}>
              Otro monto
            </ButtonBase>
          </>
        )}
      </Box>
    </Box>
  );
}
