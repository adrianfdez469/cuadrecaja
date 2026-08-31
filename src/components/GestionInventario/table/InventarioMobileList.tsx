"use client";

import {
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useState } from "react";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { IProductoTiendaV2 } from "@/schemas/producto";
import {
  INVENTARIO_CARD_ESTIMATED_HEIGHT,
  INVENTARIO_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/inventario";
import { formatMontoEnMoneda, formatQuantity } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { ActionSheet } from "@/components/ActionSheet";
import { getRentabilidad } from "./rentabilidad";
import {
  getExpiryPill,
  getStockPill,
  rentabilidadColor,
} from "./statusHelpers";

interface Props {
  productos: IProductoTiendaV2[];
  loading: boolean;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
  /** "Detalles" en la hoja "Más acciones" — apagado deja solo nombre,
      categoría e insignias de excepción, sin el grid de abajo. */
  showDetails?: boolean;
}

function ProductCard({
  p,
  onEdit,
  onChangeQty,
  onViewMovements,
  onCreateMov,
  onDelete,
  showDetails = true,
}: {
  p: IProductoTiendaV2;
  onEdit: (p: IProductoTiendaV2) => void;
  onChangeQty: (p: IProductoTiendaV2) => void;
  onViewMovements: (p: IProductoTiendaV2) => void;
  onCreateMov: (p: IProductoTiendaV2) => void;
  onDelete: (p: IProductoTiendaV2) => void;
  showDetails?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { tasasVigentes, monedaBase } = useAppContext();
  const rentabilidad = getRentabilidad(p, tasasVigentes, monedaBase);

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
            <Box
              display="flex"
              alignItems="center"
              gap={0.75}
              flexWrap="wrap"
              mt={0.5}
            >
              <Typography variant="caption" color="text.secondary">
                {p.producto.categoria?.nombre ?? "—"}
              </Typography>
              {p.proveedor && <StatusPill label="Consig." hue="accent" />}
              {getStockPill(p.existencia)}
              {getExpiryPill(p.fechaVencimiento)}
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setSheetOpen(true)}>
            <MoreHorizIcon fontSize="small" />
          </IconButton>
          <ActionSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={p.producto.nombre}
            items={[
              {
                key: "editar",
                icon: <EditIcon fontSize="small" />,
                label: "Editar",
                onClick: () => onEdit(p),
              },
              {
                key: "cambiar-cantidad",
                icon: <AddIcon fontSize="small" />,
                label: "Cambiar cantidad",
                onClick: () => onChangeQty(p),
              },
              {
                key: "registrar-movimiento",
                icon: <SwapHorizIcon fontSize="small" />,
                label: "Registrar movimiento",
                onClick: () => onCreateMov(p),
              },
              {
                key: "historial",
                icon: <HistoryIcon fontSize="small" />,
                label: "Historial movimientos",
                onClick: () => onViewMovements(p),
              },
              {
                key: "codigos-pdf",
                icon: <PictureAsPdfIcon fontSize="small" />,
                label: "Descargar códigos PDF",
                onClick: async () => {
                  // Importado bajo demanda: `jspdf`, `qrcode` y `bwip-js` solo
                  // hacen falta al descargar el PDF, no al abrir el inventario.
                  const { generateProductCodesPDF } =
                    await import("@/utils/productCodesPdf");
                  await generateProductCodesPDF(
                    p.producto.nombre,
                    p.producto.codigosProducto,
                  );
                },
              },
              {
                key: "eliminar",
                icon: <DeleteOutlineIcon fontSize="small" />,
                label: "Eliminar",
                danger: true,
                onClick: () => onDelete(p),
              },
            ]}
          />
        </Box>

        {showDetails && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 0.5,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Stock
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatQuantity(p.existencia)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Costo
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMontoEnMoneda(
                    p.costo,
                    p.monedaCostoCode ?? monedaBase,
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Precio
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatMontoEnMoneda(
                    p.precio,
                    p.monedaPrecioCode ?? monedaBase,
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Rentab.
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={rentabilidadColor(rentabilidad)}
                >
                  {rentabilidad}
                </Typography>
              </Box>
            </Box>
          </>
        )}
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
  showDetails = true,
}: Props) {
  const virtual = useVirtualRows(productos, {
    minItems: INVENTARIO_VIRTUALIZATION_MIN_ROWS,
    estimateSize: INVENTARIO_CARD_ESTIMATED_HEIGHT,
    overscan: 6,
  });

  if (loading) {
    // Cards here, not table rows: this view renders one card per product, and a
    // skeleton that does not match what is coming is just a different spinner.
    return <LoadingState variant="cards" count={6} />;
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
            showDetails={showDetails}
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
            showDetails={showDetails}
          />
        </Box>
      ))}
    </Box>
  );
}
