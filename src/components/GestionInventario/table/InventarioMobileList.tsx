"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useState } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { formatCurrency, formatNumber } from "@/utils/formatters";

interface Props {
  productos: IProductoTiendaV2[];
  loading: boolean;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
}

function getStockChip(existencia: number) {
  if (existencia <= 0) return <Chip label="Sin stock" color="error" size="small" />;
  if (existencia <= 5) return <Chip label="Bajo stock" color="warning" size="small" />;
  return <Chip label="En stock" color="success" size="small" />;
}

function getExpiryChip(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil((new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (dias <= 0) return <Chip label="Vencido" color="error" size="small" />;
  if (dias <= 7) return <Chip label={`Vence ${dias}d`} color="error" size="small" />;
  if (dias <= 30) return <Chip label={`Vence ${dias}d`} color="warning" size="small" />;
  return <Chip label={`Vence ${dias}d`} size="small" />;
}

function getRentabilidad(precio: number, costo: number): string {
  if (!precio || !costo) return "—";
  return `${(((precio - costo) / costo) * 100).toFixed(1)}%`;
}

function ProductCard({ p, onEdit, onChangeQty, onViewMovements, onCreateMov, onDelete }: {
  p: IProductoTiendaV2;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const rentabilidad = getRentabilidad(p.precio, p.costo);
  const rentColor = parseFloat(rentabilidad) > 0 ? "success.main" : "text.secondary";

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} mr={1}>
            <Typography variant="subtitle2" fontWeight={700}>{p.producto.nombre}</Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
              {p.producto.categoria && (
                <Chip
                  label={p.producto.categoria.nombre}
                  size="small"
                  sx={{ bgcolor: p.producto.categoria.color, color: "white", fontWeight: 500 }}
                />
              )}
              {p.proveedor && (
                <Chip label={`Consig.`} size="small" variant="outlined" color="secondary" />
              )}
              {getStockChip(p.existencia)}
              {getExpiryChip(p.fechaVencimiento)}
            </Box>
          </Box>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem onClick={() => { setAnchor(null); onEdit(p); }}>Editar</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); onChangeQty(p); }}>Cambiar cantidad</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); onViewMovements(p); }}>Historial movimientos</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); onCreateMov(p); }}>Registrar movimiento</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); onDelete(p); }} sx={{ color: "error.main" }}>Eliminar</MenuItem>
          </Menu>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box display="flex" justifyContent="space-between">
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Stock</Typography>
            <Typography variant="body2" fontWeight={600}>{formatNumber(p.existencia)}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Precio</Typography>
            <Typography variant="body2" fontWeight={600}>{formatCurrency(p.precio)}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Costo</Typography>
            <Typography variant="body2" fontWeight={600}>{formatCurrency(p.costo)}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Rentab.</Typography>
            <Typography variant="body2" fontWeight={600} color={rentColor}>{rentabilidad}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function InventarioMobileList({ productos, loading, onEdit, onChangeQty, onViewMovements, onCreateMov, onDelete }: Props) {
  if (loading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  if (productos.length === 0) {
    return (
      <Box py={4} textAlign="center">
        <Typography color="text.secondary">No se encontraron productos</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      {productos.map(p => (
        <ProductCard
          key={p.id}
          p={p}
          onEdit={onEdit}
          onChangeQty={onChangeQty}
          onViewMovements={onViewMovements}
          onCreateMov={onCreateMov}
          onDelete={onDelete}
        />
      ))}
    </Stack>
  );
}
