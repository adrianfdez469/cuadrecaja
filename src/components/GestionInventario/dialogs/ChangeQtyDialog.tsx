"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useState, useEffect, useMemo } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { ChangeQtyOptions } from "../hooks/useGestionInventario";
import { formatQuantity } from "@/utils/formatters";
import {
  parseQuantityText,
  roundQuantity,
  sanitizeQuantityDraft,
} from "@/utils/quantityInput";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import MoneyField from "@/components/MoneyField";
import SelectableTextField from "@/components/SelectableTextField";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  onClose: () => void;
  onSave: (newQty: number, options: ChangeQtyOptions) => Promise<void>;
}

export function ChangeQtyDialog({ open, producto, onClose, onSave }: Props) {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const [newQtyStr, setNewQtyStr] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [monedaCompra, setMonedaCompra] = useState<string>(monedaBase);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const monedasParaCompra = useMemo(() => {
    const lista = [monedaBase];
    for (const nm of monedasNegocio) {
      if (nm.activo && nm.monedaCode !== monedaBase) lista.push(nm.monedaCode);
    }
    return lista;
  }, [monedaBase, monedasNegocio]);

  useEffect(() => {
    if (open && producto) {
      // Use raw number string to avoid locale-formatted separators breaking parseFloat
      setNewQtyStr(formatQuantity(producto.existencia));
      setCostoUnitario(String(producto.costo));
      setMonedaCompra(producto.monedaCostoCode ?? monedaBase);
      setMotivo("");
    }
  }, [open, producto, monedaBase]);

  if (!producto) return null;

  const esConsignacion = !!producto.proveedorId;
  const permiteDecimal = !!producto.producto.permiteDecimal;
  // The draft already arrives with "," normalized to "." — `parseFloat` alone
  // read "2,5" as 2 and silently registered an adjustment for the difference.
  const newQty = parseQuantityText(newQtyStr, permiteDecimal) ?? 0;
  const delta = roundQuantity(newQty - producto.existencia);
  const tipo =
    delta > 0
      ? esConsignacion
        ? "CONSIGNACION_ENTRADA"
        : "COMPRA"
      : delta < 0
        ? esConsignacion
          ? "CONSIGNACION_DEVOLUCION"
          : "AJUSTE_SALIDA"
        : null;

  const tipoLabel =
    tipo === "COMPRA"
      ? "Compra"
      : tipo === "AJUSTE_SALIDA"
        ? "Ajuste de salida"
        : tipo === "CONSIGNACION_ENTRADA"
          ? "Consignación entrada"
          : tipo === "CONSIGNACION_DEVOLUCION"
            ? "Consignación devolución"
            : null;

  const handleSave = async () => {
    if (delta === 0 || !tipo) return;
    setSaving(true);
    try {
      await onSave(newQty, {
        costoUnitario:
          tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA"
            ? parseFloat(costoUnitario) || producto.costo
            : undefined,
        monedaCompra:
          tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA"
            ? monedaCompra
            : undefined,
        motivo: motivo || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const mostrarCosto = tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA";
  const mostrarMoneda = mostrarCosto && monedasParaCompra.length > 1;
  const isExtraCurrency = mostrarCosto && monedaCompra !== monedaBase;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar cantidad — {producto.producto.nombre}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <Box display="flex" gap={2}>
            <TextField
              label="Cantidad actual"
              value={formatQuantity(producto.existencia)}
              disabled
              size="small"
              sx={{ flex: 1 }}
            />
            <SelectableTextField
              label="Nueva cantidad"
              value={newQtyStr}
              onChange={(e) =>
                setNewQtyStr(
                  sanitizeQuantityDraft(e.target.value, permiteDecimal),
                )
              }
              size="small"
              sx={{ flex: 1 }}
              inputProps={{
                inputMode: permiteDecimal ? "decimal" : "numeric",
                min: 0,
              }}
              autoFocus
            />
          </Box>

          {delta > 0 && tipoLabel && (
            <Alert severity="info">
              Se creará un movimiento de <strong>{tipoLabel}</strong> por{" "}
              {formatQuantity(delta)} unidades.
              {esConsignacion && producto.proveedor && (
                <>
                  {" "}
                  Proveedor: <strong>{producto.proveedor.nombre}</strong>
                </>
              )}
            </Alert>
          )}
          {delta < 0 && tipoLabel && (
            <Alert severity="warning">
              Se creará un <strong>{tipoLabel}</strong> por{" "}
              {formatQuantity(Math.abs(delta))} unidades.
            </Alert>
          )}
          {delta === 0 && newQtyStr && (
            <Alert severity="success">Sin cambios en la cantidad.</Alert>
          )}

          {mostrarCosto && (
            <MoneyField
              label={`Costo unitario${isExtraCurrency ? ` (${monedaCompra})` : ""}`}
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              size="small"
              helperText={
                isExtraCurrency && costoUnitario
                  ? `≈ ${convertToBase(parseFloat(costoUnitario) || 0, monedaCompra, tasasVigentes, monedaBase).toFixed(2)} ${monedaBase}`
                  : "Deja el valor actual si no cambió el costo"
              }
            />
          )}

          {mostrarMoneda && (
            <FormControl size="small" fullWidth>
              <InputLabel>Moneda de compra</InputLabel>
              <Select
                label="Moneda de compra"
                value={monedaCompra}
                onChange={(e) => setMonedaCompra(e.target.value)}
              >
                {monedasParaCompra.map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {tipo && (
            <TextField
              label="Motivo (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              size="small"
              placeholder="Ej: Conteo físico, ajuste de inventario..."
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || delta === 0}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {saving ? "Guardando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
