"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
} from "@mui/material";
import { useState, useEffect } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { ChangeQtyOptions } from "../hooks/useGestionInventario";
import { formatNumber } from "@/utils/formatters";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  onClose: () => void;
  onSave: (newQty: number, options: ChangeQtyOptions) => Promise<void>;
}

export function ChangeQtyDialog({ open, producto, onClose, onSave }: Props) {
  const [newQtyStr, setNewQtyStr] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && producto) {
      setNewQtyStr(formatNumber(producto.existencia));
      setCostoUnitario(String(producto.costo));
      setMotivo("");
    }
  }, [open, producto]);

  if (!producto) return null;

  const newQty = parseFloat(newQtyStr.replace(",", ".")) || 0;
  const delta = newQty - producto.existencia;
  const tipo = delta > 0 ? "COMPRA" : delta < 0 ? "AJUSTE_SALIDA" : null;

  const handleSave = async () => {
    if (delta === 0) return;
    setSaving(true);
    try {
      await onSave(newQty, {
        costoUnitario: tipo === "COMPRA" ? parseFloat(costoUnitario) || producto.costo : undefined,
        motivo: motivo || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar cantidad — {producto.producto.nombre}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <Box display="flex" gap={2}>
            <TextField
              label="Cantidad actual"
              value={formatNumber(producto.existencia)}
              InputProps={{ readOnly: true }}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Nueva cantidad"
              value={newQtyStr}
              onChange={e => setNewQtyStr(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ inputMode: "decimal" }}
              autoFocus
            />
          </Box>

          {tipo === "COMPRA" && (
            <>
              <Alert severity="info">Se creará un movimiento de <strong>Compra</strong> por {formatNumber(delta)} unidades.</Alert>
              <TextField
                label="Costo unitario"
                value={costoUnitario}
                onChange={e => setCostoUnitario(e.target.value)}
                size="small"
                inputProps={{ inputMode: "decimal" }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                helperText="Deja el valor actual si no cambió el costo"
              />
            </>
          )}

          {tipo === "AJUSTE_SALIDA" && (
            <Alert severity="warning">Se creará un <strong>Ajuste de salida</strong> por {formatNumber(Math.abs(delta))} unidades.</Alert>
          )}

          {delta === 0 && newQtyStr && (
            <Alert severity="success">Sin cambios en la cantidad.</Alert>
          )}

          {tipo && (
            <TextField
              label="Motivo (opcional)"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              size="small"
              placeholder="Ej: Conteo físico, ajuste de inventario..."
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || delta === 0}
        >
          {saving ? "Guardando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
