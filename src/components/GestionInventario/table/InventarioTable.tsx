"use client";

import {
  Box,
  Chip,
  CircularProgress,
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
import { useCallback, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IProductoTiendaV2 } from "@/schemas/producto";
import {
  INVENTARIO_ROW_ESTIMATED_HEIGHT,
  INVENTARIO_TABLE_COLUMNS as COLUMNAS,
  INVENTARIO_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/inventario";
import { formatMontoEnMoneda, formatNumber } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";
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
  if (dias <= 0) return <Chip label="Vencido" color="error" size="small" />;
  if (dias <= 7) return <Chip label={`${dias}d`} color="error" size="small" />;
  if (dias <= 30)
    return <Chip label={`${dias}d`} color="warning" size="small" />;
  return <Chip label={`${dias}d`} size="small" />;
}

function getStockChip(existencia: number) {
  if (existencia <= 0)
    return <Chip label="Sin stock" color="error" size="small" />;
  if (existencia <= 5)
    return <Chip label="Bajo" color="warning" size="small" />;
  return <Chip label="En stock" color="success" size="small" />;
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setScrollEl(el);
  }, []);

  // Por encima del umbral solo se pintan las filas visibles. Un inventario de
  // 2000 productos ponía 47.000 nodos en el DOM y tardaba segundos en aparecer;
  // por debajo, montarlo entero es barato y no merece la pena cambiar nada.
  const necesitaVirtualizar =
    productos.length >= INVENTARIO_VIRTUALIZATION_MIN_ROWS;
  const virtualizar = necesitaVirtualizar && scrollEl !== null;

  const rowVirtualizer = useVirtualizer({
    count: virtualizar ? productos.length : 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => INVENTARIO_ROW_ESTIMATED_HEIGHT,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  // Dos filas vacías sostienen el alto que ocupan las que no se pintan. Es lo
  // que permite virtualizar sin romper la tabla: las celdas siguen siendo
  // celdas, así que las columnas se alinean y la cabecera fija sigue
  // funcionando, cosa que no ocurre posicionando filas en absoluto.
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  // Cuando toca virtualizar y el contenedor todavía no está montado no se
  // pinta nada, ni siquiera una vez. Esa salvedad es el punto entero: dejar
  // que el primer render dibujara la lista completa costaba 6,4 segundos de
  // hilo principal antes de que la virtualización llegara a entrar.
  const filasAPintar = necesitaVirtualizar
    ? virtualizar
      ? virtualRows.map((v) => ({ producto: productos[v.index], virtual: v }))
      : []
    : productos.map((producto) => ({ producto, virtual: null }));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (productos.length === 0) {
    return (
      <Box py={4} textAlign="center">
        <Typography color="text.secondary">
          No se encontraron productos
        </Typography>
      </Box>
    );
  }

  return (
    // Con muchas filas el contenedor pasa a tener su propio scroll: es lo que
    // el virtualizador necesita medir, y de paso deja la cabecera fija a la
    // vista en vez de perderse al desplazar la página. Con pocas filas se
    // comporta exactamente como antes.
    <TableContainer
      ref={containerRef}
      sx={
        necesitaVirtualizar
          ? { maxHeight: "70vh", overflowY: "auto" }
          : undefined
      }
    >
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
          {filasAPintar.map(({ producto: p, virtual }) => {
            const rentabilidad = getRentabilidad(p, tasasVigentes, monedaBase);
            return (
              <TableRow
                key={p.id}
                hover
                {...(virtual
                  ? {
                      "data-index": virtual.index,
                      ref: rowVirtualizer.measureElement,
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
                      <Chip
                        label={`Consig. ${p.proveedor.nombre}`}
                        size="small"
                        variant="outlined"
                        color="secondary"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {p.producto.categoria ? (
                    <Chip
                      label={p.producto.categoria.nombre}
                      size="small"
                      sx={{
                        bgcolor: p.producto.categoria.color,
                        color: "white",
                        fontWeight: 500,
                      }}
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    gap={0.5}
                  >
                    <Typography variant="body2">
                      {formatNumber(p.existencia)}
                    </Typography>
                    {getStockChip(p.existencia)}
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
