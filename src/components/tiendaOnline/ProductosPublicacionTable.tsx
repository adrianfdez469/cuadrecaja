"use client";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Fragment } from "react";

import {
  ProductoEstadoPill,
  ProductoRazonBlock,
} from "@/components/tiendaOnline/ProductoPublicacionEstado";
import {
  PRECIO_SIN_LOCAL,
  precioLine,
  productoPublicacionPresentation,
} from "@/components/tiendaOnline/productoPublicacionPresentation";
import { PublicarProductoSwitch } from "@/components/tiendaOnline/PublicarProductoSwitch";
import type { ITiendaOnlineProducto } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";

export interface ProductosPublicacionTableProps {
  productos: ITiendaOnlineProducto[];
  puedePublicar: boolean;
  online: boolean;
  pendingProductoIds: ReadonlySet<string>;
  disabledReason: string;
  onToggle: (producto: ITiendaOnlineProducto, next: boolean) => void;
}

/** The five columns, and the ONE place their widths are written. */
const COLUMN_COUNT = 5;
const CATEGORIA_WIDTH = 130;
const PRECIO_WIDTH = 150;
const ESTADO_WIDTH = 150;
const PUBLICAR_WIDTH = 72;
const PRODUCTO_MIN_WIDTH = 180;

/**
 * The product list from 600 px: a real table of five columns.
 *
 * The `Categoría` column is present whether or not a category filter is on: in a
 * table the column is already paid for, and removing it makes every other width
 * jump when the merchant filters. On a card it costs a line, which is why the
 * phone branch does the opposite.
 *
 * The reason sentence gets a row of its own with a single `colSpan` cell — never
 * the Estado cell, where a sixty-character sentence would break into five lines.
 */
export function ProductosPublicacionTable({
  productos,
  puedePublicar,
  online,
  pendingProductoIds,
  disabledReason,
  onToggle,
}: Readonly<ProductosPublicacionTableProps>) {
  return (
    // The net, not the design: the width budget above never needs it.
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: PRODUCTO_MIN_WIDTH }}>Producto</TableCell>
            <TableCell sx={{ width: CATEGORIA_WIDTH }}>Categoría</TableCell>
            <TableCell align="right" sx={{ width: PRECIO_WIDTH }}>
              Precio
            </TableCell>
            <TableCell sx={{ width: ESTADO_WIDTH }}>Estado</TableCell>
            <TableCell align="center" sx={{ width: PUBLICAR_WIDTH }}>
              Publicar
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {productos.map((producto) => {
            const pending = pendingProductoIds.has(producto.id);
            const disabled = !puedePublicar || !online || pending;
            const precio = precioLine(producto.tiendas);

            return (
              <Fragment key={producto.id}>
                <TableRow sx={{ "& td": { height: touch.row } }}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "semantic.text.primary",
                      }}
                    >
                      {producto.nombre}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ color: "semantic.text.secondary" }}
                    >
                      {producto.categoriaNombre}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          precio === PRECIO_SIN_LOCAL
                            ? "semantic.text.disabled"
                            : "semantic.text.secondary",
                      }}
                    >
                      {precio}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <ProductoEstadoPill producto={producto} />
                  </TableCell>
                  <TableCell align="center">
                    <PublicarProductoSwitch
                      producto={producto}
                      disabled={disabled}
                      disabledReason={disabledReason}
                      onToggle={onToggle}
                    />
                  </TableCell>
                </TableRow>
                <RazonRow producto={producto} />
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

/** The reason row, or nothing at all when the state has nothing to explain. */
function RazonRow({ producto }: Readonly<{ producto: ITiendaOnlineProducto }>) {
  // The decision is the pure module's, read here so an empty row is never drawn.
  if (productoPublicacionPresentation(producto).reason.length === 0) return null;

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} sx={{ pt: 0 }}>
        <ProductoRazonBlock producto={producto} />
      </TableCell>
    </TableRow>
  );
}

export default ProductosPublicacionTable;
