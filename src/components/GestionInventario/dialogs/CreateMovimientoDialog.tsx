"use client";

import {
  Alert,
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
  TextField,
  Autocomplete,
} from "@mui/material";
import { useState, useEffect } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { IProveedor } from "@/schemas/proveedor";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { getProveedores } from "@/services/proveedorService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  onClose: () => void;
  onCreated: () => void;
}

type TipoMovimiento = "COMPRA" | "AJUSTE_ENTRADA" | "AJUSTE_SALIDA" | "CONSIGNACION_ENTRADA" | "CONSIGNACION_DEVOLUCION";

const TIPOS_BASE: { value: TipoMovimiento; label: string; esEntrada: boolean }[] = [
  { value: "COMPRA", label: "Compra (entrada con costo)", esEntrada: true },
  { value: "AJUSTE_ENTRADA", label: "Ajuste entrada", esEntrada: true },
  { value: "AJUSTE_SALIDA", label: "Ajuste salida", esEntrada: false },
  { value: "CONSIGNACION_ENTRADA", label: "Consignación entrada", esEntrada: true },
  { value: "CONSIGNACION_DEVOLUCION", label: "Consignación devolución", esEntrada: false },
];

export function CreateMovimientoDialog({ open, producto, onClose, onCreated }: Props) {
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const [tipo, setTipo] = useState<TipoMovimiento>("COMPRA");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [selectedProveedor, setSelectedProveedor] = useState<IProveedor | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && producto) {
      // If product is in consignación, default to consignación types
      const defaultTipo: TipoMovimiento = producto.proveedorId
        ? "CONSIGNACION_ENTRADA"
        : "COMPRA";
      setTipo(defaultTipo);
      setCantidad("");
      setCostoUnitario(String(producto.costo));
      setMotivo("");
      setSelectedProveedor(producto.proveedor ?? null);
    }
  }, [open, producto]);

  useEffect(() => {
    if (open && (tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION")) {
      getProveedores().then(setProveedores).catch(() => {});
    }
  }, [open, tipo]);

  if (!producto) return null;

  const esConsignacion = tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION";
  const mostrarCosto = tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA";

  const handleSave = async () => {
    const qty = parseFloat(cantidad.replace(",", "."));
    if (!qty || qty <= 0) {
      showMessage("Ingresa una cantidad válida", "warning");
      return;
    }
    if (esConsignacion && !selectedProveedor) {
      showMessage("Selecciona un proveedor para movimientos de consignación", "warning");
      return;
    }
    const costo = parseFloat(costoUnitario) || 0;
    setSaving(true);
    try {
      await cretateBatchMovimientos(
        {
          tipo,
          tiendaId: user.localActual.id,
          usuarioId: user.id,
          motivo: motivo || undefined,
          ...(esConsignacion && selectedProveedor && { proveedorId: selectedProveedor.id }),
        },
        [{
          productoId: producto.productoId,
          cantidad: qty,
          ...(mostrarCosto && { costoUnitario: costo, costoTotal: costo * qty }),
        }]
      );
      showMessage("Movimiento registrado", "success");
      onCreated();
    } catch(e) {
      console.error(e);
      showMessage("Error al registrar el movimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar movimiento — {producto.producto.nombre}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <Alert severity="info">
            Stock actual: <strong>{producto.existencia}</strong>
            {producto.proveedor && <> · Proveedor: <strong>{producto.proveedor.nombre}</strong></>}
          </Alert>

          <FormControl size="small" fullWidth>
            <InputLabel>Tipo de movimiento</InputLabel>
            <Select
              label="Tipo de movimiento"
              value={tipo}
              onChange={e => {
                setTipo(e.target.value as TipoMovimiento);
                if (!selectedProveedor && producto.proveedor) {
                  setSelectedProveedor(producto.proveedor);
                }
              }}
            >
              {TIPOS_BASE.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>

          {esConsignacion && (
            <Autocomplete
              size="small"
              options={proveedores}
              getOptionLabel={p => p.nombre}
              value={selectedProveedor}
              onChange={(_, val) => setSelectedProveedor(val)}
              renderInput={params => (
                <TextField {...params} label="Proveedor *" placeholder="Seleccionar proveedor..." />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
            />
          )}

          <TextField
            label="Cantidad"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            size="small"
            inputProps={{ inputMode: "decimal" }}
            autoFocus
          />

          {mostrarCosto && (
            <TextField
              label="Costo unitario"
              value={costoUnitario}
              onChange={e => setCostoUnitario(e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          )}

          <TextField
            label="Motivo (opcional)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            size="small"
            placeholder="Descripción del movimiento..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Guardando..." : "Registrar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
