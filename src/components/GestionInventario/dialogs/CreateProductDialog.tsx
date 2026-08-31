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
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { IProducto, IProductoTiendaV2 } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { CreateProductData } from "../hooks/useGestionInventario";
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
import {
  PRODUCTO_PRUEBA_SUGERENCIAS,
  selectIsOnboardingBlocking,
  useOnboardingProductDemo,
  useOnboardingStore,
} from "@/features/onboarding";

interface Props {
  open: boolean;
  categorias: ICategory[];
  productosTienda: IProductoTiendaV2[];
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

  // Vínculo a un producto existente (de otra tienda) encontrado por nombre
  const [productoVinculado, setProductoVinculado] = useState<IProducto | null>(
    null,
  );
  const [opcionesNombre, setOpcionesNombre] = useState<IProducto[]>([]);
  const [buscandoNombre, setBuscandoNombre] = useState(false);

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
    setProductoVinculado(null);
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
    setProductoVinculado(null);
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

  // Búsqueda con debounce: mientras se escribe el nombre, se busca en todo el
  // negocio para detectar si el producto ya existe en otra tienda.
  useEffect(() => {
    if (!open || productoVinculado) {
      setOpcionesNombre([]);
      return;
    }
    const texto = nombre.trim();
    if (!texto) {
      setOpcionesNombre([]);
      return;
    }
    setBuscandoNombre(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchProducts(texto);
        setOpcionesNombre(res);
      } finally {
        setBuscandoNombre(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nombre, open, productoVinculado]);

  const vincularProducto = (producto: IProducto) => {
    setProductoVinculado(producto);
    setNombre(producto.nombre);
    setDescripcion(producto.descripcion);
    setCatValue(producto.categoria);
    setCatInputValue(producto.categoria?.nombre ?? "");
    setPermiteDecimal(!!producto.permiteDecimal);
    setCodigosProducto(producto.codigosProducto.map((c) => c.codigo));
    setOpcionesNombre([]);
  };

  const desvincularProducto = () => {
    setProductoVinculado(null);
    setDescripcion("");
    setCatValue(null);
    setCatInputValue("");
    setPermiteDecimal(false);
    setCodigosProducto([]);
  };

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
    catInputValue.trim().length > 0 &&
    (!esFraccion || (!!selectedFraccion && !!fraccionValue));

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
      const camposComunes = {
        precio: parseFloat(precio) || 0,
        monedaPrecioCode,
        costo: parseFloat(costo) || 0,
        monedaCostoCode,
        fechaVencimiento: fechaVencimiento
          ? fechaVencimiento.toISOString()
          : null,
        cantidadInicial: parseFloat(cantidadInicial.replace(",", ".")) || 0,
      };

      if (productoVinculado) {
        await onSave({
          nombre: productoVinculado.nombre,
          descripcion: productoVinculado.descripcion,
          categoriaId: productoVinculado.categoriaId,
          permiteDecimal: !!productoVinculado.permiteDecimal,
          codigosProducto: [],
          productoExistenteId: productoVinculado.id,
          ...camposComunes,
        });
        return;
      }

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
        permiteDecimal,
        fraccionDeId:
          esFraccion && selectedFraccion ? selectedFraccion.id : null,
        unidadesPorFraccion: esFraccion && fraccionValue ? fraccionValue : null,
        codigosProducto: codigosProducto.filter(Boolean),
        ...camposComunes,
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
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: isMobile ? "100%" : 600,
          borderRadius: isMobile ? 0 : `${shape.radius.md}px`,
          ...(isDemoMode ? { zIndex: 10001 } : undefined),
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(19,20,23,.35)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: "1.25rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Nuevo producto
        {isMobile && (
          <IconButton
            onClick={() => {
              if (tourRunning && isBlocking) return;
              onClose();
            }}
            disabled={saving || (tourRunning && isBlocking)}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <Box
          data-tour="gi-create-dialog"
          display="flex"
          flexDirection="column"
          gap={0}
          pt={1}
        >
          {/* GRUPO (a): Identidad — Nombre, Descripción, Categoría */}
          <Box sx={{ pb: 2.5 }}>
            <Box display="flex" flexDirection="column" gap={2}>
              <Autocomplete
                freeSolo
                disabled={!!productoVinculado}
                inputValue={nombre}
                onInputChange={(_, val) => setNombre(val)}
                onChange={(_, val) => {
                  if (val && typeof val !== "string") vincularProducto(val);
                }}
                options={opcionesNombre}
                filterOptions={(opts) => opts}
                loading={buscandoNombre}
                getOptionLabel={(opt) =>
                  typeof opt === "string" ? opt : opt.nombre
                }
                renderOption={(props, opt) => (
                  <li {...props} key={opt.id}>
                    <Box display="flex" flexDirection="column">
                      <Typography variant="body2">{opt.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opt.categoria?.nombre} · ya existe en otra tienda
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Nombre"
                    size="small"
                    required
                    fullWidth
                    autoFocus
                    error={!!nombreError}
                    helperText={nombreError}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {buscandoNombre && (
                            <CircularProgress color="inherit" size={16} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              {productoVinculado && (
                <Alert
                  severity="info"
                  action={
                    <Tooltip title="Usar otro nombre">
                      <IconButton size="small" onClick={desvincularProducto}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  Este producto ya existe en el negocio. Se usará el mismo
                  producto — solo se configurará precio, costo y stock para esta
                  tienda.
                </Alert>
              )}

              {!productoVinculado && (
                <>
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
                        helperText={
                          esFraccion
                            ? "Se usa la categoría del producto base"
                            : catError
                        }
                      />
                    )}
                  />
                </>
              )}
            </Box>
          </Box>

          {/* Separador */}
          {!productoVinculado && (
            <Box
              sx={{ borderTop: 1, borderColor: "divider", mb: 2.5, pt: 2.5 }}
            >
              {/* GRUPO (b): Fracción */}
              <Box sx={{ pb: 2.5 }}>
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
                    flexDirection="column"
                    sx={{ mt: 1.5 }}
                  >
                    <FormControl
                      size="small"
                      fullWidth
                      required
                      error={!!fraccionProductoError}
                    >
                      <InputLabel>Producto base</InputLabel>
                      <Select
                        label="Producto base"
                        value={selectedFraccion?.id ?? ""}
                        onChange={(e) =>
                          setSelectedFraccion(
                            productos.find((p) => p.id === e.target.value) ??
                              null,
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
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Separador */}
          <Box sx={{ borderTop: 1, borderColor: "divider", mb: 2.5, pt: 2.5 }}>
            {/* GRUPO (c): Dinero — Costo y Precio */}
            <Box sx={{ pb: 2.5 }}>
              <Box display="flex" flexDirection="column" gap={2}>
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
                      sx={{ width: isMobile ? "100%" : 110, flexShrink: 0 }}
                    >
                      <InputLabel>Moneda</InputLabel>
                      <Select
                        label="Moneda"
                        value={costoMonedaEfectiva}
                        onChange={(e) =>
                          handleCostoMonedaChange(e.target.value)
                        }
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
                    sx={{ flex: 1 }}
                  />
                </Box>

                {/* Equivalente en base */}
                {costoEnBase !== null && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    ≈ {costoEnBase.toFixed(2)} {monedaBase}
                  </Typography>
                )}

                {esFraccion && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    Calculado automáticamente a partir del producto base
                  </Typography>
                )}

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
                      sx={{ width: isMobile ? "100%" : 110, flexShrink: 0 }}
                    >
                      <InputLabel>Moneda</InputLabel>
                      <Select
                        label="Moneda"
                        value={precioMonedaEfectiva}
                        onChange={(e) =>
                          handlePrecioMonedaChange(e.target.value)
                        }
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
                    sx={{ flex: 1 }}
                  />
                </Box>

                {/* Equivalente en base */}
                {precioEnBase !== null && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    ≈ {precioEnBase.toFixed(2)} {monedaBase}
                  </Typography>
                )}

                <RentabilidadRibbon
                  costoBase={costoBase}
                  precioBase={precioBase}
                />

                {warnCostoMayorPrecio && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    El costo ({costoBase.toFixed(2)} {monedaBase}) es mayor al
                    precio de venta ({precioBase.toFixed(2)} {monedaBase}).
                  </Alert>
                )}
              </Box>
            </Box>
          </Box>

          {/* Separador */}
          <Box sx={{ borderTop: 1, borderColor: "divider", mb: 2.5, pt: 2.5 }}>
            {/* GRUPO (d): Inventario */}
            <Box sx={{ pb: 2.5 }}>
              <Box display="flex" flexDirection="column" gap={2}>
                <SelectableTextField
                  label="Cantidad inicial (opcional)"
                  value={cantidadInicial}
                  onChange={(e) =>
                    setCantidadInicial(e.target.value.replace(/-/g, ""))
                  }
                  size="small"
                  inputProps={{ inputMode: "decimal" }}
                  helperText={
                    parseFloat(cantidadInicial) > 0
                      ? "Se creará un movimiento de Compra con esta cantidad"
                      : "Deja en 0 para agregar stock después"
                  }
                />

                <DatePicker
                  label="Fecha de vencimiento"
                  value={fechaVencimiento}
                  onChange={(val) => setFechaVencimiento(val)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />

                {!productoVinculado && (
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
                )}

                {warnCantidadCero && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    El producto quedará con stock 0 y no aparecerá en el POS de
                    venta.
                  </Alert>
                )}
              </Box>
            </Box>
          </Box>

          {/* Separador */}
          {!productoVinculado && (
            <Box
              sx={{ borderTop: 1, borderColor: "divider", mb: 2.5, pt: 2.5 }}
            >
              {/* GRUPO (e): Códigos de Barcode */}
              <Box sx={{ pb: 0 }}>
                <Box display="flex" alignItems="center" mb={2}>
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
                  <Box
                    key={idx}
                    display="flex"
                    alignItems="center"
                    mb={1}
                    gap={0.5}
                  >
                    <HardwareQrScanner
                      qrCodeSuccessCallback={(qrText) =>
                        handleCodigoChange(idx, qrText)
                      }
                      showInput
                      style={{ flex: 1 }}
                      value={codigo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleCodigoChange(idx, e.target.value)
                      }
                      keepFocus={false}
                    />
                    <Tooltip title="Escanear con cámara">
                      <IconButton
                        size="small"
                        onClick={() => {}}
                        sx={{
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                        }}
                      >
                        <QrCodeScannerIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <MobileQrScanner
                      qrCodeSuccessCallback={(qrText) =>
                        handleCodigoChange(idx, qrText)
                      }
                    />
                    <Tooltip title="Eliminar código">
                      <IconButton
                        onClick={() => handleRemoveCodigo(idx)}
                        size="small"
                        sx={{
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          gap: isMobile ? 1 : 1,
          py: 1.5,
          px: 2,
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={onClose}
          disabled={saving || (tourRunning && isBlocking)}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : 56 }}
        >
          Cancelar
        </Button>
        <Button
          data-tour="gi-create-save-btn"
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          fullWidth={isMobile}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
          sx={{ minHeight: 56 }}
        >
          {saving ? "Creando..." : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
