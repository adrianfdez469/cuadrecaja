"use client";

import { IconButton, Stack, Tooltip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EditIcon from "@mui/icons-material/Edit";
import { DESFASE_TOOLTIP_RECALCULAR } from "./desfaseCopy";

/**
 * Minimum comfortable touch target, in px. Exported because the mobile cards
 * draw the same actions outside this table: the size of a row action is decided
 * once, here, or the two views drift apart.
 */
export const ACTION_TOUCH_TARGET = 44;

/** Every row action, on any viewport, is exactly this size. */
export const actionButtonSx: SxProps<Theme> = {
  width: ACTION_TOUCH_TARGET,
  height: ACTION_TOUCH_TARGET,
};

/** Three 44 px targets + 8 px gaps + 8 px padding each side. */
export const ACTIONS_COLUMN_WIDTH = 164;

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
  /** Omitted when the user may not rename the period. */
  onEditarEtiqueta?: () => void;
}

/**
 * Contents of the fixed «Acciones» cell: a slot that states the stale figures
 * and opens the recalculation dialog, a slot that renames the period, and the
 * «Ver detalles» button. The first two are conditional — the stale one is only
 * ever rendered for a superadmin, and the rename only for whoever may close a
 * period — so the caller decides whether each appears.
 */
export default function AccionesCierreCell({
  desactualizado,
  onRecalculate,
  onVerDetalles,
  onEditarEtiqueta,
}: Readonly<Props>) {
  return (
    <Stack direction="row" spacing={1} justifyContent="center">
      {desactualizado && (
        <Tooltip title={DESFASE_TOOLTIP_RECALCULAR}>
          <IconButton
            onClick={onRecalculate}
            aria-label="Recalcular las cifras de este cierre"
            sx={{ ...actionButtonSx, color: "semantic.hue.caution.main" }}
          >
            <WarningAmberIcon />
          </IconButton>
        </Tooltip>
      )}
      {onEditarEtiqueta && (
        <Tooltip title="Editar la identificación de este cierre">
          <IconButton
            onClick={onEditarEtiqueta}
            aria-label="Editar la identificación de este cierre"
            sx={actionButtonSx}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Ver detalles del cierre">
        <IconButton
          onClick={onVerDetalles}
          color="primary"
          aria-label="Ver detalles del cierre"
          sx={actionButtonSx}
        >
          <ZoomInIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
