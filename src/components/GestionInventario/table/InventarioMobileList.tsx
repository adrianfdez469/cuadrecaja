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
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { IProductoTiendaV2 } from "@/schemas/producto";
import {
  INVENTARIO_CARD_ESTIMATED_HEIGHT,
  INVENTARIO_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/inventario";
import { formatMontoEnMoneda, formatQuantity } from "@/utils/formatters";
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

function getStockChip(existencia: number) {
  if (existencia <= 0)
    return <Chip label="Sin stock" color="error" size="small" />;
  if (existencia <= 5)
    return <Chip label="Bajo stock" color="warning" size="small" />;
  return <Chip label="En stock" color="success" size="small" />;
}

function getExpiryChip(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return <Chip label="Vencido" color="error" size="small" />;
  if (dias <= 7)
    return <Chip label={`Vence ${dias}d`} color="error" size="small" />;
  if (dias <= 30)
    return <Chip label={`Vence ${dias}d`} color="warning" size="small" />;
  return <Chip label={`Vence ${dias}d`} size="small" />;
}

function ProductCard({
  p,
  onEdit,
  onChangeQty,
  onViewMovements,
  onCreateMov,
  onDelete,
}: {
  p: IProductoTiendaV2;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { tasasVigentes, monedaBase } = useAppContext();
  const rentabilidad = getRentabilidad(p, tasasVigentes, monedaBase);
  const rentColor =
    parseFloat(rentabilidad) > 0 ? "success.main" : "text.secondary";

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box flex={1} mr={1}>
            <Typography variant="subtitle2" fontWeight={700}>
              {p.producto.nombre}
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
              {p.producto.categoria && (
                <Chip
                  label={p.producto.categoria.nombre}
                  size="small"
                  sx={{
                    bgcolor: p.producto.categoria.color,
                    color: "white",
                    fontWeight: 500,
                  }}
                />
              )}
              {p.proveedor && (
                <Chip
                  label={`Consig.`}
                  size="small"
                  variant="outlined"
                  color="secondary"
                />
              )}
              {getStockChip(p.existencia)}
              {getExpiryChip(p.fechaVencimiento)}
            </Box>
          </Box>
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
                onEdit(p);
              }}
            >
              Editar
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onChangeQty(p);
              }}
            >
              Cambiar cantidad
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onCreateMov(p);
              }}
            >
              Registrar movimiento
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onViewMovements(p);
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
                  p.producto.nombre,
                  p.producto.codigosProducto,
                );
              }}
            >
              Descargar códigos PDF
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onDelete(p);
              }}
              sx={{ color: "error.main" }}
            >
              Eliminar
            </MenuItem>
          </Menu>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box display="flex" justifyContent="space-between">
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Stock
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatQuantity(p.existencia)}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Costo
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatMontoEnMoneda(p.costo, p.monedaCostoCode ?? monedaBase)}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Precio
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatMontoEnMoneda(p.precio, p.monedaPrecioCode ?? monedaBase)}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Rentab.
            </Typography>
            <Typography variant="body2" fontWeight={600} color={rentColor}>
              {rentabilidad}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function InventarioMobileList({
  productos,
  loading,
  onEdit,
  onChangeQty,
  onViewMovements,
  onCreateMov,
  onDelete,
}: Props) {
  const virtual = useVirtualRows(productos, {
    minItems: INVENTARIO_VIRTUALIZATION_MIN_ROWS,
    estimateSize: INVENTARIO_CARD_ESTIMATED_HEIGHT,
    overscan: 6,
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (productos.length === 0) {
    return (
      <Box py={4} textAlign="center" minHeight="100dvh">
        <Typography color="text.secondary">
          No se encontraron productos
        </Typography>
      </Box>
    );
  }

  // Con pocas tarjetas, exactamente como antes: montarlas todas es barato y no
  // hay razón para cambiar el comportamiento de la pantalla. Cuando sí toca
  // virtualizar se sale por el otro camino desde el primer render, aunque el
  // contenedor aún no exista: dibujar la lista entera una sola vez ya costaba
  // segundos de hilo principal.
  if (!virtual.needsVirtualization) {
    return (
      <Stack spacing={1} minHeight="100dvh">
        {productos.map((p) => (
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

  // Con muchas, solo las visibles. Sin alto fijo: quien scrollea es la página,
  // así la lista aprovecha toda la pantalla en vez de encerrarse en un
  // recuadro que en móvil desperdicia buena parte del alto. Las tarjetas se
  // posicionan dentro de un contenedor del alto total, que es lo que mantiene
  // la barra de scroll proporcional al catálogo entero.
  return (
    <Box
      ref={virtual.containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: `${virtual.totalSize}px`,
      }}
    >
      {virtual.visible.map(({ item: p, virtual: virtualRow }) => (
        <Box
          key={p.id}
          data-index={virtualRow!.index}
          ref={virtual.measureElement}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            pb: 1,
          }}
          style={{
            transform: `translateY(${virtualRow!.start - virtual.offset}px)`,
          }}
        >
          <ProductCard
            p={p}
            onEdit={onEdit}
            onChangeQty={onChangeQty}
            onViewMovements={onViewMovements}
            onCreateMov={onCreateMov}
            onDelete={onDelete}
          />
        </Box>
      ))}
    </Box>
  );
}
