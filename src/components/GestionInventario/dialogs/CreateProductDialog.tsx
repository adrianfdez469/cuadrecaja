"use client";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { IProducto } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { CreateProductData } from "../hooks/useGestionInventario";
import { fetchProducts } from "@/services/productServise";
import HardwareQrScanner from "@/components/ProductProcessorData/HardwareQrScanner";
import MobileQrScanner from "@/components/ProductProcessorData/MobileQrScanner";
import { useAppContext } from "@/context/AppContext";
import { convertToBase, convertFromBase } from "@/lib/currency";
import {
  PRODUCTO_PRUEBA_SUGERENCIAS,
  selectIsOnboardingBlocking,
  useOnboardingProductDemo,
  useOnboardingStore,
} from "@/features/onboarding";

interface Props {
  open: boolean;
  categorias: ICategory[];
  onClose: () => void;
  onSave: (data: CreateProductData) => Promise<void>;
}

type CatOption = ICategory | { inputValue: string; nombre: string; id: string };

function generateTempColor(): string {
  const colors = [
    "#2196f3",
    "#4caf50",
    "#ff9800",
    "#e91e63",
    "#9c27b0",
    "#00bcd4",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function resolveCategoriaDemo(categorias: ICategory[]): {
  catValue: CatOption | null;
  catInputValue: string;
} {
  const nombreCat = PRODUCTO_PRUEBA_SUGERENCIAS.categoria;
  const existente = categorias.find(
    (c) => c.nombre.toLowerCase() === nombreCat.toLowerCase(),
  );
  if (existente) {
    return { catValue: existente, catInputValue: existente.nombre };
  }
  return {
    catValue: { inputValue: nombreCat, nombre: nombreCat, id: "" },
    catInputValue: nombreCat,
  };
}

export function CreateProductDialog({
  open,
  categorias,
  onClose,
  onSave,
}: Props) {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const isDemoMode = useOnboardingProductDemo();
  const isBlocking = useOnboardingStore(selectIsOnboardingBlocking);
  const tourRunning = useOnboardingStore((s) => s.run);

  const monedasDisponibles = useMemo(() => {
    const lista = [monedaBase];
    for (const nm of monedasNegocio) {
      if (nm.activo && nm.monedaCode !== monedaBase) lista.push(nm.monedaCode);
    }
    return lista;
  }, [monedaBase, monedasNegocio]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [catValue, setCatValue] = useState<CatOption | null>(null);
  const [catInputValue, setCatInputValue] = useState("");
  const [precio, setPrecio] = useState("");
  const [monedaPrecioCode, setMonedaPrecioCode] = useState<string | null>(null);
  const [costo, setCosto] = useState("");
  const [monedaCostoCode, setMonedaCostoCode] = useState<string | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState<Dayjs | null>(null);
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [permiteDecimal, setPermiteDecimal] = useState(false);
  const [esFraccion, setEsFraccion] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const [selectedFraccion, setSelectedFraccion] = useState<IProducto | null>(
    null,
  );
  const [fraccionValue, setFraccionValue] = useState<number | null>(null);
  const [codigosProducto, setCodigosProducto] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const applyDemoValues = () => {
    const { catValue: cat, catInputValue: catInput } =
      resolveCategoriaDemo(categorias);
    setNombre(PRODUCTO_PRUEBA_SUGERENCIAS.nombre);
    setDescripcion("");
    setCatValue(cat);
    setCatInputValue(catInput);
    setPrecio(PRODUCTO_PRUEBA_SUGERENCIAS.precio);
    setMonedaPrecioCode(null);
    setCosto(PRODUCTO_PRUEBA_SUGERENCIAS.costo);
    setMonedaCostoCode(null);
    setFechaVencimiento(null);
    setCantidadInicial(PRODUCTO_PRUEBA_SUGERENCIAS.cantidadInicial);
    setPermiteDecimal(false);
    setEsFraccion(false);
    setSelectedFraccion(null);
    setFraccionValue(null);
    setCodigosProducto([]);
    setSubmitted(false);
  };

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setCatValue(null);
    setCatInputValue("");
    setPrecio("");
    setMonedaPrecioCode(null);
    setCosto("");
    setMonedaCostoCode(null);
    setFechaVencimiento(null);
    setCantidadInicial("");
    setPermiteDecimal(false);
    setEsFraccion(false);
    setSelectedFraccion(null);
    setFraccionValue(null);
    setCodigosProducto([]);
    setSubmitted(false);
  };

  useEffect(() => {
    if (!open) return;

    if (isDemoMode) {
      applyDemoValues();
      const timer = window.setTimeout(() => {
        const store = useOnboardingStore.getState();
        store.signalEvent({ type: "dialog_demo_ready" });
        store.bumpLayoutNonce();
      }, 250);
      return () => window.clearTimeout(timer);
    }

    resetForm();
  }, [open, isDemoMode]);

  useEffect(() => {
    if (!open || !isDemoMode) return;
    applyDemoValues();
  }, [open, isDemoMode, categorias]);

  useEffect(() => {
    if (esFraccion && productos.length === 0) {
      fetchProducts().then(setProductos);
    }
  }, [esFraccion]);

  const handlePrecioMonedaChange = (nuevaMoneda: string) => {
    const monedaActual = monedaPrecioCode ?? monedaBase;
    const valorActual = parseFloat(precio) || 0;
    if (nuevaMoneda !== monedaActual && valorActual > 0) {
      const enBase = convertToBase(
        valorActual,
        monedaActual,
        tasasVigentes,
        monedaBase,
      );
      const convertido = convertFromBase(
        enBase,
        nuevaMoneda,
        tasasVigentes,
        monedaBase,
      );
      setPrecio(String(Math.round(convertido * 100) / 100));
    }
    setMonedaPrecioCode(nuevaMoneda === monedaBase ? null : nuevaMoneda);
  };

  const handleCostoMonedaChange = (nuevaMoneda: string) => {
    const monedaActual = monedaCostoCode ?? monedaBase;
    const valorActual = parseFloat(costo) || 0;
    if (nuevaMoneda !== monedaActual && valorActual > 0) {
      const enBase = convertToBase(
        valorActual,
        monedaActual,
        tasasVigentes,
        monedaBase,
      );
      const convertido = convertFromBase(
        enBase,
        nuevaMoneda,
        tasasVigentes,
        monedaBase,
      );
      setCosto(String(Math.round(convertido * 100) / 100));
    }
    setMonedaCostoCode(nuevaMoneda === monedaBase ? null : nuevaMoneda);
  };

  const handleAddCodigo = () => setCodigosProducto((prev) => [...prev, ""]);
  const handleRemoveCodigo = (idx: number) =>
    setCodigosProducto((prev) => prev.filter((_, i) => i !== idx));
  const handleCodigoChange = (idx: number, val: string) =>
    setCodigosProducto((prev) => prev.map((c, i) => (i === idx ? val : c)));

  const nombreError =
    submitted && !nombre.trim() ? "El nombre es obligatorio" : "";
  const catError =
    submitted && !catInputValue.trim() ? "La categoría es obligatoria" : "";
  const canSave = nombre.trim().length > 0 && catInputValue.trim().length > 0;

  const precioMonedaEfectiva = monedaPrecioCode ?? monedaBase;
  const costoMonedaEfectiva = monedaCostoCode ?? monedaBase;
  const precioEnBase =
    precioMonedaEfectiva !== monedaBase
      ? convertToBase(
          parseFloat(precio) || 0,
          precioMonedaEfectiva,
          tasasVigentes,
          monedaBase,
        )
      : null;
  const costoEnBase =
    costoMonedaEfectiva !== monedaBase
      ? convertToBase(
          parseFloat(costo) || 0,
          costoMonedaEfectiva,
          tasasVigentes,
          monedaBase,
        )
      : null;

  const precioBase =
    precioEnBase !== null ? precioEnBase : parseFloat(precio) || 0;
  const costoBase = costoEnBase !== null ? costoEnBase : parseFloat(costo) || 0;
  const warnCostoMayorPrecio =
    costoBase > 0 && precioBase > 0 && costoBase > precioBase;
  const warnCantidadCero = (parseFloat(cantidadInicial) || 0) === 0;

  const handleSave = async () => {
    setSubmitted(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const typedText = catInputValue.trim();
      const isExistingCat =
        catValue &&
        !("inputValue" in catValue) &&
        (catValue as ICategory).nombre === typedText;
      const newCatName = isExistingCat ? null : typedText || null;
      const categoriaId = isExistingCat ? (catValue as ICategory).id : "";
      await onSave({
        nombre: nombre.trim(),
        descripcion,
        categoriaId,
        ...(newCatName && {
          newCategoriaName: newCatName,
          newCategoriaColor: generateTempColor(),
        }),
        precio: parseFloat(precio) || 0,
        monedaPrecioCode,
        costo: parseFloat(costo) || 0,
        monedaCostoCode,
        fechaVencimiento: fechaVencimiento
          ? fechaVencimiento.toISOString()
          : null,
        cantidadInicial: parseFloat(cantidadInicial.replace(",", ".")) || 0,
        permiteDecimal,
        fraccionDeId:
          esFraccion && selectedFraccion ? selectedFraccion.id : null,
        unidadesPorFraccion: esFraccion && fraccionValue ? fraccionValue : null,
        codigosProducto: codigosProducto.filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (tourRunning && isBlocking) return;
        onClose();
      }}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: isDemoMode ? { zIndex: 10001 } : undefined,
      }}
    >
      <DialogTitle>Nuevo producto</DialogTitle>
      <DialogContent>
        <Box
          data-tour="gi-create-dialog"
          display="flex"
          flexDirection="column"
          gap={2}
          pt={1}
        >
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            size="small"
            required
            fullWidth
            autoFocus
            error={!!nombreError}
            helperText={nombreError}
          />
          <TextField
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            size="small"
            fullWidth
          />

          <Autocomplete
            value={catValue}
            inputValue={catInputValue}
            onChange={(_, val) => {
              if (typeof val === "string") {
                setCatValue({ inputValue: val, nombre: val, id: "" });
              } else {
                setCatValue(val);
              }
            }}
            onInputChange={(_, val) => setCatInputValue(val)}
            options={categorias}
            getOptionLabel={(opt) => {
              if (typeof opt === "string") return opt;
              if ("inputValue" in opt) return opt.inputValue;
              return opt.nombre;
            }}
            isOptionEqualToValue={(opt, val) =>
              (opt as ICategory).id === (val as ICategory).id
            }
            renderOption={(props, opt) => (
              <li {...props} key={(opt as ICategory).id}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: "3px",
                      bgcolor: (opt as ICategory).color,
                    }}
                  />
                  {opt.nombre}
                </Box>
              </li>
            )}
            freeSolo
            selectOnFocus
            renderInput={(params) => (
              <TextField
                {...params}
                label="Categoría"
                size="small"
                required
                error={!!catError}
                helperText={catError}
              />
            )}
          />

          {/* Costo + moneda */}
          <Box display="flex" gap={1} alignItems="flex-start">
            {monedasDisponibles.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <InputLabel>Moneda</InputLabel>
                  <Select
                      label="Moneda"
                      value={costoMonedaEfectiva}
                      onChange={(e) => handleCostoMonedaChange(e.target.value)}
                  >
                    {monedasDisponibles.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                    ))}
                  </Select>
                </FormControl>
            )}
            <TextField
                label={`Costo (${costoMonedaEfectiva})`}
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                size="small"
                inputProps={{ inputMode: "decimal" }}
                InputProps={{
                  startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                helperText={
                  costoEnBase !== null
                      ? `≈ ${costoEnBase.toFixed(2)} ${monedaBase}`
                      : undefined
                }
                sx={{ flex: 1 }}
            />
          </Box>

          {/* Precio + moneda */}
          <Box display="flex" gap={1} alignItems="flex-start">
            {monedasDisponibles.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <InputLabel>Moneda</InputLabel>
                <Select
                  label="Moneda"
                  value={precioMonedaEfectiva}
                  onChange={(e) => handlePrecioMonedaChange(e.target.value)}
                >
                  {monedasDisponibles.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label={`Precio (${precioMonedaEfectiva})`}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              helperText={
                precioEnBase !== null
                  ? `≈ ${precioEnBase.toFixed(2)} ${monedaBase}`
                  : undefined
              }
              sx={{ flex: 1 }}
            />
          </Box>

          {warnCostoMayorPrecio && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              El costo ({costoBase.toFixed(2)} {monedaBase}) es mayor al precio
              de venta ({precioBase.toFixed(2)} {monedaBase}).
            </Alert>
          )}

          <DatePicker
            label="Fecha de vencimiento"
            value={fechaVencimiento}
            onChange={(val) => setFechaVencimiento(val)}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />

          <TextField
            label="Cantidad inicial (opcional)"
            value={cantidadInicial}
            onChange={(e) => setCantidadInicial(e.target.value)}
            size="small"
            inputProps={{ inputMode: "decimal" }}
            helperText={
              parseFloat(cantidadInicial) > 0
                ? "Se creará un movimiento de Compra con esta cantidad"
                : "Deja en 0 para agregar stock después"
            }
          />

          {warnCantidadCero && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              El producto quedará con stock 0 y no aparecerá en el POS de venta.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={permiteDecimal}
                onChange={(e) => setPermiteDecimal(e.target.checked)}
                size="small"
              />
            }
            label="Permite cantidades decimales"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={esFraccion}
                onChange={(e) => setEsFraccion(e.target.checked)}
                size="small"
              />
            }
            label="Es fracción de otro producto"
          />

          {esFraccion && (
            <Box
              display="flex"
              gap={2}
              flexDirection={{ xs: "column", sm: "row" }}
            >
              <FormControl size="small" fullWidth sx={{ flex: 1 }}>
                <InputLabel>Producto base</InputLabel>
                <Select
                  label="Producto base"
                  value={selectedFraccion?.id ?? ""}
                  onChange={(e) =>
                    setSelectedFraccion(
                      productos.find((p) => p.id === e.target.value) ?? null,
                    )
                  }
                >
                  {productos.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Unidades por fracción"
                value={fraccionValue ?? ""}
                onChange={(e) =>
                  setFraccionValue(parseInt(e.target.value) || null)
                }
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ inputMode: "numeric" }}
              />
            </Box>
          )}

          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="body2" fontWeight={600}>
                Códigos de producto
              </Typography>
              <Tooltip title="Agregar código">
                <IconButton
                  size="small"
                  onClick={handleAddCodigo}
                  sx={{ ml: 1 }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {codigosProducto.map((codigo, idx) => (
              <Box key={idx} display="flex" alignItems="center" mb={1} gap={1}>
                <HardwareQrScanner
                  qrCodeSuccessCallback={(qrText) =>
                    handleCodigoChange(idx, qrText)
                  }
                  showInput
                  style={{ width: "100%" }}
                  value={codigo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleCodigoChange(idx, e.target.value)
                  }
                  keepFocus={false}
                />
                <MobileQrScanner
                  qrCodeSuccessCallback={(qrText) =>
                    handleCodigoChange(idx, qrText)
                  }
                />
                <Tooltip title="Eliminar código">
                  <IconButton
                    onClick={() => handleRemoveCodigo(idx)}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={saving || (tourRunning && isBlocking)}
        >
          Cancelar
        </Button>
        <Button
          data-tour="gi-create-save-btn"
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {saving ? "Creando..." : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
