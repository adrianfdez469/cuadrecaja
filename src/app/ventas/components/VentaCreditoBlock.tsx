"use client";

import React from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Link as MuiLink,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { CreditScore } from "@mui/icons-material";
import { CreditoEstadoChip } from "@/components/credito/CreditoEstadoChip";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { StatusPill } from "@/components/StatusPill";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_PERMISO,
  TIPO_MOVIMIENTO_HUE,
  TIPO_MOVIMIENTO_LABEL,
} from "@/constants/cuentasPorCobrar";
import { VENTA_CREDITO_COPY, VENTA_CREDITO_DOM } from "@/constants/ventaCredito";
import { useAppContext } from "@/context/AppContext";
import { resolveVentaCreditoEstado } from "@/lib/cuentasPorCobrar/ventaCreditoEstado";
import type { IMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";
import type {
  IVentaCreditoDetalleResponse,
  IVentaCreditoResumen,
} from "@/schemas/ventaCredito";
import { getVentaCredito } from "@/services/ventaCreditoService";
import { shape, touch } from "@/theme/tokens";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import { usePermisos } from "@/utils/permisos_front";

export interface VentaCreditoBlockProps {
  tiendaId: string;
  cierreId: string;
  ventaId: string;
  /** The sale's credit summary, already in the list's payload. Paints before the fetch lands. */
  credito: IVentaCreditoResumen;
  clienteId?: string;
  clienteNombre?: string;
}

/** Which of the two `ErrorState` kinds the failed GET turned out to be. */
type LibroError = "error" | "offline" | null;

/** The debtor's name is a tap target in its own right, link or not (design § 4.6). */
const DEUDOR_SX = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: `${touch.min}px`,
  fontWeight: 600,
} as const;

const TABULAR = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * The credit of ONE sale: who owes it, how much was lent, how much is left, and every movement
 * of its ledger with its date, amount, currency and method (criterion 3).
 *
 * It carries no logic of its own — nothing of a `.tsx` is importable from a test (E-015): the
 * state comes from `resolveVentaCreditoEstado`, the copy from `VENTA_CREDITO_COPY` and from
 * `CUENTAS_POR_COBRAR_COPY` (F-033, imported and never restated), and the classes from
 * `VENTA_CREDITO_DOM`.
 *
 * The two figures are painted from the summary that ALREADY travelled inside the sale, so the
 * block is complete from the first frame and only the ledger waits. When the GET lands, its own
 * `montoOriginal` and `saldoPendiente` — measured against `at` — take over.
 */
export const VentaCreditoBlock: React.FC<Readonly<VentaCreditoBlockProps>> = ({
  tiendaId,
  cierreId,
  ventaId,
  credito,
  clienteId,
  clienteNombre,
}) => {
  const theme = useTheme();
  // The SAME threshold the dialog already uses (`VentaDetailDialog.tsx:74`). This block
  // introduces none of its own.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { monedaBase } = useAppContext();
  const { verificarPermiso } = usePermisos();
  const puedeVerPanel = verificarPermiso(CUENTAS_POR_COBRAR_PERMISO);

  const [detalle, setDetalle] =
    React.useState<IVentaCreditoDetalleResponse | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<LibroError>(null);
  const [intento, setIntento] = React.useState(0);

  React.useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    getVentaCredito(tiendaId, cierreId, ventaId)
      .then((respuesta) => {
        if (!vigente) return;
        setDetalle(respuesta);
      })
      .catch((e) => {
        if (!vigente) return;
        setDetalle(null);
        // Classified exactly as /cuentas-por-cobrar does it, with no new hook. A 404 lands
        // here as an error and not as an empty ledger: with a non-null `credito` it means the
        // data changed under our feet.
        setError(
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "error",
        );
        console.error("[VentaCreditoBlock]", e);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [tiendaId, cierreId, ventaId, intento]);

  const cuenta = detalle?.cuenta ?? null;
  const montoOriginal = cuenta?.montoOriginal ?? credito.montoOriginal;
  const saldoPendiente = cuenta?.saldoPendiente ?? credito.saldoPendiente;
  const movimientos: IMovimientoCuentaPorCobrar[] =
    cuenta?.movimientosDetalle ?? [];

  const estado = resolveVentaCreditoEstado({
    // `CuentaPorCobrar.montoOriginal` IS `Venta.creditoBase` at the moment the account was
    // created, so it is the explicit credit field this block has at hand. The state is never
    // recomputed here: `resolveVentaCreditoEstado` is its only definition (E-014).
    creditoBase: montoOriginal,
    credito: {
      saldoPendiente,
      settledAt: cuenta?.settledAt ?? credito.settledAt ?? null,
    },
  });

  const monedaDeuda = cuenta?.monedaDeudaCode ?? null;
  const montoDeuda = cuenta?.montoDeudaMonedaOriginal ?? null;
  // `!= null` covers the null, the undefined and the absent key at once (§ 0.6 (d)).
  const muestraReferencia =
    monedaDeuda != null && monedaDeuda !== monedaBase && montoDeuda != null;

  const nombre = cuenta?.clienteNombre || clienteNombre || "";

  const deudorNodo =
    puedeVerPanel && clienteId ? (
      <MuiLink
        component={Link}
        href={`/cuentas-por-cobrar/${clienteId}`}
        className={VENTA_CREDITO_DOM.deudor}
        underline="hover"
        aria-label={VENTA_CREDITO_COPY.bloqueVerPanel}
        title={VENTA_CREDITO_COPY.bloqueVerPanel}
        sx={{ ...DEUDOR_SX, color: "semantic.hue.accent.main" }}
      >
        {nombre}
      </MuiLink>
    ) : (
      // No warning and no disabled link: the cashier has not lost any information, and the
      // permission is not something this screen can grant (design § 4.2).
      <Box
        component="span"
        className={VENTA_CREDITO_DOM.deudor}
        sx={{ ...DEUDOR_SX, color: "semantic.text.primary" }}
      >
        {nombre}
      </Box>
    );

  /** One movement's payment lines, or the single line that says there are none. */
  const lineasDePago = (movimiento: IMovimientoCuentaPorCobrar) => {
    const pagos = movimiento.pagosDetalle ?? [];
    if (pagos.length === 0) {
      return (
        <Typography variant="caption" sx={{ color: "semantic.text.disabled" }}>
          {VENTA_CREDITO_COPY.bloqueSinFormaDePago}
        </Typography>
      );
    }

    return (
      <Stack spacing={0.5}>
        {pagos.map((pago, idx) => (
          <Box
            key={idx}
            className={VENTA_CREDITO_DOM.pago}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 1,
              py: 0.5,
              px: 1,
              borderRadius: `${shape.radius.sm}px`,
              bgcolor: "semantic.surface.sunken",
              color: "semantic.text.primary",
              fontSize: "0.875rem",
            }}
          >
            {VENTA_CREDITO_COPY.bloqueFormaDePago(pago.tipo, pago.moneda)}
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="body2" sx={TABULAR}>
                {formatMontoEnMoneda(pago.monto, pago.moneda)}
              </Typography>
              {pago.moneda !== monedaBase && (
                <Typography
                  variant="caption"
                  sx={{ ...TABULAR, color: "semantic.text.secondary" }}
                  display="block"
                >
                  {VENTA_CREDITO_COPY.bloqueEquivalente(
                    pago.equivalenteBase,
                    monedaBase,
                  )}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    );
  };

  /**
   * Under 600 px there is no table: one `Box` per movement. It is not the wide table with its
   * columns hidden — they are two branches, exactly as the product list of this same dialog and
   * the ledger of the F-033 panel already do.
   */
  const libroCompacto = (
    <Stack>
      {movimientos.map((movimiento) => (
        <Box
          key={movimiento.id}
          className={VENTA_CREDITO_DOM.movimiento}
          sx={{
            py: 1.25,
            borderTop: 1,
            borderColor: "semantic.surface.border",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <StatusPill
              label={TIPO_MOVIMIENTO_LABEL[movimiento.tipo]}
              hue={TIPO_MOVIMIENTO_HUE[movimiento.tipo]}
            />
            <Typography variant="body1" fontWeight={700} sx={TABULAR}>
              {formatMontoEnMoneda(movimiento.monto, monedaBase)}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary", ...TABULAR }}
            display="block"
          >
            {formatDate(movimiento.fecha)}
          </Typography>
          <Box sx={{ mt: 0.75 }}>{lineasDePago(movimiento)}</Box>
        </Box>
      ))}
    </Stack>
  );

  const libroTabla = (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <Box component="thead">
          <Box component="tr">
            <Box
              component="th"
              sx={{ textAlign: "left", py: 1, px: 1, fontWeight: 600 }}
            >
              {CUENTAS_POR_COBRAR_COPY.columnaFecha}
            </Box>
            <Box
              component="th"
              sx={{ textAlign: "left", py: 1, px: 1, fontWeight: 600 }}
            >
              {CUENTAS_POR_COBRAR_COPY.columnaMovimiento}
            </Box>
            <Box
              component="th"
              sx={{ textAlign: "left", py: 1, px: 1, fontWeight: 600 }}
            >
              {VENTA_CREDITO_COPY.bloqueColumnaFormaDePago}
            </Box>
            <Box
              component="th"
              sx={{ textAlign: "right", py: 1, px: 1, fontWeight: 600 }}
            >
              {CUENTAS_POR_COBRAR_COPY.columnaMonto}
            </Box>
          </Box>
        </Box>
        <Box component="tbody">
          {movimientos.map((movimiento) => (
            <Box
              component="tr"
              key={movimiento.id}
              className={VENTA_CREDITO_DOM.movimiento}
              sx={{ borderTop: 1, borderColor: "semantic.surface.border" }}
            >
              <Box
                component="td"
                sx={{ py: 1.25, px: 1, verticalAlign: "top" }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "semantic.text.secondary", ...TABULAR }}
                >
                  {formatDate(movimiento.fecha)}
                </Typography>
              </Box>
              <Box
                component="td"
                sx={{ py: 1.25, px: 1, verticalAlign: "top" }}
              >
                <StatusPill
                  label={TIPO_MOVIMIENTO_LABEL[movimiento.tipo]}
                  hue={TIPO_MOVIMIENTO_HUE[movimiento.tipo]}
                />
              </Box>
              <Box
                component="td"
                sx={{ py: 1.25, px: 1, verticalAlign: "top" }}
              >
                {lineasDePago(movimiento)}
              </Box>
              <Box
                component="td"
                sx={{
                  py: 1.25,
                  px: 1,
                  verticalAlign: "top",
                  textAlign: "right",
                }}
              >
                <Typography variant="body1" fontWeight={700} sx={TABULAR}>
                  {formatMontoEnMoneda(movimiento.monto, monedaBase)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );

  /**
   * Only THIS region waits. Never `if (loading) return <LoadingState/>` at the root of the
   * block: that unmounts the subtree and everything in it (E-071).
   */
  const libro = cargando ? (
    <LoadingState variant="list" count={2} />
  ) : error === "offline" ? (
    <ErrorState
      kind="offline"
      title={VENTA_CREDITO_COPY.bloqueOfflineTitulo}
      description={VENTA_CREDITO_COPY.bloqueOfflineDescripcion}
      onRetry={() => setIntento((n) => n + 1)}
    />
  ) : error === "error" ? (
    <ErrorState
      kind="error"
      title={VENTA_CREDITO_COPY.bloqueErrorTitulo}
      description={VENTA_CREDITO_COPY.bloqueErrorDescripcion}
      onRetry={() => setIntento((n) => n + 1)}
    />
  ) : movimientos.length === 0 ? (
    <EmptyState
      variant="empty"
      title={CUENTAS_POR_COBRAR_COPY.libroVacioTitulo}
      description={CUENTAS_POR_COBRAR_COPY.libroVacioDescripcion}
    />
  ) : isMobile ? (
    // CONDITIONAL MOUNTING, never `display: none`: below 600 px the table must not be in the
    // DOM at all (design preamble g and criterion 24).
    libroCompacto
  ) : (
    libroTabla
  );

  return (
    <Card className={VENTA_CREDITO_DOM.bloque} sx={{ mb: 3 }}>
      <CardContent>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Typography
            variant="h6"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <CreditScore />
            {VENTA_CREDITO_COPY.bloqueTitulo}
          </Typography>
          {/* Without the figure: it is two lines below, and repeating it is noise. */}
          <CreditoEstadoChip estado={estado} />
        </Stack>
        <Divider sx={{ mb: 2, mt: 1 }} />

        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
            display="block"
          >
            {VENTA_CREDITO_COPY.bloqueDeudor}
          </Typography>
          {deudorNodo}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography
              variant="caption"
              sx={{ color: "semantic.text.secondary" }}
              display="block"
            >
              {CUENTAS_POR_COBRAR_COPY.cuentaMontoOriginal}
            </Typography>
            <Typography
              variant="body1"
              className={VENTA_CREDITO_DOM.montoOriginal}
              sx={{ ...TABULAR, color: "semantic.text.primary" }}
            >
              {formatMontoEnMoneda(montoOriginal, monedaBase)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography
              variant="caption"
              sx={{ color: "semantic.text.secondary" }}
              display="block"
            >
              {CUENTAS_POR_COBRAR_COPY.cuentaSaldo}
            </Typography>
            <Typography
              variant="h6"
              className={VENTA_CREDITO_DOM.saldo}
              sx={{ ...TABULAR, color: "semantic.text.primary" }}
            >
              {formatMontoEnMoneda(saldoPendiente, monedaBase)}
            </Typography>
          </Grid>
        </Grid>

        {muestraReferencia && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="caption"
              className={VENTA_CREDITO_DOM.referencia}
              sx={{ color: "semantic.money.reference.main" }}
              display="block"
            >
              {`${CUENTAS_POR_COBRAR_COPY.cuentaEquivale} ${formatMontoEnMoneda(montoDeuda, monedaDeuda)}`}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "semantic.money.reference.main" }}
              display="block"
            >
              {VENTA_CREDITO_COPY.bloqueReferencia(monedaBase)}
            </Typography>
          </Box>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2.5 }} gutterBottom>
          {CUENTAS_POR_COBRAR_COPY.detalleLibro}
        </Typography>
        <Box className={VENTA_CREDITO_DOM.libro}>{libro}</Box>
      </CardContent>
    </Card>
  );
};

export default VentaCreditoBlock;
