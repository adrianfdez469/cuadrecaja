"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { ICierreData } from "@/schemas/cierre";
import { fetchMonedaBreakdown } from "@/services/cierrePeriodService";
import { previewGastosCierre } from "@/services/gastoService";
import type { IGastoPreview } from "@/schemas/gastos";
import { formatCurrency } from "@/utils/formatters";

interface Props {
  open: boolean;
  tiendaId: string;
  cierreId: string;
  cierreData: ICierreData;
  onClose: () => void;
  onConfirm: (gastosRecurrentesSeleccionados: IGastoPreview[]) => Promise<void>;
}

const gastoKey = (g: IGastoPreview, idx: number) =>
  g.gastoTiendaId ?? `idx-${idx}`;

// "Cercano a 0": el efectivo remanente en esa moneda es menor al 5% del
// efectivo bruto que pasó por caja en el período (mínimo 1 unidad de la
// moneda, para no disparar el aviso con montos triviales cuando el bruto
// también es chico). Umbral relativo porque el mismo número absoluto no
// significa lo mismo en monedas de escalas muy distintas (CUP vs USD).
const UMBRAL_EFECTIVO_BAJO_PORCENTAJE = 0.05;

interface IWarning {
  severity: "error" | "warning" | "info";
  text: string;
}

export default function CerrarCajaConfirmDialog({
  open,
  tiendaId,
  cierreId,
  cierreData,
  onClose,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<IWarning[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [gastosRecurrentes, setGastosRecurrentes] = useState<IGastoPreview[]>(
    [],
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setGastosRecurrentes([]);
    setSelectedKeys(new Set());

    (async () => {
      const nextWarnings: IWarning[] = [];

      if (
        typeof cierreData.totalGananciaFinal === "number" &&
        cierreData.totalGananciaFinal < 0
      ) {
        nextWarnings.push({
          severity: "error",
          text: `La ganancia final es negativa: ${formatCurrency(cierreData.totalGananciaFinal)}`,
        });
      }

      // Efectivo remanente en caja negativo o muy bajo, por moneda
      for (const rm of cierreData.resumenMonedas ?? []) {
        if (rm.totalEfectivo < 0) {
          nextWarnings.push({
            severity: "error",
            text: `La caja en ${rm.monedaCode} quedaría en negativo: ${formatCurrency(rm.totalEfectivo)} ${rm.monedaCode}`,
          });
        } else {
          const bruto = rm.totalEfectivoBruto ?? rm.totalEfectivo;
          const umbral = Math.max(1, bruto * UMBRAL_EFECTIVO_BAJO_PORCENTAJE);
          if (bruto > 0 && rm.totalEfectivo < umbral) {
            nextWarnings.push({
              severity: "warning",
              text: `El efectivo remanente en caja en ${rm.monedaCode} es muy bajo: ${formatCurrency(rm.totalEfectivo)} ${rm.monedaCode}`,
            });
          }
        }
      }

      // Descuadre (o falta de conteo) de efectivo por moneda
      for (const rm of cierreData.resumenMonedas ?? []) {
        try {
          const saved = await fetchMonedaBreakdown(
            tiendaId,
            cierreId,
            rm.monedaCode,
          );
          if (!saved || !saved.items?.length) {
            if (Math.abs(rm.totalEfectivo) > 0.01) {
              nextWarnings.push({
                severity: "warning",
                text: `No contaste el efectivo en ${rm.monedaCode} todavía`,
              });
            }
            continue;
          }
          const diff = saved.total - rm.totalEfectivo;
          if (Math.abs(diff) > 0.01) {
            nextWarnings.push({
              severity: "warning",
              text:
                diff > 0
                  ? `Sobran ${formatCurrency(diff)} ${rm.monedaCode} en el conteo físico`
                  : `Faltan ${formatCurrency(Math.abs(diff))} ${rm.monedaCode} en el conteo físico`,
            });
          }
        } catch {
          // Si falla la consulta de un desglose, no bloquea el resto de las validaciones
        }
      }

      // Gastos recurrentes que se van a aplicar al cerrar — el usuario puede
      // desmarcar los que no correspondan antes de confirmar
      try {
        const preview = await previewGastosCierre(cierreId);
        if (!cancelled && preview.gastosRecurrentes.length > 0) {
          setGastosRecurrentes(preview.gastosRecurrentes);
          setSelectedKeys(new Set(preview.gastosRecurrentes.map(gastoKey)));
          const total = preview.gastosRecurrentes.reduce(
            (s, g) => s + g.montoCalculado,
            0,
          );
          nextWarnings.push({
            severity: "info",
            text: `Se van a aplicar ${preview.gastosRecurrentes.length} gasto(s) recurrente(s) por ${formatCurrency(total)}. Puedes desmarcar los que no correspondan.`,
          });
        }
      } catch {
        // No bloquea el cierre si falla el preview
      }

      if (!cancelled) {
        setWarnings(nextWarnings);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tiendaId, cierreId, cierreData]);

  const toggleGasto = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const seleccionados = gastosRecurrentes.filter((g, idx) =>
        selectedKeys.has(gastoKey(g, idx)),
      );
      await onConfirm(seleccionados);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={confirming ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "warning.main",
        }}
      >
        <WarningAmberIcon color="warning" />
        Cerrar caja
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          ¿Estás seguro de que quieres cerrar la caja? Revisa que toda la
          información esté correcta — esta acción es irreversible.
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : warnings.length > 0 ? (
          <Stack spacing={1}>
            {warnings.map((w, i) => (
              <Alert key={i} severity={w.severity} sx={{ py: 0.5 }}>
                {w.text}
              </Alert>
            ))}
          </Stack>
        ) : (
          <Alert severity="success" sx={{ py: 0.5 }}>
            No se detectaron problemas.
          </Alert>
        )}

        {!loading && gastosRecurrentes.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Gastos recurrentes a aplicar
            </Typography>
            <FormGroup>
              {gastosRecurrentes.map((g, idx) => {
                const key = gastoKey(g, idx);
                return (
                  <FormControlLabel
                    key={key}
                    sx={{ ml: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedKeys.has(key)}
                        onChange={(e) => toggleGasto(key, e.target.checked)}
                      />
                    }
                    label={`${g.nombre} — ${formatCurrency(g.montoCalculado)}`}
                  />
                );
              })}
            </FormGroup>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={confirming}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleConfirm}
          disabled={confirming || loading}
        >
          {confirming ? "Cerrando..." : "Sí, cerrar caja"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
