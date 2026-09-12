"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageContainer } from "@/components/PageContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import VentaDetailDialog from "@/app/ventas/components/VentaDetailDialog";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import { getDeudorDetalle } from "@/services/cuentasPorCobrarService";
import { fetchTransferDestinations } from "@/services/transferDestinationsService";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
  CUENTAS_POR_COBRAR_PERMISO_COBRAR,
  CUENTAS_POR_COBRAR_PERMISO_PERDONAR,
  CUENTAS_POR_COBRAR_PERMISO_REVERTIR,
} from "@/constants/cuentasPorCobrar";
import {
  buildMovimientoRows,
  formatAntiguedadDias,
} from "@/lib/cuentasPorCobrar/panel";
import { MIN_OPEN_BALANCE_BASE } from "@/lib/cuentasPorCobrar/aging";
import type {
  IDeudorDetalleClient,
  IMovimientoAplicadoResponse,
} from "@/schemas/cuentasPorCobrarPanel";
import type { IVenta } from "@/schemas/venta";
import { CuentaCard } from "../components/CuentaCard";
import { MovimientosLibro } from "../components/MovimientosLibro";
import { AbonoDialog } from "../components/AbonoDialog";
import { PerdonarDeudaDialog } from "../components/PerdonarDeudaDialog";
import { RevertirAbonoDialog } from "../components/RevertirAbonoDialog";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

type ITransferDestination = { id: string; nombre: string; default: boolean };

/**
 * `/cuentas-por-cobrar/[clienteId]` — what was lent, what was paid, and the collection of today.
 *
 * ONE call brings everything: accounts, ledger and the already-mapped sale. The only auxiliary
 * request is the transfer destinations of the stores with live accounts, which the collection
 * dialog needs; if it fails, the dialog still opens and the transfer line simply carries no
 * destination — a destination that could not be read must not block a cash collection.
 */
export default function DeudorDetallePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isWide = useMediaQuery(theme.breakpoints.up("md"));
  const params = useParams<{ clienteId: string }>();
  const clienteId = params?.clienteId;

  const { monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();

  const puedeCobrar = verificarPermiso(CUENTAS_POR_COBRAR_PERMISO_COBRAR);
  const puedePerdonar = verificarPermiso(CUENTAS_POR_COBRAR_PERMISO_PERDONAR);
  const puedeRevertir = verificarPermiso(CUENTAS_POR_COBRAR_PERMISO_REVERTIR);

  const [detalle, setDetalle] = useState<IDeudorDetalleClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"error" | "offline" | null>(null);
  const [destinos, setDestinos] = useState<
    Record<string, ITransferDestination[]>
  >({});
  /**
   * Whether there is already data on screen, readable from inside `cargar` without making
   * `detalle` a dependency of it — which would rebuild the callback on every reload and
   * re-fire the effect that calls it.
   */
  const detalleRef = useRef<IDeudorDetalleClient | null>(null);
  /**
   * `showMessage` is rebuilt on every render of its provider, so listing it as a dependency of
   * `cargar` would rebuild `cargar` too and re-fire the effect that calls it — a reload loop. A
   * ref is exempt from the dependency array precisely because its identity never changes.
   */
  const showMessageRef = useRef(showMessage);
  showMessageRef.current = showMessage;

  /**
   * The three dialogs are addressed BY ID, never by a snapshot of the row.
   *
   * A snapshot freezes `saldoPendiente` at the instant the dialog opened, so after a lost race
   * the screen would keep offering the old figure while the server has already moved on. Holding
   * the id and deriving the row from `detalle` means one `cargar()` refreshes what the dialog is
   * looking at, with no second copy of the balance to keep in step.
   */
  const [cuentaACobrarId, setCuentaACobrarId] = useState<string | null>(null);
  const [cuentaAPerdonarId, setCuentaAPerdonarId] = useState<string | null>(
    null,
  );
  const [movimientoARevertirId, setMovimientoARevertirId] = useState<
    string | null
  >(null);
  const [ventaAbierta, setVentaAbierta] = useState<IVenta | null>(null);

  const cargar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const respuesta = await getDeudorDetalle(clienteId);
      detalleRef.current = respuesta;
      setDetalle(respuesta);

      // One request per DISTINCT store among the live accounts, normally one.
      const tiendas = [
        ...new Set(
          respuesta.cuentas
            .filter((cuenta) => cuenta.settledAt === null)
            .map((cuenta) => cuenta.tiendaId),
        ),
      ];
      const resultados = await Promise.all(
        tiendas.map(async (tiendaId) => {
          try {
            const lista = await fetchTransferDestinations(tiendaId);
            return [tiendaId, (lista ?? []) as ITransferDestination[]] as const;
          } catch {
            return [tiendaId, [] as ITransferDestination[]] as const;
          }
        }),
      );
      setDestinos(Object.fromEntries(resultados));
    } catch (e) {
      // What is already on screen is NOT thrown away: a refresh that fails while the cashier has
      // a dialog open must not replace the page with an error state and destroy what they typed.
      // The full-page error is for the first load, which is the case where there is nothing to
      // keep (see the `!detalle` guards below).
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "offline"
          : "error",
      );
      console.error("[/cuentas-por-cobrar/[clienteId]]", e);
      if (detalleRef.current) showMessageRef.current(COPY.errorTitulo, "error");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const movimientos = useMemo(
    () => buildMovimientoRows(detalle?.cuentas ?? []),
    [detalle],
  );

  // Derived, never stored: after a `cargar()` these point at the FRESH row, with the balance the
  // server actually has.
  const cuentaACobrar =
    detalle?.cuentas.find((cuenta) => cuenta.id === cuentaACobrarId) ?? null;
  const cuentaAPerdonar =
    detalle?.cuentas.find((cuenta) => cuenta.id === cuentaAPerdonarId) ?? null;
  const movimientoARevertir =
    movimientos.find((fila) => fila.id === movimientoARevertirId) ?? null;

  const resumen = useMemo(() => {
    const cuentas = detalle?.cuentas ?? [];
    const vivas = cuentas.filter(
      (cuenta) => cuenta.saldoPendiente > MIN_OPEN_BALANCE_BASE,
    );
    let antiguedad: number | null = null;
    for (const cuenta of vivas) {
      if (antiguedad === null || cuenta.dias > antiguedad) {
        antiguedad = cuenta.dias;
      }
    }
    let ultimoAbono: Date | null = null;
    for (const movimiento of movimientos) {
      if (movimiento.tipo !== "ABONO") continue;
      const fecha = new Date(movimiento.fecha);
      if (!ultimoAbono || fecha > ultimoAbono) ultimoAbono = fecha;
    }
    return {
      cuentasAbiertas: vivas.length,
      antiguedad,
      ultimoAbono,
      conDeuda: vivas.length > 0,
    };
  }, [detalle, movimientos]);

  const cerrarYRecargar = (mensaje: string) => {
    setCuentaACobrarId(null);
    setCuentaAPerdonarId(null);
    setMovimientoARevertirId(null);
    showMessage(mensaje, "success");
    cargar();
  };

  const alRegistrarAbono = (
    respuesta: IMovimientoAplicadoResponse,
    duplicado: boolean,
  ) => {
    // Registering twice must never look like it worked twice.
    if (duplicado) {
      cerrarYRecargar(COPY.abonoDuplicado);
      return;
    }
    cerrarYRecargar(
      respuesta.settledAt
        ? COPY.abonoOkSalda
        : `${COPY.abonoOk} ${formatMontoEnMoneda(respuesta.saldoPendiente, monedaBase)}`,
    );
  };

  const breadcrumbs = [
    { label: COPY.breadcrumbInicio, href: "/home" },
    { label: COPY.pageTitle, href: "/cuentas-por-cobrar" },
    { label: detalle?.cliente.nombre ?? "" },
  ];

  const headerActions = (
    <Tooltip title={COPY.recargar}>
      <span>
        <IconButton
          aria-label={COPY.recargar}
          onClick={cargar}
          disabled={loading}
        >
          <RefreshIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  /**
   * THE SKELETON IS FOR THE FIRST LOAD ONLY, and the `!detalle` is the whole point.
   *
   * An early return here removes the entire subtree below it — the three dialogs included — so
   * React UNMOUNTS them and every `useState` and `useRef` they hold is destroyed. With a bare
   * `if (loading)`, any refresh while a dialog was open wiped the error it had just been told to
   * show, re-enabled its confirm button, regenerated its idempotency key, and re-ran its preload
   * effect on remount. That is what made a rejected collection look like nothing had happened:
   * the cashier saw the dialog ready again, with the original amount, and walked away believing
   * the money was in.
   *
   * With data already on screen a reload happens IN PLACE. Nothing is torn down.
   */
  if (loading && !detalle) {
    return (
      <PageContainer title={COPY.pageTitle} breadcrumbs={breadcrumbs}>
        <LoadingState variant="cards" count={3} />
      </PageContainer>
    );
  }

  // Same rule: the full-page error only replaces the screen when there is nothing on it.
  if (!detalle) {
    return (
      <PageContainer title={COPY.pageTitle} breadcrumbs={breadcrumbs}>
        <ErrorState
          kind={error ?? "error"}
          title={error === "offline" ? COPY.offlineTitulo : COPY.errorTitulo}
          description={
            error === "offline"
              ? COPY.offlineDescripcion
              : COPY.errorDescripcion
          }
          onRetry={cargar}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={detalle.cliente.nombre}
      subtitle={detalle.cliente.telefono ?? COPY.sinContacto}
      breadcrumbs={breadcrumbs}
      titleAdornment={
        <StatusPill
          label={resumen.conDeuda ? COPY.estadoConDeuda : COPY.estadoSaldada}
          hue={resumen.conDeuda ? "caution" : "positive"}
        />
      }
      headerActions={headerActions}
      maxWidth="xl"
    >
      {isMobile ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {`${COPY.resumenSaldo} ${formatMontoEnMoneda(detalle.saldo, monedaBase)} · ${resumen.cuentasAbiertas} ${COPY.etiquetaCuentas.toLowerCase()} · ${
            resumen.antiguedad === null
              ? COPY.sinDato
              : formatAntiguedadDias(resumen.antiguedad)
          }`}
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }}>
          <StatStrip
            variant="card"
            stats={[
              {
                label: COPY.resumenSaldo,
                value: formatMontoEnMoneda(detalle.saldo, monedaBase),
              },
              { label: COPY.etiquetaCuentas, value: resumen.cuentasAbiertas },
              {
                label: COPY.etiquetaAntiguedad,
                value:
                  resumen.antiguedad === null
                    ? COPY.sinDato
                    : formatAntiguedadDias(resumen.antiguedad),
              },
              {
                label: COPY.etiquetaUltimoAbono,
                value: resumen.ultimoAbono
                  ? formatDate(resumen.ultimoAbono)
                  : COPY.sinDato,
              },
            ]}
          />
        </Box>
      )}

      <Box
        component="section"
        className={DOM.detalle}
        aria-label="Cuentas del deudor"
      >
        <SectionLabel>{COPY.detalleVentas}</SectionLabel>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            mb: 4,
          }}
        >
          {detalle.cuentas.map((cuenta) => (
            <CuentaCard
              key={cuenta.id}
              cuenta={cuenta}
              monedaBase={monedaBase}
              isMobile={isMobile}
              puedeCobrar={puedeCobrar}
              puedePerdonar={puedePerdonar}
              onCobrar={(elegida) => setCuentaACobrarId(elegida.id)}
              onPerdonar={(elegida) => setCuentaAPerdonarId(elegida.id)}
              onVerVenta={(elegida) => setVentaAbierta(elegida.venta)}
            />
          ))}
        </Box>

        <SectionLabel>{COPY.detalleLibro}</SectionLabel>
        <MovimientosLibro
          movimientos={movimientos}
          monedaBase={monedaBase}
          isMobile={isMobile}
          isWide={isWide}
          puedeRevertir={puedeRevertir}
          onRevertir={(fila) => setMovimientoARevertirId(fila.id)}
        />
      </Box>

      <AbonoDialog
        open={cuentaACobrar !== null}
        cuenta={cuentaACobrar}
        transferDestinations={
          cuentaACobrar ? (destinos[cuentaACobrar.tiendaId] ?? []) : []
        }
        onClose={() => setCuentaACobrarId(null)}
        onRegistrado={alRegistrarAbono}
        onSaldoDesactualizado={cargar}
      />

      <PerdonarDeudaDialog
        open={cuentaAPerdonar !== null}
        cuenta={cuentaAPerdonar}
        onClose={() => setCuentaAPerdonarId(null)}
        onPerdonado={() => cerrarYRecargar(COPY.perdonarOk)}
      />

      <RevertirAbonoDialog
        open={movimientoARevertir !== null}
        movimiento={movimientoARevertir}
        onClose={() => setMovimientoARevertirId(null)}
        onRevertido={(respuesta) =>
          cerrarYRecargar(
            `${COPY.revertirOk} ${formatMontoEnMoneda(respuesta.saldoPendiente, monedaBase)}`,
          )
        }
        onYaRevertido={cargar}
      />

      {/*
        `VentaDetailDialog` is used EXACTLY as it stands and its file is not touched (criterion 3).
        It gets three props and no more: `onDeleteProduct` / `onDeleteSale` belong to F-037, and
        offering a button this feature does not implement would be offering an action that fails.
        The reprint button appears on its own — the dialog calls `usePrinter` internally.
      */}
      <VentaDetailDialog
        open={ventaAbierta !== null}
        onClose={() => setVentaAbierta(null)}
        venta={ventaAbierta}
      />
    </PageContainer>
  );
}
