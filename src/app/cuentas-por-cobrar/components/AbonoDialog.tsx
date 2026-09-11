"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { MultiCurrencyPayment } from "@/components/MultiCurrencyPayment/MultiCurrencyPayment";
import { useAppContext } from "@/context/AppContext";
import { missingRateCodes } from "@/lib/currency";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import { generateUUID } from "@/utils/uuid";
import { registrarAbono } from "@/services/cuentasPorCobrarService";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
  SIN_DENOMINACIONES,
} from "@/constants/cuentasPorCobrar";
import {
  describeAbono,
  sumEquivalenteBase,
} from "@/lib/cuentasPorCobrar/panel";
import type { IPagoLinea } from "@/schemas/pago";
import type { IMovimientoAplicadoResponse } from "@/schemas/cuentasPorCobrarPanel";
import type { ICuentaDetalle } from "./CuentaCard";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

interface AbonoDialogProps {
  open: boolean;
  cuenta: ICuentaDetalle | null;
  transferDestinations: { id: string; nombre: string; default: boolean }[];
  onClose: () => void;
  onRegistrado: (
    respuesta: IMovimientoAplicadoResponse,
    duplicado: boolean,
  ) => void;
  /** Called after a rejection whose body carries the real balance, to refresh what is behind. */
  onSaldoDesactualizado: () => void;
}

/**
 * The collection dialog.
 *
 * `MultiCurrencyPayment` is mounted with `allowChange={false}` and `showShortfall={false}`: a
 * debt collection hands back no change, and a partial instalment is the NORMAL case of criterion
 * 4, not a failure to be painted in error ink. With both off, the component's summary is one
 * line and the result line below is the ONLY sentence about the outcome.
 */
export function AbonoDialog({
  open,
  cuenta,
  transferDestinations,
  onClose,
  onRegistrado,
  onSaldoDesactualizado,
}: Readonly<AbonoDialogProps>) {
  const { monedaBase, monedasNegocio, tasasVigentes } = useAppContext();

  const [pagos, setPagos] = useState<IPagoLinea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<number | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // ONE key per open dialog, kept out of the render and renewed ONLY after a successful
  // collection: the axios retry and the cashier's own retry must reuse it, which is the path of
  // criterion 8.
  const idempotencyKeyRef = useRef<string>(generateUUID());

  const saldoPendiente = cuenta?.saldoPendiente ?? 0;

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
    setErrorSaldo(null);
    setErrorGeneral(null);
    setGuardando(false);
    // Collecting the whole debt is the frequent case, so it takes one tap; whoever pays part of
    // it edits the number, which is in plain sight.
    setPagos([
      {
        tipo: "cash",
        moneda: monedaBase,
        monto: cuenta.saldoPendiente,
        equivalenteBase: cuenta.saldoPendiente,
      },
    ]);
  }, [open, cuenta, monedaBase]);

  const montoBase = useMemo(() => sumEquivalenteBase(pagos), [pagos]);
  const resultado = useMemo(
    () => describeAbono(saldoPendiente, montoBase),
    [saldoPendiente, montoBase],
  );

  const codigosSinTasa = useMemo(
    () =>
      missingRateCodes(
        tasasVigentes,
        monedaBase,
        pagos.map((linea) => linea.moneda),
      ),
    [tasasVigentes, monedaBase, pagos],
  );

  const textoResultado = () => {
    if (resultado.estado === "VACIO") return COPY.abonoVacio;
    if (resultado.estado === "SALDA") return COPY.abonoSalda;
    if (resultado.estado === "EXCEDE") {
      return `${COPY.abonoExcede} ${formatMontoEnMoneda(resultado.exceso, monedaBase)}`;
    }
    return `${COPY.abonoRestante} ${formatMontoEnMoneda(resultado.restante, monedaBase)}`;
  };

  const tintaResultado = () => {
    if (resultado.estado === "SALDA") return "semantic.hue.positive.main";
    if (resultado.estado === "EXCEDE") return "semantic.hue.negative.main";
    return "semantic.text.secondary";
  };

  const registrar = async () => {
    if (!cuenta) return;
    setGuardando(true);
    setErrorSaldo(null);
    setErrorGeneral(null);
    try {
      const respuesta = await registrarAbono(
        cuenta.id,
        {
          pagos: pagos.map((linea) => ({
            tipo: linea.tipo,
            moneda: linea.moneda,
            monto: linea.monto,
            ...(linea.transferDestinationId
              ? { transferDestinationId: linea.transferDestinationId }
              : {}),
          })),
        },
        idempotencyKeyRef.current,
      );
      // Renewed ONLY after success: a new collection is a new key.
      idempotencyKeyRef.current = generateUUID();
      onRegistrado(respuesta, respuesta.duplicado === true);
    } catch (e) {
      const respuesta = (
        e as {
          response?: { status?: number; data?: { saldoPendiente?: number } };
        }
      )?.response;
      const status = respuesta?.status;
      const saldoReal = respuesta?.data?.saldoPendiente;

      if (status === 400 && typeof saldoReal === "number") {
        // The figure comes from the NUMERIC field of the body and is formatted here. The API
        // body and the screen are two different levels of the stack (E-069).
        setErrorSaldo(saldoReal);
        onSaldoDesactualizado();
      } else if (status === 409) {
        setErrorGeneral(COPY.errorSinCaja);
      } else if (status === 404) {
        setErrorGeneral(COPY.errorCuentaAusente);
      } else if (status === 403) {
        setErrorGeneral(COPY.errorSinPermiso);
      } else {
        setErrorGeneral(COPY.errorGenerico);
      }
    } finally {
      setGuardando(false);
    }
  };

  const confirmDisabled =
    guardando ||
    resultado.estado === "VACIO" ||
    resultado.estado === "EXCEDE" ||
    codigosSinTasa.length > 0;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={COPY.abonoTitulo}
      subtitle={
        cuenta
          ? `${COPY.cuentaVentaDel} ${formatDate(new Date(cuenta.fechaVenta))} · ${cuenta.tiendaNombre}`
          : undefined
      }
      maxWidth="md"
      cancelLabel="Cancelar"
      busy={guardando}
      confirm={{
        label: COPY.abonoConfirmar,
        onClick: registrar,
        disabled: confirmDisabled,
        loading: guardando,
        tone: "primary",
      }}
    >
      <Box className={DOM.dialogoAbono}>
        <Stack spacing={2}>
          {errorSaldo !== null && (
            <Alert severity="error" className={DOM.errorSaldo}>
              {`${COPY.errorSaldoReal} ${formatMontoEnMoneda(errorSaldo, monedaBase)}. ${COPY.errorSaldoRealCola}`}
            </Alert>
          )}

          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          {codigosSinTasa.length > 0 && (
            <Alert severity="warning">{COPY.sinTasa(codigosSinTasa)}</Alert>
          )}

          <MultiCurrencyPayment
            totalBase={saldoPendiente}
            monedaBase={monedaBase}
            monedaCobro={monedaBase}
            monedasDisponibles={monedasNegocio}
            tasas={tasasVigentes}
            denominaciones={SIN_DENOMINACIONES}
            pagos={pagos}
            onPagosChange={setPagos}
            transferDestinations={transferDestinations}
            allowChange={false}
            showShortfall={false}
          />

          <Typography
            className={DOM.resultado}
            variant="subtitle1"
            sx={{ fontWeight: 600, color: tintaResultado() }}
          >
            {textoResultado()}
          </Typography>
        </Stack>
      </Box>
    </AppDialog>
  );
}
