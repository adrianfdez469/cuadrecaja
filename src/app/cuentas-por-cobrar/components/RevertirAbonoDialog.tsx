"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { useAppContext } from "@/context/AppContext";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import { generateUUID } from "@/utils/uuid";
import { stripControlCharacters } from "@/utils/printableText";
import { revertirAbono } from "@/services/cuentasPorCobrarService";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
  CUENTAS_POR_COBRAR_MOTIVO_MAX,
} from "@/constants/cuentasPorCobrar";
import type { IMovimientoRow } from "@/lib/cuentasPorCobrar/panel";
import type { IMovimientoAplicadoResponse } from "@/schemas/cuentasPorCobrarPanel";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

interface RevertirAbonoDialogProps {
  open: boolean;
  movimiento: IMovimientoRow | null;
  onClose: () => void;
  onRevertido: (respuesta: IMovimientoAplicadoResponse) => void;
  /** Called on a 409: the entry was already reversed, so what is behind is out of date. */
  onYaRevertido: () => void;
}

/**
 * A CORRECTION, not a destruction: the money goes back to the balance and the ledger keeps both
 * rows. Nothing to type, because the reversal is total — the server takes the amount from the
 * ABONO it undoes — so the confirming button is enabled from the first render.
 */
export function RevertirAbonoDialog({
  open,
  movimiento,
  onClose,
  onRevertido,
  onYaRevertido,
}: Readonly<RevertirAbonoDialogProps>) {
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
    if (!open || !movimiento) {
      sesionRef.current = null;
      return;
    }
    if (sesionRef.current === movimiento.id) return;
    sesionRef.current = movimiento.id;
    idempotencyKeyRef.current = generateUUID();
    setMotivo("");
    setLimpiado(false);
    setError(null);
    setGuardando(false);
  }, [open, movimiento]);

  const escribirMotivo = (valor: string) => {
    const limpio = stripControlCharacters(valor);
    setLimpiado(limpio !== valor);
    setMotivo(limpio);
  };

  const confirmar = async () => {
    if (!movimiento) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await revertirAbono(
        movimiento.cuentaId,
        {
          movimientoId: movimiento.id,
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
        idempotencyKeyRef.current,
      );
      idempotencyKeyRef.current = generateUUID();
      onRevertido(respuesta);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError(COPY.revertirYaHecho);
        onYaRevertido();
      } else if (status === 404) {
        setError(COPY.errorCuentaAusente);
      } else if (status === 403) {
        setError(COPY.errorSinPermiso);
      } else {
        setError(COPY.errorGenerico);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={COPY.revertirTitulo}
      subtitle={
        movimiento
          ? `${COPY.cuentaAbonoDel} ${formatDate(new Date(movimiento.fecha))}`
          : undefined
      }
      maxWidth="xs"
      cancelLabel="Cancelar"
      busy={guardando}
      confirm={{
        label: COPY.revertirConfirmar,
        onClick: confirmar,
        disabled: guardando,
        loading: guardando,
        tone: "danger",
      }}
    >
      <Box className={DOM.dialogoReversion}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="h6">
            {`${COPY.revertirAviso} ${formatMontoEnMoneda(movimiento?.monto ?? 0, monedaBase)} ${COPY.revertirAvisoCola}`}
          </Typography>

          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {COPY.revertirNota}
          </Typography>

          <TextField
            label={COPY.revertirMotivo}
            value={motivo}
            onChange={(e) => escribirMotivo(e.target.value)}
            inputProps={{ maxLength: CUENTAS_POR_COBRAR_MOTIVO_MAX }}
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
