"use client";

import { Box, Stack, TextField, Typography } from "@mui/material";

import { AppDialog } from "@/components/AppDialog";
import { QAB_UNPUBLISH_REASON_MAX_LENGTH } from "@/constants/qab";
import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import { shape } from "@/theme/tokens";

export interface UnpublishDialogProps {
  open: boolean;
  localNombre: string;
  /** `true` when reached from «Cambiar el motivo» on an already unpublished local. */
  editingReason: boolean;
  reason: string;
  onReasonChange: (next: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const REASON_ROWS = 3;

/**
 * Unpublishing, with the message the buyer will read.
 *
 * `primary` and NOT `danger`: `AppDialog`'s danger tone is documented as «for
 * anything that destroys data», and unpublishing destroys nothing — the local,
 * its data and its address stay, and republishing is a switch. Painting it red
 * would equate it with deleting the local and devalue the red where it matters.
 */
export function UnpublishDialog({
  open,
  localNombre,
  editingReason,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: Readonly<UnpublishDialogProps>) {
  const warn = reason.length >= TIENDA_ONLINE_UI.unpublishReasonWarnAt;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={
        editingReason ? "Cambiar el motivo" : `Despublicar «${localNombre}»`
      }
      subtitle="Deja de aparecer en la tienda online. Puedes volver a publicarlo cuando quieras."
      confirm={{
        label: editingReason ? "Guardar el motivo" : "Despublicar",
        onClick: onConfirm,
        tone: "primary",
      }}
    >
      <Stack spacing={1}>
        <TextField
          label="Motivo (opcional)"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          multiline
          rows={REASON_ROWS}
          fullWidth
          helperText="Lo va a ver quien entre a tu tienda. Por ejemplo: «Cerrado por inventario, volvemos el lunes»."
          // A hard stop, not a validation message: 160 is the width of
          // `Tienda.motivoDespublicacion` and of `unpublishReason`.
          slotProps={{
            htmlInput: { maxLength: QAB_UNPUBLISH_REASON_MAX_LENGTH },
          }}
        />

        <Typography
          variant="caption"
          sx={{
            alignSelf: "flex-end",
            color: warn
              ? "semantic.hue.caution.main"
              : "semantic.text.secondary",
          }}
        >
          {`${reason.length}/${QAB_UNPUBLISH_REASON_MAX_LENGTH}`}
        </Typography>

        {reason.trim().length === 0 && (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            Sin motivo, tu tienda va a mostrar el aviso de cerrada sin
            explicación.
          </Typography>
        )}

        <Box
          sx={{
            p: 1.5,
            borderRadius: `${shape.radius.md}px`,
            bgcolor: "semantic.hue.info.surface",
            color: "semantic.hue.info.main",
          }}
        >
          <Typography variant="body2">
            Este motivo es el que envía Cuadre de Caja. Si el equipo de la tienda
            online cierra tu local desde su panel, ese cierre lleva su propio
            mensaje: aquí no se ve y no se puede cambiar.
          </Typography>
        </Box>
      </Stack>
    </AppDialog>
  );
}

export default UnpublishDialog;
