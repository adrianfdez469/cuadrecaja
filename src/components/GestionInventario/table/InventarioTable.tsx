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
import { useState } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { formatCurrency, formatNumber } from "@/utils/formatters";
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
    <TableContainer>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Costo</TableCell>
            <TableCell align="right">Rentabilidad</TableCell>
            <TableCell align="center">Vencimiento</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {productos.map((p) => {
            const rentabilidad = getRentabilidad(p, tasasVigentes, monedaBase);
            return (
              <TableRow key={p.id} hover>
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
                    {formatCurrency(p.precio)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(p.costo)}
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
        </TableBody>
      </Table>
    </TableContainer>
  );
}
