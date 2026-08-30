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
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import {
  ICreateGastoTienda,
  ICreateGastoPlantilla,
  IGastoTienda,
  IGastoPlantilla,
  TipoCalculoEnum,
  RecurrenciaGastoEnum,
  NaturalezaGastoEnum,
  createGastoTiendaSchema,
  createGastoPlantillaSchema,
} from "@/schemas/gastos";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_DESCRIPTIONS,
  RECURRENCIA_LABELS,
  RECURRENCIA_DESCRIPTIONS,
  NATURALEZA_GASTO_LABELS,
  NATURALEZA_GASTO_DESCRIPTIONS,
  MESES,
  DIAS_MES,
} from "@/constants/gastos";
import MoneyField from "@/components/MoneyField";
import PercentageField from "@/components/PercentageField";

type Mode = "tienda" | "plantilla";

interface Props {
  open: boolean;
  mode: Mode;
  initial?: IGastoTienda | IGastoPlantilla | null;
  categoriasExistentes?: string[];
  onClose: () => void;
  onSave: (data: ICreateGastoTienda | ICreateGastoPlantilla) => Promise<void>;
}

const emptyForm = {
  nombre: "",
  categoria: "",
  tipoCalculo: "MONTO_FIJO" as ICreateGastoTienda["tipoCalculo"],
  naturaleza: "OPERATIVO" as ICreateGastoTienda["naturaleza"],
  recurrencia: "DIARIO" as ICreateGastoTienda["recurrencia"],
  monto: "" as string | number,
  porcentaje: "" as string | number,
  diaMes: "" as string | number,
  mesAnio: "" as string | number,
  diaAnio: "" as string | number,
  activo: true,
};

export default function GastoFormDialog({
  open,
  mode,
  initial,
  categoriasExistentes = [],
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          nombre: initial.nombre,
          categoria: initial.categoria,
          tipoCalculo: initial.tipoCalculo,
          naturaleza: initial.naturaleza ?? "OPERATIVO",
          recurrencia: initial.recurrencia,
          monto: (initial as IGastoTienda).monto ?? "",
          porcentaje: (initial as IGastoTienda).porcentaje ?? "",
          diaMes: initial.diaMes ?? "",
          mesAnio: initial.mesAnio ?? "",
          diaAnio: initial.diaAnio ?? "",
          activo: initial.activo,
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
    }
  }, [open, initial]);

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const raw = {
      nombre: form.nombre,
      categoria: form.categoria,
      tipoCalculo: form.tipoCalculo,
      naturaleza: form.naturaleza,
      recurrencia: form.recurrencia,
      monto: form.monto !== "" ? Number(form.monto) : null,
      porcentaje: form.porcentaje !== "" ? Number(form.porcentaje) : null,
      diaMes: form.diaMes !== "" ? Number(form.diaMes) : null,
      mesAnio: form.mesAnio !== "" ? Number(form.mesAnio) : null,
      diaAnio: form.diaAnio !== "" ? Number(form.diaAnio) : null,
      activo: form.activo,
    };

    const schema =
      mode === "tienda" ? createGastoTiendaSchema : createGastoPlantillaSchema;
    const parsed = schema.safeParse(raw);

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
      await onSave(parsed.data as ICreateGastoTienda | ICreateGastoPlantilla);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const showMonto = mode === "tienda" && form.tipoCalculo === "MONTO_FIJO";
  const showPorcentaje = mode === "tienda" && form.tipoCalculo !== "MONTO_FIJO";
  const showDiaMes = form.recurrencia === "MENSUAL";
  const showAnual = form.recurrencia === "ANUAL";

  const title = initial
    ? mode === "tienda"
      ? "Editar gasto"
      : "Editar plantilla"
    : mode === "tienda"
      ? "Nuevo gasto"
      : "Nueva plantilla";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {title}
        {isMobile && (
          <IconButton onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            error={!!errors.nombre}
            helperText={errors.nombre}
            required
            fullWidth
          />

          <Autocomplete
            freeSolo
            options={categoriasExistentes}
            inputValue={form.categoria}
            onInputChange={(_, value) => set("categoria", value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Categoría"
                error={!!errors.categoria}
                helperText={
                  errors.categoria ?? "Ej: Alquiler, Empleados, Servicios"
                }
                required
              />
            )}
          />

          {/* Tipo de cálculo — patrón .pick */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                mb: 1,
              }}
            >
              Tipo de cálculo
            </Typography>
            <Select
              value={form.tipoCalculo}
              onChange={(e) => set("tipoCalculo", e.target.value)}
              fullWidth
              error={!!errors.tipoCalculo}
              renderValue={(value) => (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {TIPO_CALCULO_LABELS[value]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {TIPO_CALCULO_DESCRIPTIONS[value]}
                    </Typography>
                  </Box>
                  <ChevronRightIcon fontSize="small" />
                </Box>
              )}
            >
              {TipoCalculoEnum.options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {TIPO_CALCULO_LABELS[opt]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {TIPO_CALCULO_DESCRIPTIONS[opt]}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.tipoCalculo && (
              <FormHelperText error>{errors.tipoCalculo}</FormHelperText>
            )}
          </Box>

          {/* Naturaleza — patrón .pick */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                mb: 1,
              }}
            >
              Naturaleza
            </Typography>
            <Select
              value={form.naturaleza}
              onChange={(e) => set("naturaleza", e.target.value)}
              fullWidth
              error={!!errors.naturaleza}
              renderValue={(value) => (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {NATURALEZA_GASTO_LABELS[value]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {NATURALEZA_GASTO_DESCRIPTIONS[value]}
                    </Typography>
                  </Box>
                  <ChevronRightIcon fontSize="small" />
                </Box>
              )}
            >
              {NaturalezaGastoEnum.options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {NATURALEZA_GASTO_LABELS[opt]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {NATURALEZA_GASTO_DESCRIPTIONS[opt]}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.naturaleza && (
              <FormHelperText error>{errors.naturaleza}</FormHelperText>
            )}
          </Box>

          {showMonto && (
            <MoneyField
              label="Monto"
              value={form.monto}
              onChange={(e) => set("monto", e.target.value)}
              error={!!errors.monto}
              helperText={errors.monto}
              fullWidth
            />
          )}

          {showPorcentaje && (
            <PercentageField
              label="Porcentaje"
              value={form.porcentaje}
              onChange={(e) => set("porcentaje", e.target.value)}
              error={!!errors.porcentaje}
              helperText={errors.porcentaje}
              fullWidth
            />
          )}

          {/* Recurrencia — patrón .pick */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                mb: 1,
              }}
            >
              Recurrencia
            </Typography>
            <Select
              value={form.recurrencia}
              onChange={(e) => set("recurrencia", e.target.value)}
              fullWidth
              error={!!errors.recurrencia}
              renderValue={(value) => (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {RECURRENCIA_LABELS[value]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {RECURRENCIA_DESCRIPTIONS[value]}
                    </Typography>
                  </Box>
                  <ChevronRightIcon fontSize="small" />
                </Box>
              )}
            >
              {RecurrenciaGastoEnum.options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {RECURRENCIA_LABELS[opt]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {RECURRENCIA_DESCRIPTIONS[opt]}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.recurrencia && (
              <FormHelperText error>{errors.recurrencia}</FormHelperText>
            )}
          </Box>

          {showDiaMes && (
            <FormControl fullWidth error={!!errors.diaMes}>
              <InputLabel>Día del mes</InputLabel>
              <Select
                value={form.diaMes}
                label="Día del mes"
                onChange={(e) => set("diaMes", e.target.value)}
              >
                {DIAS_MES.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.diaMes ? (
                <FormHelperText>{errors.diaMes}</FormHelperText>
              ) : (
                <FormHelperText>
                  Si el mes tiene menos días, se aplicará el último día del mes
                </FormHelperText>
              )}
            </FormControl>
          )}

          {showAnual && (
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth error={!!errors.mesAnio}>
                <InputLabel>Mes</InputLabel>
                <Select
                  value={form.mesAnio}
                  label="Mes"
                  onChange={(e) => set("mesAnio", e.target.value)}
                >
                  {MESES.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.mesAnio && (
                  <FormHelperText>{errors.mesAnio}</FormHelperText>
                )}
              </FormControl>
              <FormControl fullWidth error={!!errors.diaAnio}>
                <InputLabel>Día</InputLabel>
                <Select
                  value={form.diaAnio}
                  label="Día"
                  onChange={(e) => set("diaAnio", e.target.value)}
                >
                  {DIAS_MES.map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.diaAnio && (
                  <FormHelperText>{errors.diaAnio}</FormHelperText>
                )}
              </FormControl>
            </Stack>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
            }
            label="Activo"
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={onClose}
          disabled={loading}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          fullWidth={isMobile}
          size={isMobile ? "large" : "medium"}
          sx={{ minHeight: isMobile ? 56 : undefined }}
        >
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
