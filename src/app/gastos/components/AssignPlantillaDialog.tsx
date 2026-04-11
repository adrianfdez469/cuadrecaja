"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { IGastoPlantilla, IAssignPlantilla, assignPlantillaSchema } from "@/schemas/gastos";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_COLORS,
  RECURRENCIA_LABELS,
  RECURRENCIA_COLORS,
  MESES,
  DIAS_MES,
} from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";

interface Props {
  open: boolean;
  plantillas: IGastoPlantilla[];
  onClose: () => void;
  onAssign: (data: IAssignPlantilla) => Promise<void>;
}

export default function AssignPlantillaDialog({ open, plantillas, onClose, onAssign }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<IGastoPlantilla | null>(null);
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [diaMes, setDiaMes] = useState<number | "">("");
  const [mesAnio, setMesAnio] = useState<number | "">("");
  const [diaAnio, setDiaAnio] = useState<number | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelected(null);
      setMonto("");
      setPorcentaje("");
      setDiaMes("");
      setMesAnio("");
      setDiaAnio("");
      setErrors({});
    }
  }, [open]);

  const handleSelectPlantilla = (p: IGastoPlantilla) => {
    setSelected(p);
    // Pre-rellenar con los valores de la plantilla
    setDiaMes(p.diaMes ?? "");
    setMesAnio(p.mesAnio ?? "");
    setDiaAnio(p.diaAnio ?? "");
    setStep(2);
  };

  const handleAssign = async () => {
    if (!selected) return;

    const raw: IAssignPlantilla = {
      plantillaId: selected.id,
      monto: monto !== "" ? Number(monto) : null,
      porcentaje: porcentaje !== "" ? Number(porcentaje) : null,
      diaMes: diaMes !== "" ? Number(diaMes) : null,
      mesAnio: mesAnio !== "" ? Number(mesAnio) : null,
      diaAnio: diaAnio !== "" ? Number(diaAnio) : null,
    };

    const parsed = assignPlantillaSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (key) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await onAssign(parsed.data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const showMonto = selected?.tipoCalculo === "MONTO_FIJO";
  const showPorcentaje = selected && selected.tipoCalculo !== "MONTO_FIJO";
  const showDiaMes = selected?.recurrencia === "MENSUAL";
  const showAnual = selected?.recurrencia === "ANUAL";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {step === 1 ? "Seleccionar plantilla" : `Configurar: ${selected?.nombre}`}
      </DialogTitle>
      <DialogContent>
        {step === 1 && (
          <Stack spacing={1.5} mt={0.5}>
            {plantillas.length === 0 && (
              <Typography color="text.secondary" textAlign="center" py={2}>
                No hay plantillas disponibles. Crea una desde Configuración → Plantillas de Gastos.
              </Typography>
            )}
            {plantillas.map((p) => (
              <Box
                key={p.id}
                onClick={() => handleSelectPlantilla(p)}
                sx={{
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "action.hover" },
                  opacity: p.activo ? 1 : 0.5,
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="subtitle2">{p.nombre}</Typography>
                  <Chip
                    label={RECURRENCIA_LABELS[p.recurrencia]}
                    size="small"
                    sx={{ backgroundColor: RECURRENCIA_COLORS[p.recurrencia], color: "#fff", fontSize: "0.6875rem" }}
                  />
                </Box>
                <Box display="flex" gap={1} mt={0.5} alignItems="center">
                  <Chip
                    label={TIPO_CALCULO_LABELS[p.tipoCalculo]}
                    size="small"
                    sx={{ backgroundColor: TIPO_CALCULO_COLORS[p.tipoCalculo], color: "#fff", fontSize: "0.6875rem" }}
                  />
                  <Typography variant="caption" color="text.secondary">{p.categoria}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatearCuandoAplica(p)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {step === 2 && selected && (
          <Stack spacing={2} mt={0.5}>
            <Box p={1.5} bgcolor="action.hover" borderRadius={1}>
              <Typography variant="body2" color="text.secondary">
                Plantilla: <strong>{selected.nombre}</strong> · {selected.categoria}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatearCuandoAplica(selected)}
              </Typography>
            </Box>

            <Divider />

            {showMonto && (
              <TextField
                label="Monto para esta tienda"
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                error={!!errors.monto}
                helperText={errors.monto}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
                required
              />
            )}

            {showPorcentaje && (
              <TextField
                label="Porcentaje para esta tienda"
                type="number"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                error={!!errors.porcentaje}
                helperText={errors.porcentaje}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputProps={{ min: 0, max: 100, step: "0.01" }}
                fullWidth
                required
              />
            )}

            {showDiaMes && (
              <FormControl fullWidth error={!!errors.diaMes}>
                <InputLabel>Día del mes</InputLabel>
                <Select
                  value={diaMes}
                  label="Día del mes"
                  onChange={(e) => setDiaMes(Number(e.target.value))}
                >
                  {DIAS_MES.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </Select>
                {errors.diaMes && <FormHelperText>{errors.diaMes}</FormHelperText>}
              </FormControl>
            )}

            {showAnual && (
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth error={!!errors.mesAnio}>
                  <InputLabel>Mes</InputLabel>
                  <Select value={mesAnio} label="Mes" onChange={(e) => setMesAnio(Number(e.target.value))}>
                    {MESES.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </Select>
                  {errors.mesAnio && <FormHelperText>{errors.mesAnio}</FormHelperText>}
                </FormControl>
                <FormControl fullWidth error={!!errors.diaAnio}>
                  <InputLabel>Día</InputLabel>
                  <Select value={diaAnio} label="Día" onChange={(e) => setDiaAnio(Number(e.target.value))}>
                    {DIAS_MES.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                  </Select>
                  {errors.diaAnio && <FormHelperText>{errors.diaAnio}</FormHelperText>}
                </FormControl>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {step === 2 && <Button onClick={() => setStep(1)} disabled={loading}>Atrás</Button>}
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        {step === 2 && (
          <Button variant="contained" onClick={handleAssign} disabled={loading}>
            {loading ? "Asignando..." : "Asignar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
