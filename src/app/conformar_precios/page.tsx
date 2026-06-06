"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Alert,
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DataGrid,
  GridRowModel,
  GridColDef,
  GridRenderCellParams,
  GridRenderEditCellParams,
} from "@mui/x-data-grid";
import {
  ArrowDownward,
  ArrowUpward,
  CheckCircle,
  Print,
  Refresh,
  Save,
  Search,
} from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { fecthCostosPreciosProds } from "@/services/costoPrecioServices";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency, normalizeSearch } from "@/utils/formatters";
import { PrintLabelsModal } from "./components/PrintLabelsModal";
import { convertToBase, convertFromBase } from "@/lib/currency";

// ── Desktop: inline DataGrid edit cell ───────────────────────────────────────
const PriceEditCell = (params: GridRenderEditCellParams) => {
  const { id, value, field } = params;
  const stop = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    params.api.stopCellEditMode({ id, field });
  };
  return (
    <TextField
      fullWidth
      autoFocus
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        params.api.setEditCellValue({ id, field, value: isNaN(v) ? 0 : v });
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") stop(e);
      }}
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton color="success" onClick={stop} sx={{ p: 0.5 }}>
                <CheckCircle fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
        htmlInput: {
          min: 0,
          step: 0.01,
          inputMode: "decimal",
          style: { fontSize: "0.875rem" },
        },
      }}
      size="small"
      variant="standard"
      sx={{ "& .MuiInput-root": { fontSize: "0.875rem" } }}
    />
  );
};

const PriceDisplayCell = (
  params: GridRenderCellParams & { monedaCode?: string | null },
) => (
  <Box display="flex" alignItems="center" gap={0.5}>
    <Typography variant="body2" fontWeight="medium">
      {formatCurrency(params.value || 0)}
    </Typography>
    {params.monedaCode && (
      <Chip
        label={params.monedaCode}
        size="small"
        sx={{ height: 16, fontSize: "0.6rem" }}
      />
    )}
  </Box>
);

// ── Mobile: one card per product ─────────────────────────────────────────────
type Producto = {
  id: string;
  nombre: string;
  costo: number;
  precio: number;
  monedaCostoCode: string | null;
  monedaPrecioCode: string | null;
};

type RawProductoCosto = {
  id: string;
  proveedor?: { nombre: string };
  producto: { nombre: string };
  costo?: number;
  precio?: number;
  monedaCostoCode?: string | null;
  monedaPrecioCode?: string | null;
};

interface MobileCardProps {
  producto: Producto;
  isDirty: boolean;
  monedasDisponibles: string[];
  tasasVigentes: Record<string, number>;
  monedaBase: string;
  onSave: (
    id: string,
    precio: number,
    monedaPrecioCode: string | null,
  ) => Promise<void>;
  saving: boolean;
}

function MobileProductCard({
  producto,
  isDirty,
  monedasDisponibles,
  tasasVigentes,
  monedaBase,
  onSave,
  saving,
}: MobileCardProps) {
  const [precio, setPrecio] = useState(producto.precio);
  const [monedaPrecio, setMonedaPrecio] = useState<string | null>(
    producto.monedaPrecioCode,
  );
  const [localDirty, setLocalDirty] = useState(false);

  useEffect(() => {
    setPrecio(producto.precio);
    setMonedaPrecio(producto.monedaPrecioCode);
    setLocalDirty(false);
  }, [producto.precio, producto.monedaPrecioCode]);

  const monedaPrecioEfectiva = monedaPrecio ?? monedaBase;
  const monedaCostoEfectiva = producto.monedaCostoCode ?? monedaBase;

  const precioBase = convertToBase(
    precio,
    monedaPrecioEfectiva,
    tasasVigentes,
    monedaBase,
  );
  const costoBase = convertToBase(
    producto.costo,
    monedaCostoEfectiva,
    tasasVigentes,
    monedaBase,
  );
  const rentabilidad =
    precioBase > 0 && costoBase > 0
      ? (((precioBase - costoBase) / costoBase) * 100).toFixed(1)
      : "0";

  const handleMonedaChange = (nuevaMoneda: string) => {
    const anterior = monedaPrecio ?? monedaBase;
    if (nuevaMoneda !== anterior && precio > 0) {
      const enBase = convertToBase(precio, anterior, tasasVigentes, monedaBase);
      const convertido = convertFromBase(
        enBase,
        nuevaMoneda,
        tasasVigentes,
        monedaBase,
      );
      setPrecio(Math.round(convertido * 100) / 100);
    }
    setMonedaPrecio(nuevaMoneda === monedaBase ? null : nuevaMoneda);
    setLocalDirty(true);
  };

  const handleConfirm = async () => {
    if (!localDirty) return;
    await onSave(producto.id, precio, monedaPrecio);
    setLocalDirty(false);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: isDirty ? "warning.main" : "divider",
        bgcolor: isDirty ? "warning.50" : "background.paper",
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Name + rentabilidad */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={1.5}
        >
          <Typography
            variant="body2"
            fontWeight="medium"
            sx={{ flex: 1, mr: 1 }}
          >
            {producto.nombre}
          </Typography>
          <Chip
            label={`${rentabilidad}%`}
            size="small"
            color={parseFloat(rentabilidad) > 0 ? "success" : "default"}
            variant="outlined"
          />
        </Stack>

        {/* Costo display + moneda chip */}
        <Box mb={1}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mb={0.5}
          >
            Costo
          </Typography>
          <Box display="flex" alignItems="center" gap={0.75}>
            <Typography
              variant="body2"
              color="text.secondary"
              fontWeight="medium"
            >
              {formatCurrency(producto.costo)}
            </Typography>
            {producto.monedaCostoCode && (
              <Chip
                label={producto.monedaCostoCode}
                size="small"
                sx={{ height: 18, fontSize: "0.65rem" }}
              />
            )}
          </Box>
        </Box>

        {/* Precio field + moneda selector */}
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mb={0.5}
            >
              Precio de venta
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              value={precio || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setPrecio(isNaN(v) ? 0 : v);
                setLocalDirty(true);
              }}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                  endAdornment: localDirty ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={handleConfirm}
                        disabled={saving}
                        edge="end"
                      >
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
                htmlInput: { min: 0, step: 0.01, inputMode: "decimal" },
              }}
              disabled={saving}
            />
          </Box>

          {monedasDisponibles.length > 1 && (
            <Box sx={{ minWidth: 80, mt: "22px" }}>
              <FormControl size="small" fullWidth>
                <Select
                  value={monedaPrecioEfectiva}
                  onChange={(e) => handleMonedaChange(e.target.value)}
                  disabled={saving}
                >
                  {monedasDisponibles.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PreciosCantidades = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [idDirtyProds, setIdDirtyProds] = useState<string[]>([]);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);
  const [mobileSortBy, setMobileSortBy] = useState<
    "nombre" | "precio" | "costo" | "rentabilidad" | null
  >(null);
  const [mobileSortDir, setMobileSortDir] = useState<"asc" | "desc">("asc");

  const { user, loadingContext, monedasNegocio, tasasVigentes, monedaBase } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const monedasDisponibles = useMemo(() => {
    const lista = [monedaBase];
    for (const nm of monedasNegocio) {
      if (nm.activo && nm.monedaCode !== monedaBase) lista.push(nm.monedaCode);
    }
    return lista;
  }, [monedaBase, monedasNegocio]);

  const fetchProductos = useCallback(async () => {
    if (!user?.localActual?.id) return;
    try {
      setLoading(true);
      const data = await fecthCostosPreciosProds(user.localActual.id);
      const mapped = ((data || []) as RawProductoCosto[]).map((p) => ({
        ...p,
        nombre: p.proveedor?.nombre
          ? `${p.producto.nombre} - ${p.proveedor.nombre}`
          : p.producto.nombre,
        costo: p.costo || 0,
        precio: p.precio || 0,
        monedaCostoCode: p.monedaCostoCode ?? null,
        monedaPrecioCode: p.monedaPrecioCode ?? null,
      }));
      setProductos(mapped);
      setFilteredProductos(mapped);
      setIdDirtyProds([]);
    } catch {
      showMessage("Error al cargar los productos", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.localActual?.id, showMessage]);

  useEffect(() => {
    if (!loadingContext) fetchProductos();
  }, [loadingContext, fetchProductos]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProductos(productos);
    } else {
      setFilteredProductos(
        productos.filter((p) =>
          normalizeSearch(p.nombre ?? "").includes(normalizeSearch(searchTerm)),
        ),
      );
    }
  }, [searchTerm, productos]);

  const mobileSortedProductos = useMemo(() => {
    if (!mobileSortBy) return filteredProductos;
    return [...filteredProductos].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      if (mobileSortBy === "rentabilidad") {
        const aP = convertToBase(
          a.precio,
          a.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        const aC = convertToBase(
          a.costo,
          a.monedaCostoCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        const bP = convertToBase(
          b.precio,
          b.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        const bC = convertToBase(
          b.costo,
          b.monedaCostoCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        aVal = aC > 0 ? (aP - aC) / aC : 0;
        bVal = bC > 0 ? (bP - bC) / bC : 0;
      } else {
        aVal = a[mobileSortBy];
        bVal = b[mobileSortBy];
      }
      if (typeof aVal === "string")
        return mobileSortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      return mobileSortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [
    filteredProductos,
    mobileSortBy,
    mobileSortDir,
    tasasVigentes,
    monedaBase,
  ]);

  // ── Desktop DataGrid handlers ────────────────────────────────────────────
  const handleProcessRowUpdate = (
    newRow: GridRowModel,
    oldRow: GridRowModel,
  ) => {
    if (newRow.costo < 0 || newRow.precio < 0) {
      showMessage("Los valores deben ser positivos", "warning");
      return productos.find((p) => p.id === newRow.id) || newRow;
    }

    const updated = { ...newRow };

    // Auto-convert precio when monedaPrecio changes
    const oldPrecioMoneda =
      (oldRow.monedaPrecioCode as string | null) ?? monedaBase;
    const newPrecioMoneda =
      (newRow.monedaPrecioCode as string | null) ?? monedaBase;
    if (oldPrecioMoneda !== newPrecioMoneda && newRow.precio > 0) {
      const enBase = convertToBase(
        newRow.precio as number,
        oldPrecioMoneda,
        tasasVigentes,
        monedaBase,
      );
      updated.precio =
        Math.round(
          convertFromBase(enBase, newPrecioMoneda, tasasVigentes, monedaBase) *
            100,
        ) / 100;
    }

    // Auto-convert costo when monedaCosto changes
    const oldCostoMoneda =
      (oldRow.monedaCostoCode as string | null) ?? monedaBase;
    const newCostoMoneda =
      (newRow.monedaCostoCode as string | null) ?? monedaBase;
    if (oldCostoMoneda !== newCostoMoneda && newRow.costo > 0) {
      const enBase = convertToBase(
        newRow.costo as number,
        oldCostoMoneda,
        tasasVigentes,
        monedaBase,
      );
      updated.costo =
        Math.round(
          convertFromBase(enBase, newCostoMoneda, tasasVigentes, monedaBase) *
            100,
        ) / 100;
    }

    if (!idDirtyProds.includes(newRow.id as string))
      setIdDirtyProds((prev) => [...prev, newRow.id as string]);
    setProductos((prev) =>
      prev.map((p) => (p.id === newRow.id ? { ...p, ...updated } : p)),
    );
    return updated;
  };

  const handleProcessRowUpdateError = (error: Error) => {
    console.error(error);
    showMessage("Error al actualizar el producto", "error");
  };

  // ── Shared save helpers ──────────────────────────────────────────────────
  const saveRows = async (
    rows: {
      id: string;
      costo: number;
      precio: number;
      monedaCostoCode: string | null;
      monedaPrecioCode: string | null;
    }[],
  ) => {
    const response = await fetch(
      `/api/productos_tienda/${user!.localActual!.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: rows }),
      },
    );
    if (!response.ok) throw new Error("Error al actualizar productos");
  };

  // Mobile: auto-save single card
  const handleMobileSave = async (
    id: string,
    precio: number,
    monedaPrecioCode: string | null,
  ) => {
    try {
      setSaving(true);
      const p = productos.find((p) => p.id === id);
      await saveRows([
        {
          id,
          costo: p?.costo ?? 0,
          precio,
          monedaCostoCode: p?.monedaCostoCode ?? null,
          monedaPrecioCode,
        },
      ]);
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, precio, monedaPrecioCode } : p)),
      );
      setIdDirtyProds((prev) => prev.filter((x) => x !== id));
      showMessage("Precio actualizado", "success");
    } catch {
      showMessage("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  // Desktop: batch save
  const save = async () => {
    const toSave = productos
      .filter((p) => idDirtyProds.includes(p.id))
      .map((p) => ({
        id: p.id,
        costo: p.costo,
        precio: p.precio,
        monedaCostoCode: p.monedaCostoCode,
        monedaPrecioCode: p.monedaPrecioCode,
      }));
    if (toSave.length === 0) {
      showMessage("No hay cambios para guardar", "info");
      return;
    }
    try {
      setSaving(true);
      await saveRows(toSave);
      showMessage(`${toSave.length} producto(s) actualizado(s)`, "success");
      await fetchProductos();
    } catch {
      showMessage("Error al guardar los cambios", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── DataGrid columns (desktop) ───────────────────────────────────────────
  const columns: GridColDef[] = [
    {
      field: "nombre",
      headerName: "Producto",
      flex: 2,
      minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {p.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "precio",
      headerName: "Precio",
      flex: 1,
      minWidth: 130,
      editable: true,
      type: "number",
      renderCell: (p) => (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PriceDisplayCell {...p} monedaCode={p.row.monedaPrecioCode} />
        </Box>
      ),
      renderEditCell: PriceEditCell,
      headerAlign: "center",
      align: "center",
    },
    ...(monedasDisponibles.length > 1
      ? [
          {
            field: "monedaPrecioCode",
            headerName: "M. Precio",
            width: 100,
            editable: true,
            type: "singleSelect" as const,
            valueOptions: monedasDisponibles,
            valueFormatter: (value: string | null) => value ?? monedaBase,
            renderCell: (p: GridRenderCellParams) => (
              <Chip
                label={p.value ?? monedaBase}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            ),
            headerAlign: "center" as const,
            align: "center" as const,
          },
        ]
      : []),
    {
      field: "costo",
      headerName: "Costo",
      flex: 1,
      minWidth: 130,
      editable: true,
      type: "number",
      renderCell: (p) => (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PriceDisplayCell {...p} monedaCode={p.row.monedaCostoCode} />
        </Box>
      ),
      renderEditCell: PriceEditCell,
      headerAlign: "center",
      align: "center",
    },
    ...(monedasDisponibles.length > 1
      ? [
          {
            field: "monedaCostoCode",
            headerName: "M. Costo",
            width: 100,
            editable: true,
            type: "singleSelect" as const,
            valueOptions: monedasDisponibles,
            valueFormatter: (value: string | null) => value ?? monedaBase,
            renderCell: (p: GridRenderCellParams) => (
              <Chip
                label={p.value ?? monedaBase}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            ),
            headerAlign: "center" as const,
            align: "center" as const,
          },
        ]
      : []),
    {
      field: "porciento",
      headerName: "Rentabilidad",
      flex: 1,
      minWidth: 120,
      renderCell: ({ row }) => {
        const p = convertToBase(
          row.precio,
          (row.monedaPrecioCode as string | null) ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        const c = convertToBase(
          row.costo,
          (row.monedaCostoCode as string | null) ?? monedaBase,
          tasasVigentes,
          monedaBase,
        );
        if (!c || !p) return <Typography variant="body2">0%</Typography>;
        const pct = (((p - c) / c) * 100).toFixed(2);
        return (
          <Typography variant="body2" fontWeight="medium">
            {pct}%
          </Typography>
        );
      },
    },
  ];

  // ── Guards ───────────────────────────────────────────────────────────────
  if (loading || loadingContext) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando productos...
        </Typography>
      </Box>
    );
  }

  if (!user?.localActual?.id) {
    return (
      <PageContainer
        title="Costos y Precios"
        breadcrumbs={[
          { label: "Inicio", href: "/home" },
          { label: "Costos y Precios" },
        ]}
      >
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography>
            Para gestionar los precios, necesitas tener una tienda seleccionada.
          </Typography>
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Conformar Precios" },
  ];

  const headerActions = (
    <Box display="flex" gap={1} alignItems="center">
      {isMobile ? (
        <IconButton size="small" onClick={fetchProductos} disabled={loading}>
          <Refresh />
        </IconButton>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Refresh />}
          onClick={fetchProductos}
          disabled={loading}
        >
          Actualizar
        </Button>
      )}

      {isMobile ? (
        <IconButton
          size="small"
          onClick={() => setPrintLabelsOpen(true)}
          disabled={loading}
        >
          <Print />
        </IconButton>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Print />}
          onClick={() => setPrintLabelsOpen(true)}
          disabled={loading}
          color="secondary"
        >
          Etiquetas
        </Button>
      )}

      {!isMobile && (
        <Button
          variant="contained"
          size="small"
          startIcon={<Save />}
          onClick={save}
          disabled={idDirtyProds.length === 0 || saving}
          color={idDirtyProds.length > 0 ? "primary" : "inherit"}
        >
          {saving
            ? "Guardando..."
            : `Guardar${idDirtyProds.length > 0 ? ` (${idDirtyProds.length})` : ""}`}
        </Button>
      )}
    </Box>
  );

  return (
    <PageContainer
      title="Conformar Precios"
      subtitle="Gestiona los precios de venta de tus productos"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      <ContentCard
        title="Productos"
        subtitle={`${filteredProductos.length} producto${filteredProductos.length !== 1 ? "s" : ""} encontrado${filteredProductos.length !== 1 ? "s" : ""}`}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar producto..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: isMobile ? 150 : 250 }}
          />
        }
        noPadding={!isMobile}
        fullHeight={!isMobile}
      >
        {filteredProductos.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">
              <Typography variant="body1">
                {searchTerm
                  ? "No se encontraron productos con ese término."
                  : "No hay productos registrados en esta tienda."}
              </Typography>
            </Alert>
          </Box>
        ) : isMobile ? (
          /* ── Mobile: card list ── */
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {/* Sort toolbar */}
            <Box
              sx={{
                display: "flex",
                gap: 0.75,
                overflowX: "auto",
                pb: 0.25,
                flexShrink: 0,
              }}
            >
              {(
                [
                  { key: "nombre", label: "Nombre" },
                  { key: "precio", label: "Precio" },
                  { key: "costo", label: "Costo" },
                  { key: "rentabilidad", label: "Rentab." },
                ] as const
              ).map(({ key, label }) => {
                const active = mobileSortBy === key;
                return (
                  <Chip
                    key={key}
                    label={label}
                    size="small"
                    color={active ? "primary" : "default"}
                    variant={active ? "filled" : "outlined"}
                    icon={
                      active ? (
                        mobileSortDir === "asc" ? (
                          <ArrowUpward
                            sx={{ fontSize: "0.875rem !important" }}
                          />
                        ) : (
                          <ArrowDownward
                            sx={{ fontSize: "0.875rem !important" }}
                          />
                        )
                      ) : undefined
                    }
                    onClick={() => {
                      if (active) {
                        setMobileSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setMobileSortBy(key);
                        setMobileSortDir("asc");
                      }
                    }}
                    sx={{ flexShrink: 0 }}
                  />
                );
              })}
            </Box>

            {idDirtyProds.length > 0 && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                <Typography variant="body2">
                  {idDirtyProds.length} producto
                  {idDirtyProds.length !== 1 ? "s" : ""} con cambios sin guardar
                </Typography>
              </Alert>
            )}
            {mobileSortedProductos.map((p) => (
              <MobileProductCard
                key={p.id}
                producto={p}
                isDirty={idDirtyProds.includes(p.id)}
                monedasDisponibles={monedasDisponibles}
                tasasVigentes={tasasVigentes}
                monedaBase={monedaBase}
                onSave={handleMobileSave}
                saving={saving}
              />
            ))}
          </Stack>
        ) : (
          /* ── Desktop: DataGrid ── */
          <>
            {idDirtyProds.length > 0 && (
              <Box
                sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  <Typography variant="body2">
                    Tienes {idDirtyProds.length} producto
                    {idDirtyProds.length !== 1 ? "s" : ""} con cambios sin
                    guardar. Haz clic en &quot;Guardar&quot; para aplicar.
                  </Typography>
                </Alert>
              </Box>
            )}
            <Box
              sx={{
                height: "calc(100vh - 300px)",
                minHeight: 400,
                width: "100%",
                position: "relative",
              }}
            >
              <DataGrid
                rows={filteredProductos}
                columns={columns}
                disableRowSelectionOnClick
                processRowUpdate={handleProcessRowUpdate}
                onProcessRowUpdateError={handleProcessRowUpdateError}
                loading={loading}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                }}
                getRowClassName={(params) =>
                  idDirtyProds.includes(params.id as string)
                    ? "row-modified"
                    : ""
                }
                sx={{
                  border: "none",
                  "& .MuiDataGrid-cell:focus": { outline: "none" },
                  "& .MuiDataGrid-cell:focus-within": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "-2px",
                  },
                  "& .row-modified": {
                    backgroundColor: "#ffebee",
                    "&:hover": { backgroundColor: "#ffcdd2" },
                  },
                }}
                localeText={{
                  noRowsLabel: "No hay productos",
                  noResultsOverlayLabel: "No se encontraron resultados",
                  toolbarDensity: "Densidad",
                  toolbarDensityLabel: "Densidad",
                  toolbarDensityCompact: "Compacta",
                  toolbarDensityStandard: "Estándar",
                  toolbarDensityComfortable: "Cómoda",
                  toolbarColumns: "Columnas",
                  toolbarColumnsLabel: "Seleccionar columnas",
                  toolbarFilters: "Filtros",
                  toolbarFiltersLabel: "Mostrar filtros",
                  toolbarFiltersTooltipHide: "Ocultar filtros",
                  toolbarFiltersTooltipShow: "Mostrar filtros",
                  toolbarExport: "Exportar",
                  toolbarExportLabel: "Exportar",
                  toolbarExportCSV: "Descargar como CSV",
                  toolbarExportPrint: "Imprimir",
                }}
              />
              <Backdrop
                open={saving}
                sx={{
                  color: "#fff",
                  zIndex: (t) => t.zIndex.modal + 1,
                  position: "absolute",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  flexDirection: "column",
                  gap: 2,
                  borderRadius: 2,
                }}
              >
                <CircularProgress color="inherit" />
                <Typography
                  variant="h6"
                  sx={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
                >
                  Guardando cambios...
                </Typography>
              </Backdrop>
            </Box>
          </>
        )}
      </ContentCard>

      {printLabelsOpen && (
        <PrintLabelsModal
          open={printLabelsOpen}
          onClose={() => setPrintLabelsOpen(false)}
          tiendaId={user?.localActual?.id || ""}
        />
      )}
    </PageContainer>
  );
};

export default PreciosCantidades;
