"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { ICierreData } from "@/schemas/cierre";
import { fetchMonedaBreakdown } from "@/services/cierrePeriodService";
import { previewGastosCierre } from "@/services/gastoService";
import { formatCurrency } from "@/utils/formatters";

interface Props {
  open: boolean;
  tiendaId: string;
  cierreId: string;
  cierreData: ICierreData;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

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

      // Gastos recurrentes que se van a aplicar automáticamente al cerrar
      try {
        const preview = await previewGastosCierre(cierreId);
        if (preview.gastosRecurrentes.length > 0) {
          const total = preview.gastosRecurrentes.reduce(
            (s, g) => s + g.montoCalculado,
            0,
          );
          nextWarnings.push({
            severity: "info",
            text: `Se van a aplicar ${preview.gastosRecurrentes.length} gasto(s) recurrente(s) por ${formatCurrency(total)}`,
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

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
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
