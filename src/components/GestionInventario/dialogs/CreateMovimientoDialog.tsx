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
} from "@mui/material";
import { useState, useEffect } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  onClose: () => void;
  onCreated: () => void;
}

type TipoSimple = "COMPRA" | "AJUSTE_ENTRADA" | "AJUSTE_SALIDA";

const TIPOS: { value: TipoSimple; label: string }[] = [
  { value: "COMPRA", label: "Compra (entrada con costo)" },
  { value: "AJUSTE_ENTRADA", label: "Ajuste entrada" },
  { value: "AJUSTE_SALIDA", label: "Ajuste salida" },
];

export function CreateMovimientoDialog({ open, producto, onClose, onCreated }: Props) {
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const [tipo, setTipo] = useState<TipoSimple>("COMPRA");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && producto) {
      setTipo("COMPRA");
      setCantidad("");
      setCostoUnitario(String(producto.costo));
      setMotivo("");
    }
  }, [open, producto]);

  if (!producto) return null;

  const handleSave = async () => {
    const qty = parseFloat(cantidad.replace(",", "."));
    if (!qty || qty <= 0) {
      showMessage("Ingresa una cantidad válida", "warning");
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
        },
        [{
          productoId: producto.productoId,
          cantidad: qty,
          ...(tipo === "COMPRA" && { costoUnitario: costo, costoTotal: costo * qty }),
        }]
      );
      showMessage("Movimiento registrado", "success");
      onCreated();
    } catch {
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
          <Alert severity="info">Stock actual: <strong>{producto.existencia}</strong></Alert>

          <FormControl size="small" fullWidth>
            <InputLabel>Tipo de movimiento</InputLabel>
            <Select
              label="Tipo de movimiento"
              value={tipo}
              onChange={e => setTipo(e.target.value as TipoSimple)}
            >
              {TIPOS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            label="Cantidad"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            size="small"
            inputProps={{ inputMode: "decimal" }}
            autoFocus
          />

          {tipo === "COMPRA" && (
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
