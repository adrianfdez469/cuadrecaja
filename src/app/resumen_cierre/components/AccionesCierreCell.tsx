"use client";

import { IconButton, Stack, Tooltip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DESFASE_TOOLTIP_RECALCULAR } from "./desfaseCopy";

/** Two 44 px targets + 8 px gap + 8 px padding each side. */
export const ACTIONS_COLUMN_WIDTH = 112;

const stickyBase: SxProps<Theme> = {
  position: "sticky",
  right: 0,
  width: ACTIONS_COLUMN_WIDTH,
  minWidth: ACTIONS_COLUMN_WIDTH,
  px: 1,
  borderLeft: 1,
  borderLeftColor: "semantic.surface.border",
  textAlign: "center",
};

/**
 * The `sx` of the three kinds of cell of the fixed actions column. Opaque
 * backgrounds on purpose: without them the amounts scroll under the icons.
 */
export const stickyActionsCellSx = {
  // Fixed on both axes: above the other sticky header cells.
  head: {
    ...stickyBase,
    zIndex: 3,
    bgcolor: "semantic.surface.raised",
  } satisfies SxProps<Theme>,
  // Follows its row's hover, which MUI paints on the <tr>, not on cells.
  body: {
    ...stickyBase,
    zIndex: 1,
    bgcolor: "semantic.surface.raised",
    "tr:hover > &": { bgcolor: "semantic.surface.sunken" },
  } satisfies SxProps<Theme>,
  totals: {
    ...stickyBase,
    zIndex: 1,
    bgcolor: "semantic.surface.sunken",
  } satisfies SxProps<Theme>,
};

interface Props {
  desactualizado: boolean;
  onRecalculate: () => void;
  onVerDetalles: () => void;
}

/**
 * Contents of the fixed «Acciones» cell: one slot that states the stale
 * figures and opens the recalculation dialog, plus the «Ver detalles»
 * button. The stale slot is only ever rendered for a superadmin — the only
 * role that can act on it — so the caller decides whether it appears.
 */
export default function AccionesCierreCell({
  desactualizado,
  onRecalculate,
  onVerDetalles,
}: Readonly<Props>) {
  return (
    <Stack direction="row" spacing={1} justifyContent="center">
      {desactualizado && (
        <Tooltip title={DESFASE_TOOLTIP_RECALCULAR}>
          <IconButton
            onClick={onRecalculate}
            aria-label="Recalcular las cifras de este cierre"
            sx={{ color: "semantic.hue.caution.main" }}
          >
            <WarningAmberIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Ver detalles del cierre">
        <IconButton
          onClick={onVerDetalles}
          color="primary"
          aria-label="Ver detalles del cierre"
        >
          <ZoomInIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
