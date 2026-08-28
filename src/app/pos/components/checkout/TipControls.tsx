"use client";

import { Box, ButtonBase } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { shape, touch } from "@/theme";

/**
 * The tip, once there is one: a 44px chip on the accent wash with the
 * amount and a «✕» to take it back. Tapping the amount reopens the sheet.
 */

const CHIP_WRAP_SX = { px: 1.75, pt: 1.5 } as const;

const CHIP_SX = {
  display: "inline-flex",
  alignItems: "center",
  height: touch.min,
  pl: 2,
  pr: 1,
  gap: 1.125,
  borderRadius: `${shape.radius.pill}px`,
  bgcolor: "semantic.hue.accent.surface",
  color: "primary.main",
  fontSize: "0.84375rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
} as const;

const CHIP_REMOVE_SX = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  color: "primary.main",
} as const;

interface TipChipProps {
  amountBase: number;
  base: string;
  onOpen: () => void;
  onClear: () => void;
}

export function TipChip({ amountBase, base, onOpen, onClear }: TipChipProps) {
  return (
    <Box sx={CHIP_WRAP_SX}>
      <Box sx={CHIP_SX}>
        <ButtonBase onClick={onOpen} sx={{ fontWeight: 700 }}>
          Propina {formatMontoEnMoneda(amountBase, base)}
        </ButtonBase>
        <ButtonBase
          onClick={onClear}
          aria-label="Quitar la propina"
          sx={CHIP_REMOVE_SX}
        >
          <CloseIcon fontSize="small" />
        </ButtonBase>
      </Box>
    </Box>
  );
}

/** «Agregar propina», where there is no change to leave as one. */

const LINK_WRAP_SX = { px: 1.75, pt: 1.25 } as const;

const LINK_SX = {
  minHeight: touch.min,
  px: 0.5,
  mx: -0.5,
  fontSize: "0.84375rem",
  fontWeight: 600,
  color: "primary.main",
  borderRadius: `${shape.radius.sm}px`,
} as const;

export function TipLink({ onOpen }: { onOpen: () => void }) {
  return (
    <Box sx={LINK_WRAP_SX}>
      <ButtonBase onClick={onOpen} sx={LINK_SX}>
        Agregar propina
      </ButtonBase>
    </Box>
  );
}
