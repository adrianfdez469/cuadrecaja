"use client";

import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { IProducto } from "@/schemas/producto";
import { ICategory } from "@/schemas/categoria";
import { CreateProductData } from "../hooks/useGestionInventario";
import { fetchProducts } from "@/services/productServise";

interface Props {
  open: boolean;
  categorias: ICategory[];
  onClose: () => void;
  onSave: (data: CreateProductData) => Promise<void>;
}

type CatOption = ICategory | { inputValue: string; nombre: string; id: string };

function generateTempColor(): string {
  const colors = ["#2196f3", "#4caf50", "#ff9800", "#e91e63", "#9c27b0", "#00bcd4"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function CreateProductDialog({ open, categorias, onClose, onSave }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [catValue, setCatValue] = useState<CatOption | null>(null);
  const [catInputValue, setCatInputValue] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [permiteDecimal, setPermiteDecimal] = useState(false);
  const [esFraccion, setEsFraccion] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const [selectedFraccion, setSelectedFraccion] = useState<IProducto | null>(null);
  const [fraccionValue, setFraccionValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre("");
      setDescripcion("");
      setCatValue(null);
      setCatInputValue("");
      setPrecio("");
      setCosto("");
      setCantidadInicial("");
      setPermiteDecimal(false);
      setEsFraccion(false);
      setSelectedFraccion(null);
      setFraccionValue(null);
    }
  }, [open]);

  useEffect(() => {
    if (esFraccion && productos.length === 0) {
      fetchProducts().then(setProductos);
    }
  }, [esFraccion]);

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const typedText = catInputValue.trim();
      const isExistingCat =
        catValue && !("inputValue" in catValue) && (catValue as ICategory).nombre === typedText;
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
        costo: parseFloat(costo) || 0,
        cantidadInicial: parseFloat(cantidadInicial.replace(",", ".")) || 0,
        permiteDecimal,
        fraccionDeId: esFraccion && selectedFraccion ? selectedFraccion.id : null,
        unidadesPorFraccion: esFraccion && fraccionValue ? fraccionValue : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nuevo producto</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            size="small"
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Descripción"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
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
            getOptionLabel={opt => {
              if (typeof opt === "string") return opt;
              if ("inputValue" in opt) return opt.inputValue;
              return opt.nombre;
            }}
            renderOption={(props, opt) => (
              <li {...props} key={(opt as ICategory).id}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 14, height: 14, borderRadius: "3px", bgcolor: (opt as ICategory).color }} />
                  {opt.nombre}
                </Box>
              </li>
            )}
            freeSolo
            renderInput={params => <TextField {...params} label="Categoría" size="small" required />}
          />

          <Box display="flex" gap={2}>
            <TextField
              label="Precio"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Costo"
              value={costo}
              onChange={e => setCosto(e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ flex: 1 }}
            />
          </Box>

          <TextField
            label="Cantidad inicial (opcional)"
            value={cantidadInicial}
            onChange={e => setCantidadInicial(e.target.value)}
            size="small"
            inputProps={{ inputMode: "decimal" }}
            helperText={parseFloat(cantidadInicial) > 0 ? "Se creará un movimiento de Compra con esta cantidad" : "Deja en 0 para agregar stock después"}
          />

          <FormControlLabel
            control={<Checkbox checked={permiteDecimal} onChange={e => setPermiteDecimal(e.target.checked)} size="small" />}
            label="Permite cantidades decimales"
          />

          <FormControlLabel
            control={<Checkbox checked={esFraccion} onChange={e => setEsFraccion(e.target.checked)} size="small" />}
            label="Es fracción de otro producto"
          />

          {esFraccion && (
            <Box display="flex" gap={2} flexDirection={{ xs: "column", sm: "row" }}>
              <FormControl size="small" fullWidth sx={{ flex: 1 }}>
                <InputLabel>Producto base</InputLabel>
                <Select
                  label="Producto base"
                  value={selectedFraccion?.id ?? ""}
                  onChange={e => setSelectedFraccion(productos.find(p => p.id === e.target.value) ?? null)}
                >
                  {productos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Unidades por fracción"
                value={fraccionValue ?? ""}
                onChange={e => setFraccionValue(parseInt(e.target.value) || null)}
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ inputMode: "numeric" }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !nombre.trim()}>
          {saving ? "Creando..." : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
