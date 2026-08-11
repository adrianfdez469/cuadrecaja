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
import { StockAvailabilityBadge } from "./StockAvailabilityBadge";
import { useCartStore } from "@/store/cartStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import { useShowAlternativeCurrencies } from "@/hooks/useShowAlternativeCurrencies";

interface PosProductItemLayoutProps {
  productoTienda: IProductoTiendaV2;
  allProductosTienda: IProductoTiendaV2[];
  onClick?: () => void;
  highlightName?: boolean;
  sx?: SxProps<Theme>;
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
  const { show: showAlternatives } = useShowAlternativeCurrencies();
  const [priceDetailAnchor, setPriceDetailAnchor] =
    useState<HTMLElement | null>(null);
  const cartQty =
    items.find((item) => item.productoTiendaId === productoTienda.id)
      ?.quantity || 0;
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
          (identidad arriba, metadato al lado): las dos tarjetas que ve el
          cajero en la misma venta ya no colocan el mismo dato en lugares
          distintos. La disponibilidad va aquí y no abajo junto al precio
          porque su largo es variable (un número suelto vs "8 · Stock 37") y
          allí decidía si la fila envolvía o no: dos tarjetas vecinas
          quedaban con el precio a distinta altura. El nombre se recorta a
          dos líneas en vez de truncarse: con el sufijo del proveedor, una
          sola línea escondía justo la parte que distingue un producto de
          otro. */}
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        mb={0.75}
      >
        <Typography
          variant="body2"
          fontWeight={highlightName ? 700 : 600}
          sx={{
            minWidth: 0,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {productoTienda.producto.nombre}
        </Typography>

        <StockAvailabilityBadge
          productoTienda={productoTienda}
          allProductosTienda={allProductosTienda}
          cartQty={cartQty}
        />
      </Box>

      {/* Fila 2: cantidad a la izquierda, importe a la derecha — el orden
          de CartItemCard. Los importes alineados a la derecha forman una
          columna legible de arriba abajo, como en un ticket. */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        // Red de seguridad para columnas muy estrechas: el stepper no
        // encoge, así que el precio baja a su propia línea antes que
        // comprimirse — sin esto se quedaba con unos pocos píxeles y
        // `wordBreak` lo partía en una letra por renglón.
        flexWrap="wrap"
        rowGap={0.5}
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

        {/* The popover is the fallback for a card that only shows the base
            price: once the equivalents are on the card itself, tapping the
            price would just repeat what is already there, so it stops being
            a target at all. */}
        <ButtonBase
          onClick={showAlternatives ? undefined : openPriceDetail}
          disableRipple={showAlternatives}
          component={showAlternatives ? "div" : "button"}
          aria-label={
            showAlternatives
              ? undefined
              : `Ver detalle de precio de ${productoTienda.producto.nombre}`
          }
          sx={{
            justifyContent: "flex-end",
            borderRadius: 1.5,
            px: 0.75,
            py: 0.5,
            minHeight: 44,
            cursor: showAlternatives ? "default" : "pointer",
            // Nunca por debajo de su contenido: antes que encogerse tiene
            // que envolver a la línea de abajo. `flexGrow` es para que una
            // vez ahí ocupe el ancho completo y siga alineado a la derecha.
            flexShrink: 0,
            flexGrow: 1,
            maxWidth: "100%",
          }}
        >
          <MultiCurrencyAmount
            amount={priceBase}
            align="right"
            showAlternatives={showAlternatives}
          />
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
