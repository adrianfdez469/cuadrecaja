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
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IGastoCierre } from "@/schemas/gastos";
import { IGastosPreviewResponse, previewGastosCierre, applyGastosCierre } from "@/services/gastoService";
import { TIPO_CALCULO_LABELS, RECURRENCIA_LABELS } from "@/constants/gastos";

interface Props {
  open: boolean;
  cierreId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function GastosCierreReviewDialog({ open, cierreId, onClose, onConfirm }: Props) {
  const [preview, setPreview] = useState<IGastosPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && cierreId) {
      setLoadingPreview(true);
      setError(null);
      setPreview(null);
      previewGastosCierre(cierreId)
        .then((data) => {
          setPreview(data);
          // Seleccionar todos los recurrentes por defecto
          setSelectedIds(new Set(
            data.gastosRecurrentes
              .filter((g) => g.gastoTiendaId)
              .map((g) => g.gastoTiendaId as string)
          ));
        })
        .catch(() => setError("No se pudo cargar el resumen de gastos. Intenta de nuevo."))
        .finally(() => setLoadingPreview(false));
    }
  }, [open, cierreId]);

  const toggleGasto = (gastoTiendaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gastoTiendaId)) next.delete(gastoTiendaId);
      else next.add(gastoTiendaId);
      return next;
    });
  };

  const gastosSeleccionados = preview?.gastosRecurrentes.filter(
    (g) => g.gastoTiendaId && selectedIds.has(g.gastoTiendaId)
  ) ?? [];

  const totalSeleccionado =
    gastosSeleccionados.reduce((s, g) => s + g.montoCalculado, 0) +
    (preview?.gastosAdHoc.reduce((s, g) => s + g.montoCalculado, 0) ?? 0);

  const gananciaFinalEstimada = (preview?.totalGanancia ?? 0) - totalSeleccionado;
  const esNegativa = gananciaFinalEstimada < 0;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // Aplicar los gastos seleccionados
      await applyGastosCierre(cierreId, gastosSeleccionados);
      // Luego ejecutar el cierre real (el caller se encarga de esto)
      await onConfirm();
    } catch {
      setError("Error al aplicar los gastos. Intenta de nuevo.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Revisión de gastos antes del cierre</DialogTitle>
      <DialogContent>
        {loadingPreview && (
          <Box py={4} textAlign="center">
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" mt={1}>
              Calculando gastos del período...
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

        {preview && !loadingPreview && (
          <Stack spacing={2} mt={0.5}>
            {/* Gastos recurrentes */}
            <Box>
              <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                <Typography variant="subtitle2">Gastos recurrentes que aplican hoy</Typography>
                <Tooltip title="Los gastos mensuales/anuales se aplican cuando el cierre ocurre en el día configurado. Puedes desmarcar cualquiera si no deseas aplicarlo.">
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>

              {preview.gastosRecurrentes.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                  Ningún gasto recurrente aplica para el día de hoy.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {preview.gastosRecurrentes.map((g) => (
                    <FormControlLabel
                      key={g.gastoTiendaId ?? g.nombre}
                      control={
                        <Checkbox
                          size="small"
                          checked={g.gastoTiendaId ? selectedIds.has(g.gastoTiendaId) : false}
                          onChange={() => g.gastoTiendaId && toggleGasto(g.gastoTiendaId)}
                        />
                      }
                      label={
                        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                          <Box>
                            <Typography variant="body2">{g.nombre}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {g.categoria} · {RECURRENCIA_LABELS[g.recurrencia]}
                              {g.motivoAplica ? ` · ${g.motivoAplica}` : ""}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="error.main" fontWeight="bold" ml={2}>
                            -${g.montoCalculado.toFixed(2)}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: "flex-start", mx: 0 }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Gastos ad-hoc */}
            {preview.gastosAdHoc.length > 0 && (
              <Box>
                <Typography variant="subtitle2" mb={1}>Gastos ad-hoc del período</Typography>
                <Stack spacing={0.5}>
                  {preview.gastosAdHoc.map((g: IGastoCierre) => (
                    <Box
                      key={g.id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ pl: 1 }}
                    >
                      <Box>
                        <Typography variant="body2">{g.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {g.categoria} · {TIPO_CALCULO_LABELS[g.tipoCalculo]}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="error.main" fontWeight="bold">
                        -${g.montoCalculado.toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {preview.gastosNoAplican.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Gastos activos que no aplican hoy: {preview.gastosNoAplican.map((g) => g.nombre).join(", ")}
                </Typography>
              </Box>
            )}

            <Divider />

            {/* Resumen financiero */}
            <Stack spacing={0.5}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Total ventas:</Typography>
                <Typography variant="body2">${preview.totalVentas.toFixed(2)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Ganancia bruta:</Typography>
                <Typography variant="body2">${preview.totalGanancia.toFixed(2)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="error.main">Total gastos:</Typography>
                <Typography variant="body2" color="error.main">-${totalSeleccionado.toFixed(2)}</Typography>
              </Box>
              <Divider />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Ganancia neta:</Typography>
                <Typography
                  variant="subtitle2"
                  color={esNegativa ? "error.main" : "success.main"}
                  fontWeight="bold"
                >
                  ${gananciaFinalEstimada.toFixed(2)}
                </Typography>
              </Box>
            </Stack>

            {esNegativa && (
              <Alert severity="warning">
                La ganancia neta es negativa. Los gastos superan las ganancias del período.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={confirming || loadingPreview}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={confirming || loadingPreview || !!error}
        >
          {confirming ? "Cerrando..." : "Confirmar y cerrar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
