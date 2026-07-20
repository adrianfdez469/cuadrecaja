"use client";

import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { IFormaPagoCompra } from "@/schemas/movimiento";
import { FORMA_PAGO_COMPRA_LABELS } from "@/constants/formaPagoCompra";

// Externo primero: es la forma de pago más común en compras de mercancía.
// MIXTO no es seleccionable — el backend lo asigna solo cuando la compra
// en EFECTIVO_CAJA supera el efectivo disponible en caja.
const OPCIONES: IFormaPagoCompra[] = ["EXTERNO", "EFECTIVO_CAJA"];

interface Props {
  value: IFormaPagoCompra;
  onChange: (value: IFormaPagoCompra) => void;
  margin?: "none" | "dense" | "normal";
}

export function FormaPagoCompraSelect({
  value,
  onChange,
  margin = "none",
}: Props) {
  return (
    <FormControl size="small" fullWidth margin={margin}>
      <InputLabel>Forma de pago</InputLabel>
      <Select
        label="Forma de pago"
        value={value}
        onChange={(e) => onChange(e.target.value as IFormaPagoCompra)}
      >
        {OPCIONES.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {FORMA_PAGO_COMPRA_LABELS[opt]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
