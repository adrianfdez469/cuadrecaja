"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { useAppContext } from "@/context/AppContext";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import { generateUUID } from "@/utils/uuid";
import { stripControlCharacters } from "@/utils/printableText";
import { perdonarDeuda } from "@/services/cuentasPorCobrarService";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
  CUENTAS_POR_COBRAR_MOTIVO_MAX,
} from "@/constants/cuentasPorCobrar";
import type { IMovimientoAplicadoResponse } from "@/schemas/cuentasPorCobrarPanel";
import type { ICuentaDetalle } from "./CuentaCard";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

interface PerdonarDeudaDialogProps {
  open: boolean;
  cuenta: ICuentaDetalle | null;
  onClose: () => void;
  onPerdonado: (respuesta: IMovimientoAplicadoResponse) => void;
}

/**
 * The gravest of the three actions: it destroys value with nothing coming back into the till, and
 * it cannot be undone from this screen — the ledger is append-only and F-035 offers no undo for a
 * CONDONACION.
 *
 * The friction is the reason, and only the reason: writing one is a deliberate act, and it leaves
 * a trace in a row that is permanent. A tick box would produce nothing, and two frictions on the
 * same action train people to skip both.
 *
 * The AMOUNT is not asked for. The server puts it: the balance read under the lock. There is no
 * partial forgiveness and the screen does not hint that there is.
 */
export function PerdonarDeudaDialog({
  open,
  cuenta,
  onClose,
  onPerdonado,
}: Readonly<PerdonarDeudaDialogProps>) {
  const { monedaBase } = useAppContext();

  const [motivo, setMotivo] = useState("");
  const [limpiado, setLimpiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(generateUUID());

  /**
   * WHICH dialog session has already been initialised, by the id of what it acts on.
   *
   * The reset below must run ONCE per opening, and never again while the same dialog stays open.
   * `cuenta` is derived from the freshly loaded detail, so a `cargar()` hands down a NEW object
   * for the SAME account — and without this guard that identity change would re-run the reset:
   * it would clear the error the server just produced, wipe the amount the cashier typed,
   * re-enable the confirm button and mint a NEW idempotency key, which turns their retry into a
   * genuinely second charge instead of the replay `src/lib/idempotency.ts` is built for.
   */
  const sesionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !cuenta) {
      sesionRef.current = null;
      return;
    }
    if (sesionRef.current === cuenta.id) return;
    sesionRef.current = cuenta.id;
    idempotencyKeyRef.current = generateUUID();
    setMotivo("");
    setLimpiado(false);
    setError(null);
    setGuardando(false);
  }, [open, cuenta]);

  // The field is SINGLE LINE because the line feed is inside the control-character range the
  // server refuses; the strip covers the real vector, which is PASTING text out of a PDF or a
  // chat, not typing an ESC by hand.
  const escribirMotivo = (valor: string) => {
    const limpio = stripControlCharacters(valor);
    setLimpiado(limpio !== valor);
    setMotivo(limpio);
  };

  const confirmar = async () => {
    if (!cuenta) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await perdonarDeuda(
        cuenta.id,
        { motivo: motivo.trim() },
        idempotencyKeyRef.current,
      );
      idempotencyKeyRef.current = generateUUID();
      onPerdonado(respuesta);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // The two refusals of a settled account — `nadaQuePerdonar` from the route and
      // MONTO_NO_POSITIVO from the race — are both 400 and mean the same thing to whoever is
      // looking at the screen, so the dialog does not depend on which one arrives.
      if (status === 400) setError(COPY.perdonarYaSaldada);
      else if (status === 404) setError(COPY.errorCuentaAusente);
      else if (status === 403) setError(COPY.errorSinPermiso);
      else setError(COPY.errorGenerico);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={COPY.perdonarTitulo}
      subtitle={
        cuenta
          ? `${COPY.cuentaVentaDel} ${formatDate(new Date(cuenta.fechaVenta))} · ${cuenta.tiendaNombre}`
          : undefined
      }
      maxWidth="xs"
      cancelLabel="Cancelar"
      busy={guardando}
      confirm={{
        label: COPY.perdonarConfirmar,
        onClick: confirmar,
        disabled: guardando || motivo.trim() === "",
        loading: guardando,
        tone: "danger",
      }}
    >
      <Box className={DOM.dialogoPerdon}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="h6" sx={{ color: "semantic.hue.negative.main" }}>
            {`${COPY.perdonarAviso} ${formatMontoEnMoneda(cuenta?.saldoPendiente ?? 0, monedaBase)} ${COPY.perdonarAvisoCola}`}
          </Typography>

          <Typography
            variant="body2"
            sx={{ color: "semantic.text.secondary" }}
          >
            {COPY.perdonarNota}
          </Typography>

          <TextField
            label={COPY.perdonarMotivo}
            value={motivo}
            onChange={(e) => escribirMotivo(e.target.value)}
            inputProps={{ maxLength: CUENTAS_POR_COBRAR_MOTIVO_MAX }}
            helperText={COPY.perdonarMotivoAyuda}
            fullWidth
          />

          {limpiado && (
            <Typography
              variant="caption"
              sx={{ color: "semantic.hue.caution.main" }}
            >
              {COPY.motivoLimpiado}
            </Typography>
          )}
        </Stack>
      </Box>
    </AppDialog>
  );
}
