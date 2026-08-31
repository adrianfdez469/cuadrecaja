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
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { IProducto, IProductoTiendaV2 } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { EditProductData } from "../hooks/useGestionInventario";
import { fetchProducts } from "@/services/productServise";
import HardwareQrScanner from "@/components/ProductProcessorData/HardwareQrScanner";
import MobileQrScanner from "@/components/ProductProcessorData/MobileQrScanner";
import { useAppContext } from "@/context/AppContext";
import { convertToBase, convertFromBase } from "@/lib/currency";
import { usePermisos } from "@/utils/permisos_front";
import MoneyField from "@/components/MoneyField";
import SelectableTextField from "@/components/SelectableTextField";
import { RentabilidadRibbon } from "./RentabilidadRibbon";
import { calcularCostoFraccion } from "./fraccionCosto";
import { shape } from "@/theme";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  categorias: ICategory[];
  productosTienda: IProductoTiendaV2[];
  onClose: () => void;
  onSave: (producto: IProductoTiendaV2, data: EditProductData) => Promise<void>;
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

export function EditProductDialog({
  open,
  producto,
  categorias,
  productosTienda,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { verificarPermiso } = usePermisos();
  const puedeEditarCosto = verificarPermiso(
    "operaciones.inventario.editarcosto",
  );
  const puedeEditarPrecio = verificarPermiso(
    "operaciones.inventario.editarprecio",
  );

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

  useEffect(() => {
    if (open && producto) {
      const prod = producto.producto;
      setNombre(prod.nombre);
      setDescripcion(prod.descripcion || "");
      const foundCat =
        categorias.find((c) => c.id === prod.categoriaId) ?? null;
      setCatValue(foundCat);
      setCatInputValue(foundCat?.nombre ?? "");
      setPrecio(String(producto.precio));
      setMonedaPrecioCode(producto.monedaPrecioCode ?? null);
      setCosto(String(producto.costo));
      setMonedaCostoCode(producto.monedaCostoCode ?? null);
      setFechaVencimiento(
        producto.fechaVencimiento ? dayjs(producto.fechaVencimiento) : null,
      );
      setPermiteDecimal(!!prod.permiteDecimal);
      setEsFraccion(!!prod.fraccionDeId);
      setFraccionValue(prod.unidadesPorFraccion ?? null);
      setCodigosProducto(prod.codigosProducto?.map((c) => c.codigo) ?? []);
      setSelectedFraccion(null);
      setSubmitted(false);
    }
  }, [open, producto]);

  useEffect(() => {
    if (!open || !esFraccion) return;
    const fraccionDeId = producto?.producto.fraccionDeId;
    if (productos.length === 0) {
      fetchProducts().then((prods) => {
        setProductos(prods);
        setSelectedFraccion(
          fraccionDeId
            ? (prods.find((p) => p.id === fraccionDeId) ?? null)
            : null,
        );
      });
    } else if (fraccionDeId) {
      setSelectedFraccion(productos.find((p) => p.id === fraccionDeId) ?? null);
    }
  }, [open, esFraccion, producto, productos]);

  useEffect(() => {
    if (!esFraccion || !selectedFraccion || !fraccionValue) return;
    const calculado = calcularCostoFraccion(
      selectedFraccion.id,
      fraccionValue,
      productosTienda,
    );
    if (calculado) {
      setCosto(calculado.costo);
      setMonedaCostoCode(calculado.monedaCostoCode);
    }
  }, [esFraccion, selectedFraccion, fraccionValue, productosTienda]);

  useEffect(() => {
    if (!esFraccion || !selectedFraccion) return;
    setCatValue(selectedFraccion.categoria);
    setCatInputValue(selectedFraccion.categoria.nombre);
  }, [esFraccion, selectedFraccion]);

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
      await onSave(producto!, {
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

  const handleAddCodigo = () => setCodigosProducto((prev) => [...prev, ""]);
  const handleRemoveCodigo = (idx: number) =>
    setCodigosProducto((prev) => prev.filter((_, i) => i !== idx));
  const handleCodigoChange = (idx: number, val: string) =>
    setCodigosProducto((prev) => prev.map((c, i) => (i === idx ? val : c)));

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
  const fraccionProductoError =
    submitted && esFraccion && !selectedFraccion
      ? "Selecciona el producto base"
      : "";
  const fraccionCantidadError =
    submitted && esFraccion && !fraccionValue
      ? "La cantidad es obligatoria"
      : "";
  const canSave =
    nombre.trim().length > 0 &&
    (!esFraccion || (!!selectedFraccion && !!fraccionValue));

  if (!producto) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: isMobile ? "100%" : undefined,
          borderRadius: isMobile ? 0 : `${shape.radius.md}px`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Editar — {producto.producto.nombre}
        {isMobile && (
          <IconButton onClick={onClose} disabled={saving}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            size="small"
            required
            fullWidth
          />
          <TextField
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            size="small"
            fullWidth
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
              <FormControl
                size="small"
                fullWidth
                required
                error={!!fraccionProductoError}
                sx={{ flex: 1 }}
              >
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
                {fraccionProductoError && (
                  <FormHelperText>{fraccionProductoError}</FormHelperText>
                )}
              </FormControl>
              <SelectableTextField
                label="Unidades por fracción"
                value={fraccionValue ?? ""}
                onChange={(e) =>
                  setFraccionValue(
                    parseInt(e.target.value.replace(/-/g, "")) || null,
                  )
                }
                size="small"
                required
                error={!!fraccionCantidadError}
                helperText={fraccionCantidadError}
                sx={{ flex: 1 }}
                inputProps={{ inputMode: "numeric" }}
              />
            </Box>
          )}

          <Autocomplete
            value={catValue}
            inputValue={catInputValue}
            disabled={esFraccion}
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
            renderInput={(params) => (
              <TextField
                {...params}
                label="Categoría"
                size="small"
                helperText={
                  esFraccion
                    ? "Se usa la categoría del producto base"
                    : undefined
                }
              />
            )}
          />

          {/* Costo + moneda */}
          <Box
            display="flex"
            flexDirection={isMobile ? "column" : "row"}
            gap={1}
            alignItems={isMobile ? "stretch" : "flex-start"}
          >
            {monedasDisponibles.length > 1 && (
              <FormControl
                size="small"
                sx={{ minWidth: isMobile ? undefined : 90 }}
              >
                <InputLabel>Moneda</InputLabel>
                <Select
                  label="Moneda"
                  value={costoMonedaEfectiva}
                  onChange={(e) => handleCostoMonedaChange(e.target.value)}
                  disabled={!puedeEditarCosto || esFraccion}
                >
                  {monedasDisponibles.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <MoneyField
              label={`Costo (${costoMonedaEfectiva})`}
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              size="small"
              disabled={!puedeEditarCosto || esFraccion}
              helperText={
                esFraccion
                  ? "Calculado automáticamente a partir del producto base"
                  : costoEnBase !== null
                    ? `≈ ${costoEnBase.toFixed(2)} ${monedaBase}`
                    : undefined
              }
              sx={{ flex: 1 }}
            />
          </Box>

          {/* Precio + moneda */}
          <Box
            display="flex"
            flexDirection={isMobile ? "column" : "row"}
            gap={1}
            alignItems={isMobile ? "stretch" : "flex-start"}
          >
            {monedasDisponibles.length > 1 && (
              <FormControl
                size="small"
                sx={{ minWidth: isMobile ? undefined : 90 }}
              >
                <InputLabel>Moneda</InputLabel>
                <Select
                  label="Moneda"
                  value={precioMonedaEfectiva}
                  onChange={(e) => handlePrecioMonedaChange(e.target.value)}
                  disabled={!puedeEditarPrecio}
                >
                  {monedasDisponibles.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <MoneyField
              label={`Precio (${precioMonedaEfectiva})`}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              size="small"
              disabled={!puedeEditarPrecio}
              helperText={
                precioEnBase !== null
                  ? `≈ ${precioEnBase.toFixed(2)} ${monedaBase}`
                  : undefined
              }
              sx={{ flex: 1 }}
            />
          </Box>

          <RentabilidadRibbon costoBase={costoBase} precioBase={precioBase} />

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
      <DialogActions
        sx={{
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={onClose}
          disabled={saving}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          fullWidth={isMobile}
          size={isMobile ? "large" : "medium"}
          sx={{ minHeight: isMobile ? 56 : undefined }}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
