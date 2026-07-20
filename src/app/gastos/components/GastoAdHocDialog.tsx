"use client";

import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  IGastoAdHocCreate,
  TipoCalculoEnum,
  NaturalezaGastoEnum,
  gastoAdHocCreateSchema,
} from "@/schemas/gastos";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_DESCRIPTIONS,
  NATURALEZA_GASTO_LABELS,
  NATURALEZA_GASTO_DESCRIPTIONS,
} from "@/constants/gastos";

interface Props {
  open: boolean;
  totalVentas?: number;
  totalGanancia?: number;
  categoriasExistentes?: string[];
  monedasActivas?: {
    monedaCode: string;
    moneda?: { nombre: string; simbolo: string };
  }[];
  monedaBase?: string;
  onClose: () => void;
  onSave: (data: IGastoAdHocCreate) => Promise<void>;
}

export default function GastoAdHocDialog({
  open,
  totalVentas = 0,
  totalGanancia = 0,
  categoriasExistentes = [],
  monedasActivas,
  monedaBase,
  onClose,
  onSave,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipoCalculo, setTipoCalculo] =
    useState<IGastoAdHocCreate["tipoCalculo"]>("MONTO_FIJO");
  const [naturaleza, setNaturaleza] =
    useState<IGastoAdHocCreate["naturaleza"]>("OPERATIVO");
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [monedaCode, setMonedaCode] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre("");
      setCategoria("");
      setTipoCalculo("MONTO_FIJO");
      setNaturaleza("OPERATIVO");
      setMonto("");
      setPorcentaje("");
      setMonedaCode(null);
      setErrors({});
    }
  }, [open]);

  const montoCalculado = (): number => {
    if (tipoCalculo === "MONTO_FIJO") return Number(monto) || 0;
    if (tipoCalculo === "PORCENTAJE_VENTAS")
      return ((Number(porcentaje) || 0) / 100) * totalVentas;
    if (tipoCalculo === "PORCENTAJE_GANANCIAS")
      return ((Number(porcentaje) || 0) / 100) * totalGanancia;
    return 0;
  };

  const handleSave = async () => {
    const raw: IGastoAdHocCreate = {
      nombre,
      categoria,
      tipoCalculo,
      naturaleza,
      montoCalculado: montoCalculado(),
      monto: tipoCalculo === "MONTO_FIJO" ? Number(monto) : null,
      porcentaje: tipoCalculo !== "MONTO_FIJO" ? Number(porcentaje) : null,
      monedaCode: tipoCalculo === "MONTO_FIJO" ? (monedaCode ?? null) : null,
    };

    const parsed = gastoAdHocCreateSchema.safeParse(raw);
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
      await onSave(parsed.data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const calculado = montoCalculado();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar gasto ad-hoc</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Descripción del gasto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={!!errors.nombre}
            helperText={errors.nombre}
            required
            fullWidth
          />

          <Autocomplete
            freeSolo
            options={categoriasExistentes}
            inputValue={categoria}
            onInputChange={(_, value) => setCategoria(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Categoría"
                error={!!errors.categoria}
                helperText={
                  errors.categoria ?? "Ej: Reparación, Compra urgente"
                }
                required
              />
            )}
          />

          <FormControl fullWidth>
            <InputLabel>Tipo de cálculo</InputLabel>
            <Select
              value={tipoCalculo}
              label="Tipo de cálculo"
              onChange={(e) =>
                setTipoCalculo(
                  e.target.value as IGastoAdHocCreate["tipoCalculo"],
                )
              }
            >
              {TipoCalculoEnum.options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Box>
                    <Typography variant="body2">
                      {TIPO_CALCULO_LABELS[opt]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {TIPO_CALCULO_DESCRIPTIONS[opt]}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Naturaleza</InputLabel>
            <Select
              value={naturaleza}
              label="Naturaleza"
              onChange={(e) =>
                setNaturaleza(e.target.value as IGastoAdHocCreate["naturaleza"])
              }
            >
              {NaturalezaGastoEnum.options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Box>
                    <Typography variant="body2">
                      {NATURALEZA_GASTO_LABELS[opt]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {NATURALEZA_GASTO_DESCRIPTIONS[opt]}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {tipoCalculo === "MONTO_FIJO" ? (
            <>
              {(monedasActivas?.length ?? 0) > 1 && (
                <FormControl fullWidth>
                  <InputLabel>Moneda del gasto</InputLabel>
                  <Select
                    value={monedaCode ?? monedaBase ?? ""}
                    label="Moneda del gasto"
                    onChange={(e) => setMonedaCode(e.target.value || null)}
                  >
                    {monedasActivas!.map((m) => (
                      <MenuItem key={m.monedaCode} value={m.monedaCode}>
                        {m.moneda?.nombre ?? m.monedaCode}
                        {m.monedaCode === (monedaBase ?? "") && " (base)"}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField
                label="Monto"
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                error={!!errors.monto || !!errors.montoCalculado}
                helperText={errors.monto ?? errors.montoCalculado}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {monedasActivas?.find(
                        (m) => m.monedaCode === (monedaCode ?? monedaBase),
                      )?.moneda?.simbolo ?? "$"}
                    </InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
            </>
          ) : (
            <>
              <TextField
                label="Porcentaje"
                type="number"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                error={!!errors.porcentaje}
                helperText={errors.porcentaje}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, max: 100, step: "0.01" }}
                fullWidth
              />
              {calculado > 0 && (
                <Box bgcolor="action.hover" p={1} borderRadius={1}>
                  <Typography variant="body2">
                    Monto calculado: <strong>${calculado.toFixed(2)}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tipoCalculo === "PORCENTAJE_VENTAS"
                      ? `${porcentaje}% de $${totalVentas.toFixed(2)} en ventas`
                      : `${porcentaje}% de $${totalGanancia.toFixed(2)} en ganancias`}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Registrar gasto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
