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
  Divider,
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
import { formatCurrency, formatMontoEnMoneda } from "@/utils/formatters";

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

      // Efectivo remanente en caja negativo o muy bajo, por moneda
      for (const rm of cierreData.resumenMonedas ?? []) {
        if (rm.totalEfectivo < 0) {
          nextWarnings.push({
            severity: "error",
            text: `La caja en ${rm.monedaCode} quedaría en negativo: ${formatMontoEnMoneda(rm.totalEfectivo, rm.monedaCode)}`,
          });
        } else {
          const bruto = rm.totalEfectivoBruto ?? rm.totalEfectivo;
          const umbral = Math.max(1, bruto * UMBRAL_EFECTIVO_BAJO_PORCENTAJE);
          if (bruto > 0 && rm.totalEfectivo < umbral) {
            nextWarnings.push({
              severity: "warning",
              text: `El efectivo remanente en caja en ${rm.monedaCode} es muy bajo: ${formatMontoEnMoneda(rm.totalEfectivo, rm.monedaCode)}`,
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
                  ? `Sobran ${formatMontoEnMoneda(diff, rm.monedaCode)} en el conteo físico`
                  : `Faltan ${formatMontoEnMoneda(Math.abs(diff), rm.monedaCode)} en el conteo físico`,
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
          // El resumen de "se van a aplicar N gastos por $X" se muestra junto
          // a los checkboxes (ver JSX) y se recalcula en vivo con
          // selectedKeys — no se fija acá para no quedar desactualizado
          // cuando el usuario destilde alguno.
        }
        // La ganancia final "base" (cierreData.totalGananciaFinal) ya incluye
        // gastos aplicados + merma + devoluciones del período; acá solo
        // restamos los recurrentes OPERATIVO aún pendientes (todos
        // seleccionados por defecto) para el aviso inicial. Se recalcula en
        // vivo más abajo según lo que el usuario deje marcado.
        const totalOperativosIniciales = preview.gastosRecurrentes
          .filter((g) => g.naturaleza === "OPERATIVO")
          .reduce((s, g) => s + g.montoCalculado, 0);
        const gananciaFinalBase =
          typeof cierreData.totalGananciaFinal === "number"
            ? cierreData.totalGananciaFinal
            : (cierreData.totalGanancia ?? 0);
        if (!cancelled && gananciaFinalBase - totalOperativosIniciales < 0) {
          nextWarnings.unshift({
            severity: "error",
            text: `La ganancia final quedaría negativa: ${formatCurrency(gananciaFinalBase - totalOperativosIniciales)}`,
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

  // Solo los recurrentes de naturaleza OPERATIVO restan de la ganancia (los de
  // INVERSION solo restan de caja). Partimos de cierreData — la misma fuente
  // que la card "Ganancia" del resumen — y solo sumamos los recurrentes
  // pendientes que el usuario deja marcados; así el número nunca diverge del
  // que ya vio en pantalla antes de abrir este diálogo.
  let totalOperativosSeleccionados = 0;
  // Cuenta/total de recurrentes efectivamente seleccionados (cualquier
  // naturaleza) — recalculado en vivo con selectedKeys para no quedar
  // desactualizado cuando el usuario destilde checkboxes.
  let cantidadSeleccionados = 0;
  let totalSeleccionado = 0;
  gastosRecurrentes.forEach((g, idx) => {
    if (!selectedKeys.has(gastoKey(g, idx))) return;
    cantidadSeleccionados += 1;
    totalSeleccionado += g.montoCalculado;
    if (g.naturaleza === "OPERATIVO") {
      totalOperativosSeleccionados += g.montoCalculado;
    }
  });

  // Punto de partida: la "Ganancia" que YA se ve en la card del resumen
  // (totalGananciaFinal — el valor neto, no el bruto tachado). Ese número ya
  // trae restados los gastos/merma/devoluciones aplicados hasta ahora; acá
  // solo restamos, encima, los recurrentes pendientes que el usuario deja
  // marcados — así las filas del diálogo suman entre sí sin dejar nada oculto.
  const gananciaMostrada =
    typeof cierreData.totalGananciaFinal === "number"
      ? cierreData.totalGananciaFinal
      : (cierreData.totalGanancia ?? 0);
  const gananciaFinalEstimada = gananciaMostrada - totalOperativosSeleccionados;
  const esNegativa = gananciaFinalEstimada < 0;

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
            <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
              Se van a aplicar {cantidadSeleccionados} gasto(s) recurrente(s)
              por {formatCurrency(totalSeleccionado)}.
            </Alert>
          </Box>
        )}

        {!loading && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Resumen final del cierre
            </Typography>
            <Stack spacing={0.5}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Ganancia (según resumen)
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(gananciaMostrada)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="error.main">
                  Gastos recurrentes a aplicar
                </Typography>
                <Typography variant="body2" color="error.main">
                  -{formatCurrency(totalOperativosSeleccionados)}
                </Typography>
              </Box>
              <Divider />
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="subtitle2">Ganancia final</Typography>
                <Typography
                  variant="subtitle2"
                  color={esNegativa ? "error.main" : "success.main"}
                  fontWeight="bold"
                >
                  {formatCurrency(gananciaFinalEstimada)}
                </Typography>
              </Box>
            </Stack>
            {esNegativa && (
              <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                La ganancia final quedaría negativa: los gastos superan la
                ganancia del período.
              </Alert>
            )}
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
