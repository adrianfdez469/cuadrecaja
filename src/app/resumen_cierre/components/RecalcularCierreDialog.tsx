"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { recalculateCierre } from "@/services/cierrePeriodService";
import { useMessageContext } from "@/context/MessageContext";
import { formatCurrency } from "@/utils/formatters";
import type {
  ICierreStoredTotals,
  IRecalculateCierreResult,
} from "@/schemas/cierre";

interface Props {
  open: boolean;
  tiendaId: string;
  cierreId: string | null;
  onClose: () => void;
  /** Called after the figures were rewritten, so the caller reloads. */
  onApplied: () => void;
}

const ROWS: { key: keyof ICierreStoredTotals; label: string }[] = [
  { key: "totalVentasBrutas", label: "Ventas (bruto)" },
  { key: "totalDescuentos", label: "Descuentos" },
  { key: "totalVentas", label: "Ventas (neto)" },
  { key: "totalInversion", label: "Inversión" },
  { key: "totalGanancia", label: "Ganancia" },
  { key: "totalGastos", label: "Gastos" },
  { key: "totalGananciaFinal", label: "Ganancia final" },
  { key: "totalTransferencia", label: "Transferencias" },
  { key: "totalTips", label: "Propinas" },
];

/** Half a cent: below it two amounts are the same figure. */
const EPSILON = 0.005;

type FailureKind = "error" | "offline";

interface ComparisonRow {
  key: keyof ICierreStoredTotals;
  label: string;
  before: number;
  after: number;
  delta: number;
  changed: boolean;
}

function buildRows(preview: IRecalculateCierreResult): ComparisonRow[] {
  return ROWS.map(({ key, label }) => {
    const before = preview.before[key];
    const after = preview.after[key];
    const delta = after - before;
    return {
      key,
      label,
      before,
      after,
      delta,
      changed: Math.abs(delta) > EPSILON,
    };
  });
}

/**
 * The per-currency summary can be stale while every headline figure matches
 * (E-017): "nothing changes" must look at it too.
 */
function resumenChanges(preview: IRecalculateCierreResult): boolean {
  const byCode = new Map(preview.resumenBefore.map((r) => [r.monedaCode, r]));
  if (byCode.size !== preview.resumenAfter.length) return true;
  return preview.resumenAfter.some((after) => {
    const before = byCode.get(after.monedaCode);
    if (!before) return true;
    return (
      Math.abs(before.totalEfectivo - after.totalEfectivo) > EPSILON ||
      Math.abs(before.totalTransfer - after.totalTransfer) > EPSILON ||
      Math.abs(before.equivalenteBase - after.equivalenteBase) > EPSILON
    );
  });
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))}`;
}

function failureKindOf(error: unknown): FailureKind {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "offline";
  }
  // An Axios error without a response never reached the server.
  const hasResponse = Boolean((error as { response?: unknown })?.response);
  return hasResponse ? "error" : "offline";
}

function ComparisonList({ rows }: Readonly<{ rows: ComparisonRow[] }>) {
  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Box key={row.key}>
          <Typography variant="caption" color="text.secondary">
            {row.label}
          </Typography>
          {row.changed ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="baseline"
              flexWrap="wrap"
            >
              <Typography
                variant="body2"
                sx={{ textDecoration: "line-through", color: "text.disabled" }}
              >
                {formatCurrency(row.before)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                →
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatCurrency(row.after)}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "semantic.hue.caution.main" }}
              >
                {formatDelta(row.delta)}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {formatCurrency(row.after)}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function ComparisonTable({ rows }: Readonly<{ rows: ComparisonRow[] }>) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Cifra</TableCell>
          <TableCell align="right">Guardado</TableCell>
          <TableCell align="right">Recalculado</TableCell>
          <TableCell align="right">Diferencia</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell
              sx={{
                fontWeight: row.changed ? 700 : 400,
                color: row.changed ? "text.primary" : "text.secondary",
              }}
            >
              {row.label}
            </TableCell>
            <TableCell
              align="right"
              sx={
                row.changed
                  ? { textDecoration: "line-through", color: "text.disabled" }
                  : { color: "text.secondary" }
              }
            >
              {formatCurrency(row.before)}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: row.changed ? 700 : 400,
                color: row.changed ? "text.primary" : "text.secondary",
              }}
            >
              {formatCurrency(row.after)}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                color: row.changed
                  ? "semantic.hue.caution.main"
                  : "text.secondary",
              }}
            >
              {row.changed ? formatDelta(row.delta) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Previews the recalculation of a closed period (dry run) and applies it on
 * confirmation. The preview is the safety net: the superadmin sees exactly
 * which stored figure changes and by how much before anything is written.
 */
export default function RecalcularCierreDialog({
  open,
  tiendaId,
  cierreId,
  onClose,
  onApplied,
}: Readonly<Props>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { showMessage } = useMessageContext();
  const [preview, setPreview] = useState<IRecalculateCierreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [applying, setApplying] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!cierreId) return;
    setLoading(true);
    setFailure(null);
    try {
      setPreview(await recalculateCierre(tiendaId, cierreId, { dryRun: true }));
    } catch (error) {
      setPreview(null);
      setFailure(failureKindOf(error));
    } finally {
      setLoading(false);
    }
  }, [tiendaId, cierreId]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFailure(null);
      return;
    }
    void loadPreview();
  }, [open, loadPreview]);

  const handleApply = async () => {
    if (!cierreId) return;
    setApplying(true);
    try {
      await recalculateCierre(tiendaId, cierreId);
      showMessage("Cierre recalculado", "success");
      onApplied();
      onClose();
    } catch {
      showMessage("No se pudo recalcular el cierre", "error");
    } finally {
      setApplying(false);
    }
  };

  const rows = preview ? buildRows(preview) : [];
  const desgloseCambia = preview ? resumenChanges(preview) : false;
  const sinCambios =
    preview !== null && rows.every((r) => !r.changed) && !desgloseCambia;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Recalcular cierre"
      subtitle="Las cifras guardadas se vuelven a derivar de las ventas, gastos y movimientos actuales del período."
      maxWidth="sm"
      busy={applying}
      confirm={{
        label: "Recalcular",
        onClick: handleApply,
        disabled: loading || failure !== null || !preview,
        loading: applying,
        tone: "primary",
      }}
      cancelLabel="Cancelar"
    >
      {loading &&
        (isMobile ? (
          <LoadingState variant="list" count={9} />
        ) : (
          <LoadingState variant="table" count={9} columns={4} />
        ))}

      {failure === "offline" && (
        <ErrorState
          kind="offline"
          title="Sin conexión"
          description="El recálculo se hace en el servidor: hay que estar conectado. Las cifras guardadas se siguen viendo."
          onRetry={loadPreview}
        />
      )}
      {failure === "error" && (
        <ErrorState
          kind="error"
          title="No se pudo previsualizar el recálculo"
          description="No se pudieron leer las ventas del período. Vuelve a intentarlo."
          onRetry={loadPreview}
        />
      )}

      {preview && !loading && (
        <Stack spacing={2}>
          {sinCambios && (
            <Alert severity="info">
              Ninguna cifra cambia. Recalcular vuelve a sellar la fecha de
              cálculo, que es lo que retira el aviso.
            </Alert>
          )}
          {isMobile ? (
            <ComparisonList rows={rows} />
          ) : (
            <ComparisonTable rows={rows} />
          )}
          {desgloseCambia && (
            <Typography
              variant="body2"
              sx={{ color: "semantic.hue.caution.main" }}
            >
              El desglose por moneda de este cierre también se vuelve a
              escribir.
            </Typography>
          )}
          {preview.liquidacionesConservadas > 0 && (
            <Alert severity="warning">
              {preview.liquidacionesConservadas} liquidación(es) a proveedores
              ya pagadas se conservan tal cual.
            </Alert>
          )}
        </Stack>
      )}
    </AppDialog>
  );
}
