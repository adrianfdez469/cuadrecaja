"use client";

import { FC, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { Chip } from "@mui/material";
import { formatCurrency, formatMontoEnMoneda } from "@/utils/formatters";
import BillBreakdownDynamic from "@/components/BillBreakdown/BillBreakdownDynamic";
import { IBillCount } from "@/schemas/billBreakdown";
import {
  fetchMonedaBreakdown,
  saveMonedaBreakdown,
} from "@/services/cierrePeriodService";
import { IDeduccionItem } from "@/schemas/cierre";
import DeduccionesList from "./DeduccionesList";

interface Props {
  monedaCode: string;
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
  totalEfectivoBruto?: number;
  equivalenteBaseBruto?: number;
  tiendaId: string;
  cierreId: string;
  isOpen: boolean;
  denominations: number[]; // always required — caller resolves from monedasNegocio
  deducciones?: IDeduccionItem[];
  onDeleteGasto?: (id: string) => void;
  deletingGastoId?: string | null;
}

function itemsToCountMap(items: IBillCount[]): Record<number, number> {
  return items.reduce<Record<number, number>>(
    (acc, { denomination, count }) => {
      acc[denomination] = count;
      return acc;
    },
    {},
  );
}

function countMapToItems(counts: Record<number, number>): IBillCount[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([denomination, count]) => ({
      denomination: Number(denomination),
      count,
    }));
}

const MonedaBreakdownRow: FC<Props> = ({
  monedaCode,
  totalEfectivo,
  totalTransfer,
  equivalenteBase,
  totalEfectivoBruto,
  equivalenteBaseBruto,
  tiendaId,
  cierreId,
  isOpen,
  denominations,
  deducciones = [],
  onDeleteGasto,
  deletingGastoId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [detalleExpanded, setDetalleExpanded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [initialCounts, setInitialCounts] = useState<Record<number, number>>(
    {},
  );
  const [breakdownTotal, setBreakdownTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDenominations = denominations.length > 0;

  // Load status message on mount without requiring the user to expand
  useEffect(() => {
    setLoadError(false);
    fetchMonedaBreakdown(tiendaId, cierreId, monedaCode)
      .then((saved) => {
        if (saved?.items?.length) setBreakdownTotal(saved.total);
      })
      .catch((err) => {
        console.error("[MonedaBreakdown] fetch error:", err);
        // Un fallo de red aquí no debe leerse como "no se ha contado" — el
        // conteo físico puede existir y no haberse podido cargar, lo que
        // invalidaría cualquier validación de descuadre contra este total.
        setLoadError(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cierreId, monedaCode]);

  // Load full breakdown when the user expands the row
  useEffect(() => {
    if (!expanded) return;
    fetchMonedaBreakdown(tiendaId, cierreId, monedaCode)
      .then((saved) => {
        if (saved?.items?.length) {
          setInitialCounts(itemsToCountMap(saved.items));
          setBreakdownTotal(saved.total);
        } else {
          setInitialCounts({});
          setBreakdownTotal(null);
        }
        setResetKey((k) => k + 1);
      })
      .catch((err) => {
        console.error("[MonedaBreakdown] fetch error:", err);
        setResetKey((k) => k + 1);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, cierreId, monedaCode]);

  // isUserChange distinguishes user input (save) from programmatic resets (display only)
  const handleCounts = (
    counts: Record<number, number>,
    total: number,
    isUserChange = false,
  ) => {
    setBreakdownTotal(total > 0 ? total : null);
    if (!isOpen || !isUserChange) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMonedaBreakdown(
        tiendaId,
        cierreId,
        monedaCode,
        countMapToItems(counts),
        total,
      ).catch((err) => console.error("[MonedaBreakdown] save error:", err));
    }, 800);
  };

  const diff = breakdownTotal !== null ? breakdownTotal - totalEfectivo : null;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Chip
          label={monedaCode}
          size="small"
          color="primary"
          variant="outlined"
        />
        <Stack direction="row" gap={3} flexWrap="wrap" alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">
              Efectivo
            </Typography>
            <Box display="flex" gap={0.5} alignItems="baseline" flexWrap="wrap">
              {typeof totalEfectivoBruto === "number" &&
                totalEfectivoBruto !== totalEfectivo && (
                  <Typography
                    variant="body2"
                    sx={{
                      textDecoration: "line-through",
                      color: "text.disabled",
                    }}
                  >
                    {formatMontoEnMoneda(totalEfectivoBruto, monedaCode)}
                  </Typography>
                )}
              <Typography variant="body2" fontWeight="bold">
                {formatMontoEnMoneda(totalEfectivo, monedaCode)}
              </Typography>
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Transferencia
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatMontoEnMoneda(totalTransfer, monedaCode)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              ≈ Base
            </Typography>
            <Box display="flex" gap={0.5} alignItems="baseline" flexWrap="wrap">
              {typeof equivalenteBaseBruto === "number" &&
                equivalenteBaseBruto !== equivalenteBase && (
                  <Typography
                    variant="body2"
                    sx={{
                      textDecoration: "line-through",
                      color: "text.disabled",
                    }}
                  >
                    {formatCurrency(equivalenteBaseBruto)}
                  </Typography>
                )}
              <Typography
                variant="body2"
                fontWeight="bold"
                color={equivalenteBase < 0 ? "error.main" : "success.main"}
              >
                {formatCurrency(equivalenteBase)}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Stack>

      {deducciones.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            color="error"
            startIcon={<ReceiptLongIcon fontSize="small" />}
            endIcon={
              detalleExpanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )
            }
            onClick={() => setDetalleExpanded((v) => !v)}
          >
            Deducciones ({deducciones.length})
          </Button>

          <Collapse in={detalleExpanded}>
            <Box
              sx={{
                mt: 1,
                pl: 1,
                borderLeft: "3px solid",
                borderColor: "error.light",
              }}
            >
              <DeduccionesList
                items={deducciones}
                onDelete={onDeleteGasto}
                deletingId={deletingGastoId}
                monedaCode={monedaCode}
              />
              <Divider sx={{ mt: 1 }} />
              <Box display="flex" justifyContent="space-between" mt={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Total deducido de {monedaCode}:
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight="bold"
                  color="error.main"
                >
                  -
                  {formatMontoEnMoneda(
                    deducciones.reduce((s, it) => s + it.monto, 0),
                    monedaCode,
                  )}
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </Box>
      )}

      {hasDenominations && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={<PointOfSaleIcon fontSize="small" />}
            endIcon={
              expanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )
            }
            onClick={() => setExpanded((v) => !v)}
          >
            Desglose de billetes
          </Button>

          {loadError && (
            <Typography
              variant="caption"
              color="warning.main"
              display="block"
              mt={0.5}
            >
              No se pudo cargar el conteo físico guardado (error de red) — si ya
              lo habías contado, no lo des por perdido, reintenta antes de
              cerrar.
            </Typography>
          )}

          {breakdownTotal !== null && diff !== null && (
            <Typography
              variant="caption"
              color={
                diff === 0
                  ? "success.main"
                  : diff > 0
                    ? "warning.main"
                    : "error.main"
              }
              display="block"
              mt={0.5}
            >
              {diff === 0
                ? `Cuadre perfecto ✓ — ${formatMontoEnMoneda(breakdownTotal, monedaCode)}`
                : diff > 0
                  ? `Excedente: ${formatMontoEnMoneda(diff, monedaCode)} (contado: ${formatMontoEnMoneda(breakdownTotal, monedaCode)})`
                  : `Faltan: ${formatMontoEnMoneda(Math.abs(diff), monedaCode)} (contado: ${formatMontoEnMoneda(breakdownTotal, monedaCode)})`}
            </Typography>
          )}

          <Collapse in={expanded}>
            <Box
              sx={{
                mt: 1,
                pl: 1,
                borderLeft: "3px solid",
                borderColor: "primary.light",
              }}
            >
              <BillBreakdownDynamic
                denominations={denominations}
                targetAmount={totalEfectivo}
                onChange={() => {}}
                onCounts={handleCounts}
                initialCounts={initialCounts}
                resetKey={resetKey}
              />
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

export default MonedaBreakdownRow;
