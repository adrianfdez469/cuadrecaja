"use client";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useState } from "react";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { StatusPill } from "@/components/StatusPill";
import {
  INVENTARIO_ROW_ESTIMATED_HEIGHT,
  INVENTARIO_TABLE_COLUMNS as COLUMNAS,
  INVENTARIO_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/inventario";
import { formatMontoEnMoneda, formatNumber } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { getRentabilidad } from "./rentabilidad";

interface Props {
  productos: IProductoTiendaV2[];
  loading: boolean;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
}

function getExpiryChip(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return <StatusPill label="Vencido" hue="negative" />;
  if (dias <= 7) return <StatusPill label={`${dias} días`} hue="negative" />;
  if (dias <= 30) return <StatusPill label={`${dias} días`} hue="caution" />;
  // Far off is not a warning: it reads as plain text like any other date.
  return (
    <Typography variant="body2" color="text.secondary">
      {`${dias} días`}
    </Typography>
  );
}

/**
 * The exception speaks, the norm keeps quiet.
 *
 * Every row used to carry a stock pill, so a table where nearly everything is
 * in stock showed a column of green badges — a hundred repetitions of "fine"
 * that made the four rows that were not fine impossible to spot. Only shortage
 * gets a pill now, and only shortage tints the number beside it.
 */
function getStockPill(existencia: number) {
  if (existencia <= 0) return <StatusPill label="Sin stock" hue="negative" />;
  if (existencia <= 5) return <StatusPill label="Bajo" hue="caution" />;
  return null;
}

function stockTone(existencia: number) {
  if (existencia <= 0) return "semantic.hue.negative.main";
  if (existencia <= 5) return "semantic.hue.caution.main";
  return undefined;
}

function ActionsMenu({
  producto,
  onEdit,
  onChangeQty,
  onViewMovements,
  onCreateMov,
  onDelete,
}: {
  producto: IProductoTiendaV2;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit(producto);
          }}
        >
          Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onChangeQty(producto);
          }}
        >
          Cambiar cantidad
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onCreateMov(producto);
          }}
        >
          Registrar movimiento
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onViewMovements(producto);
          }}
        >
          Historial movimientos
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setAnchor(null);
            // Importado bajo demanda: `jspdf`, `qrcode` y `bwip-js` solo hacen
            // falta al descargar el PDF, no al abrir el inventario.
            const { generateProductCodesPDF } =
              await import("@/utils/productCodesPdf");
            await generateProductCodesPDF(
              producto.producto.nombre,
              producto.producto.codigosProducto,
            );
          }}
        >
          Descargar códigos PDF
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete(producto);
          }}
          sx={{ color: "error.main" }}
        >
          Eliminar
        </MenuItem>
      </Menu>
    </>
  );
}

export function InventarioTable({
  productos,
  loading,
  onEdit,
  onChangeQty,
  onViewMovements,
  onCreateMov,
  onDelete,
}: Props) {
  const { tasasVigentes, monedaBase } = useAppContext();

  // Un inventario de 2000 productos ponía 47.000 nodos en el DOM y tardaba
  // segundos en aparecer. Por debajo del umbral se monta entero, que es barato
  // y no cambia nada de la pantalla.
  const virtual = useVirtualRows(productos, {
    minItems: INVENTARIO_VIRTUALIZATION_MIN_ROWS,
    estimateSize: INVENTARIO_ROW_ESTIMATED_HEIGHT,
  });
  const { paddingTop, paddingBottom } = virtual;
  const filasAPintar = virtual.visible.map(({ item, virtual: v }) => ({
    producto: item,
    virtual: v,
  }));

  if (loading) {
    // Seven columns, matching the header below, so the rows slot into place
    // instead of pushing the page down when they arrive.
    return <LoadingState variant="table" columns={7} count={10} />;
  }

  if (productos.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title="No se encontraron productos"
        description="Probá con otro término de búsqueda o quitá los filtros de categoría, stock y vencimiento."
      />
    );
  }

  return (
    // Sin alto fijo: la tabla crece hacia abajo y quien scrollea es la página,
    // como siempre. Un contenedor acotado obligaba a reservar una altura que
    // en móvil desperdicia buena parte de la pantalla.
    <TableContainer ref={virtual.containerRef}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right">Costo</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Rentabilidad</TableCell>
            <TableCell align="center">Vencimiento</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paddingTop > 0 && (
            <TableRow style={{ height: paddingTop }}>
              <TableCell colSpan={COLUMNAS} sx={{ p: 0, border: 0 }} />
            </TableRow>
          )}
          {filasAPintar.map(({ producto: p, virtual: virtualRow }) => {
            const rentabilidad = getRentabilidad(p, tasasVigentes, monedaBase);
            return (
              <TableRow
                key={p.id}
                hover
                {...(virtualRow
                  ? {
                      "data-index": virtualRow.index,
                      ref: virtual.measureElement,
                    }
                  : {})}
              >
                <TableCell>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={0.5}
                    flexWrap="wrap"
                  >
                    <Typography variant="body2" fontWeight={500}>
                      {p.producto.nombre}
                    </Typography>
                    {p.proveedor && (
                      <StatusPill
                        label={`Consig. ${p.proveedor.nombre}`}
                        hue="accent"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {/* Plain text: a filled chip per row turned the category
                      column into a wall of colour that outshouted the product
                      names next to it. The category's own colour is data on the
                      categories screen, not here. */}
                  <Typography variant="body2" color="text.secondary">
                    {p.producto.categoria?.nombre ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    gap={0.5}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStockPill(p.existencia)}
                      <Typography
                        variant="body2"
                        fontWeight={stockTone(p.existencia) ? 700 : 600}
                        sx={{ color: stockTone(p.existencia) }}
                      >
                        {formatNumber(p.existencia)}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatMontoEnMoneda(
                      p.costo,
                      p.monedaCostoCode ?? monedaBase,
                    )}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatMontoEnMoneda(
                      p.precio,
                      p.monedaPrecioCode ?? monedaBase,
                    )}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={
                      parseFloat(rentabilidad) > 0
                        ? "success.main"
                        : "text.secondary"
                    }
                  >
                    {rentabilidad}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {getExpiryChip(p.fechaVencimiento)}
                </TableCell>
                <TableCell align="center">
                  <ActionsMenu
                    producto={p}
                    onEdit={onEdit}
                    onChangeQty={onChangeQty}
                    onViewMovements={onViewMovements}
                    onCreateMov={onCreateMov}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow style={{ height: paddingBottom }}>
              <TableCell colSpan={COLUMNAS} sx={{ p: 0, border: 0 }} />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
