"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { shape } from "@/theme";

interface ChangeBlockProps {
  /** The split about to be handed over, as text — «350,00 CUP». */
  changeLabel: string;
  /** Whether there is more than one way to split it — gates the sheet. */
  interactive: boolean;
  onOpenDetail: () => void;
  /** Turns the pending change into a tip. */
  onLeaveTip: () => void;
  /** Opens the per-currency tip sheet. */
  onOpenTip: () => void;
  base: string;
  /** Drawer balance shortfall for the split chosen. */
  error: { available: number; currency: string } | null;
  /** How much a hand-typed split exceeds the change by, in base. 0 otherwise. */
  overshootBase: number;
}

/**
 * The change, in green and at 24px, apart from the total: the one figure
 * the cashier still has to act on. «›» opens how to hand it over; under it,
 * the two ways the customer can say «quédate con el vuelto». Green means
 * only this and success — money going back to the customer.
 */

const positiveLine = (theme: Theme) =>
  alpha(theme.palette.semantic.hue.positive.main, 0.25);

const BLOCK_SX = {
  mx: 1.75,
  mt: 1.5,
  px: 1.75,
  py: 1.5,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.positive.surface",
  border: "1px solid",
  borderColor: positiveLine,
} as const;

const ROW_SX = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 1,
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
  display: "flex",
  alignItems: "center",
  gap: 0.25,
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "semantic.hue.positive.main",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.2,
  borderRadius: `${shape.radius.sm}px`,
  minHeight: 44,
  mr: -0.5,
  px: 0.5,
} as const;

const LINKS_SX = {
  display: "flex",
  flexWrap: "wrap",
  gap: 2.25,
  mt: 0.5,
} as const;

const LINK_SX = {
  minHeight: 36,
  fontSize: "0.84375rem",
  fontWeight: 600,
  color: "semantic.hue.positive.main",
  textDecoration: "underline",
  textUnderlineOffset: 3,
} as const;

const NOTE_SX = {
  display: "block",
  mt: 1,
  fontSize: "0.71875rem",
  fontWeight: 600,
  color: "semantic.hue.negative.main",
} as const;

export function ChangeBlock({
  changeLabel,
  interactive,
  onOpenDetail,
  onLeaveTip,
  onOpenTip,
  base,
  error,
  overshootBase,
}: ChangeBlockProps) {
  return (
    <Box sx={BLOCK_SX} aria-live="polite">
      <Box sx={ROW_SX}>
        <Box component="span" sx={LABEL_SX}>
          Cambio
        </Box>
        {interactive ? (
          <ButtonBase
            onClick={onOpenDetail}
            aria-label="Elegir cómo dar el cambio"
            sx={AMOUNT_SX}
          >
            {changeLabel}
            <ChevronRightIcon fontSize="small" />
          </ButtonBase>
        ) : (
          <Box component="span" sx={AMOUNT_SX}>
            {changeLabel}
          </Box>
        )}
      </Box>

      {error && (
        <Typography component="span" sx={NOTE_SX}>
          En caja hay {formatMontoEnMoneda(error.available, error.currency)}.
          {interactive
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

      <Box sx={LINKS_SX}>
        <ButtonBase onClick={onLeaveTip} sx={LINK_SX}>
          Dejar como propina
        </ButtonBase>
        <ButtonBase onClick={onOpenTip} sx={LINK_SX}>
          Otro monto
        </ButtonBase>
      </Box>
    </Box>
  );
}
