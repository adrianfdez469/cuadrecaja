"use client";

import { useEffect, useState } from "react";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { useMessageContext } from "@/context/MessageContext";
import { updateCierreEtiqueta } from "@/services/cierrePeriodService";
import {
  buildCierreDateRangeLabel,
  normalizeCierreEtiqueta,
} from "@/utils/cierreLabel";
import { CIERRE_ETIQUETA_MAX_LENGTH } from "@/constants/cierre";

export interface EtiquetaTarget {
  cierreId: string;
  etiqueta: string | null;
  fechaInicio: Date | string;
  fechaFin?: Date | string | null;
}

interface Props {
  tiendaId: string;
  /** The period being renamed. `null` keeps the dialog closed. */
  target: EtiquetaTarget | null;
  onClose: () => void;
  /** Called with the stored label once the rename succeeded. */
  onSaved: (cierreId: string, etiqueta: string | null) => void;
}

/**
 * Renames a closing period.
 *
 * The field opens pre-filled with what the row already reads — its date range —
 * so naming a period starts from what the user was looking at instead of an
 * empty box. Clearing it is a first-class action, not an accident: it is how a
 * period goes back to being shown by its dates.
 */
export default function EditarEtiquetaCierreDialog({
  tiendaId,
  target,
  onClose,
  onSaved,
}: Readonly<Props>) {
  const { showMessage } = useMessageContext();
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const rango = target
    ? buildCierreDateRangeLabel(target.fechaInicio, target.fechaFin)
    : "";

  // Re-seeded every time a different period is opened, so the text of the
  // previous row can never be saved onto this one.
  useEffect(() => {
    if (!target) return;
    setValor(target.etiqueta?.trim() || rango);
  }, [target, rango]);

  // Leaving the field exactly as the date range means the same as leaving it
  // empty: the period stays unnamed and keeps being shown by its dates.
  const normalizado = normalizeCierreEtiqueta(valor);
  const aGuardar = normalizado === rango ? null : normalizado;
  const quedaSinNombre = aGuardar === null;
  const sinCambios = (aGuardar ?? "") === (target?.etiqueta?.trim() ?? "");

  const handleGuardar = async () => {
    if (!target) return;
    setGuardando(true);
    try {
      const guardada = await updateCierreEtiqueta(
        tiendaId,
        target.cierreId,
        aGuardar,
      );
      onSaved(target.cierreId, guardada);
      showMessage("Identificación guardada", "success");
      onClose();
    } catch (_error: unknown) {
      showMessage("No se pudo guardar la identificación", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={target !== null}
      onClose={onClose}
      title="Identificación del cierre"
      subtitle="Solo cambia cómo se llama este cierre en las listas. Las fechas y las cifras no se tocan."
      busy={guardando}
      maxWidth="xs"
      confirm={{
        label: "Guardar",
        onClick: handleGuardar,
        loading: guardando,
        disabled: guardando || sinCambios,
      }}
      footerStart={
        <Button
          size="small"
          color="inherit"
          disabled={guardando || quedaSinNombre}
          onClick={() => setValor("")}
        >
          Usar las fechas
        </Button>
      }
    >
      <Stack spacing={1.5}>
        <TextField
          label="Identificación"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          fullWidth
          autoFocus
          disabled={guardando}
          placeholder={rango}
          inputProps={{ maxLength: CIERRE_ETIQUETA_MAX_LENGTH }}
          helperText={`${valor.length}/${CIERRE_ETIQUETA_MAX_LENGTH}`}
        />
        <Typography variant="body2" color="text.secondary">
          {quedaSinNombre
            ? `Sin identificación, el cierre se sigue mostrando como «${rango}».`
            : `Registrado el ${rango}.`}
        </Typography>
      </Stack>
    </AppDialog>
  );
}
