"use client";

import { Card, Stack, Typography } from "@mui/material";

import {
  ProductoEstadoPill,
  ProductoRazonBlock,
} from "@/components/tiendaOnline/ProductoPublicacionEstado";
import { precioLine } from "@/components/tiendaOnline/productoPublicacionPresentation";
import { PublicarProductoSwitch } from "@/components/tiendaOnline/PublicarProductoSwitch";
import type { ITiendaOnlineProducto } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";

export interface ProductosPublicacionMobileListProps {
  productos: ITiendaOnlineProducto[];
  /** The category is not repeated on every card when it is already the filter. */
  hideCategoria: boolean;
  puedePublicar: boolean;
  online: boolean;
  pendingProductoIds: ReadonlySet<string>;
  /** The reason a disabled switch is disabled, for whoever cannot see the notice. */
  disabledReason: string;
  onToggle: (producto: ITiendaOnlineProducto, next: boolean) => void;
}

/**
 * The product list under 600 px: one outlined card per product.
 *
 * NOT `InventarioMobileList`: that one shows stock, margin and expiry dates —
 * three things this screen must never show — and its action sheet has nothing to
 * do with publishing. And no `<table>` exists in this branch at all.
 *
 * The card is NOT a button: the switch is the only thing that can be pressed, so
 * a stray tap while scrolling cannot publish something to the public.
 */
export function ProductosPublicacionMobileList({
  productos,
  hideCategoria,
  puedePublicar,
  online,
  pendingProductoIds,
  disabledReason,
  onToggle,
}: Readonly<ProductosPublicacionMobileListProps>) {
  return (
    <Stack spacing={1.5}>
      {productos.map((producto) => {
        const pending = pendingProductoIds.has(producto.id);
        const disabled = !puedePublicar || !online || pending;
        const precio = precioLine(producto.tiendas);
        const secondary = hideCategoria
          ? precio
          : `${producto.categoriaNombre} · ${precio}`;

        return (
          <Card key={producto.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
                sx={{ minHeight: touch.row }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: "semantic.text.primary" }}
                >
                  {producto.nombre}
                </Typography>
                <PublicarProductoSwitch
                  producto={producto}
                  disabled={disabled}
                  disabledReason={disabledReason}
                  onToggle={onToggle}
                />
              </Stack>

              <Typography
                variant="body2"
                sx={{
                  color: producto.tiendas.length === 0
                    ? "semantic.text.disabled"
                    : "semantic.text.secondary",
                }}
              >
                {secondary}
              </Typography>

              <ProductoEstadoPill producto={producto} />
              <ProductoRazonBlock producto={producto} />
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

export default ProductosPublicacionMobileList;
