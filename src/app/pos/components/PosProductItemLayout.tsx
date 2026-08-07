"use client";

import { useState, MouseEvent } from "react";
import {
  Box,
  ButtonBase,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { ProductQuickActions } from "./ProductQuickActions";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";
import { useCartStore } from "@/store/cartStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";

interface PosProductItemLayoutProps {
  productoTienda: IProductoTiendaV2;
  allProductosTienda: IProductoTiendaV2[];
  onClick?: () => void;
  highlightName?: boolean;
  sx?: SxProps<Theme>;
}

function getDisponibilidadInfo(
  productoTienda: IProductoTiendaV2,
  allProductosTienda: IProductoTiendaV2[],
  cartQty: number,
) {
  const { maxPorTransaccion, esFraccion } = calcularDisponibilidadReal(
    productoTienda,
    allProductosTienda,
  );
  const disponible = Math.max(0, maxPorTransaccion - cartQty);

  if (esFraccion) {
    const existenciaReal = Math.max(0, productoTienda.existencia || 0);
    return {
      label: `Disp: ${disponible} · Stock: ${existenciaReal}`,
      sinStock: disponible === 0,
    };
  }

  return {
    label: `Disp: ${disponible}`,
    sinStock: disponible === 0,
  };
}

export function PosProductItemLayout({
  productoTienda,
  allProductosTienda,
  onClick,
  highlightName = false,
  sx,
}: PosProductItemLayoutProps) {
  const { items } = useCartStore();
  const { tasasVigentes, monedaBase } = useAppContext();
  const [priceDetailAnchor, setPriceDetailAnchor] =
    useState<HTMLElement | null>(null);
  const cartQty =
    items.find((item) => item.productoTiendaId === productoTienda.id)
      ?.quantity || 0;
  const disponibilidad = getDisponibilidadInfo(
    productoTienda,
    allProductosTienda,
    cartQty,
  );
  const priceBase = convertToBase(
    productoTienda.precio,
    productoTienda.monedaPrecioCode ?? monedaBase,
    tasasVigentes,
    monedaBase,
  );

  const openPriceDetail = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setPriceDetailAnchor(e.currentTarget);
  };
  const closePriceDetail = () => setPriceDetailAnchor(null);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: { xs: 1, sm: 1.25 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        overflow: "hidden",
        ...(onClick && {
          cursor: "pointer",
          transition: "background-color 0.15s ease",
          "&:hover": { bgcolor: "action.hover" },
          "&:active": { bgcolor: "action.selected" },
        }),
        ...sx,
      }}
    >
      {/* Fila 1: nombre + disponibilidad. Mismo esquema que CartItemCard
          (identidad arriba, metadato debajo del nombre): las dos tarjetas
          que ve el cajero en la misma venta ya no colocan el mismo dato en
          lugares distintos. El nombre se recorta a dos líneas en vez de
          truncarse: con el sufijo del proveedor, una sola línea escondía
          justo la parte que distingue un producto de otro. */}
      <Typography
        variant="body2"
        fontWeight={highlightName ? 700 : 600}
        sx={{
          mb: 0.5,
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {productoTienda.producto.nombre}
      </Typography>

      {/* Fila 2: cantidad a la izquierda, importe a la derecha — el orden
          de CartItemCard. Los importes alineados a la derecha forman una
          columna legible de arriba abajo, como en un ticket. */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          // Ajustar cantidades no debe quitarle el foco al buscador: sin
          // esto, cada producto agregado cerraba el teclado a media venta.
          // Va solo sobre estos controles y no sobre la tarjeta entera, para
          // que tocar cualquier otro sitio sí cierre la búsqueda.
          onMouseDown={(e) => e.preventDefault()}
          sx={{ flexShrink: 0 }}
        >
          <ProductQuickActions
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
          />
        </Box>

        {/* Disponibilidad apilada sobre el precio, no en una línea propia
            bajo el nombre: es el mismo dato en el mismo sitio y ahorra una
            fila entera de alto por tarjeta. */}
        <ButtonBase
          onClick={openPriceDetail}
          aria-label={`Ver detalle de precio de ${productoTienda.producto.nombre}`}
          sx={{
            flexDirection: "column",
            alignItems: "flex-end",
            borderRadius: 1.5,
            px: 0.75,
            py: 0.25,
            minHeight: 44,
            minWidth: 0,
          }}
        >
          <Typography
            variant="caption"
            color={disponibilidad.sinStock ? "error.main" : "text.secondary"}
            noWrap
            sx={{ fontSize: "0.7rem", lineHeight: 1.3 }}
          >
            {disponibilidad.label}
          </Typography>
          <MultiCurrencyAmount amount={priceBase} showAlternatives={false} />
        </ButtonBase>
      </Box>

      <Popover
        open={Boolean(priceDetailAnchor)}
        anchorEl={priceDetailAnchor}
        onClose={closePriceDetail}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Stack gap={1} sx={{ p: 1.5, minWidth: 200 }}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{
                mb: 0.25,
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Precio
            </Typography>
            <MultiCurrencyAmount amount={priceBase} variant="compact" />
          </Box>
        </Stack>
      </Popover>
    </Paper>
  );
}
