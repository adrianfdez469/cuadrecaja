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
        p: 1,
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
      {/* Fila 1: nombre, una sola línea */}
      <Typography
        variant="body2"
        fontWeight={highlightName ? 700 : 600}
        noWrap
        sx={{ lineHeight: 1.35, mb: 0.75 }}
      >
        {productoTienda.producto.nombre}
      </Typography>

      {/* Fila 2: precio (toca para ver el detalle en otras monedas) +
          disponibilidad a la izquierda, cantidad a la derecha — antes eran
          dos filas separadas. */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={0.5}
        sx={{
          borderTop: "1px dashed",
          borderColor: "divider",
          pt: 0.75,
        }}
      >
        <ButtonBase
          onClick={openPriceDetail}
          aria-label={`Ver detalle de precio de ${productoTienda.producto.nombre}`}
          sx={{
            flexDirection: "column",
            alignItems: "flex-start",
            borderRadius: 1,
            px: 0.5,
            py: 0.25,
            minHeight: 44,
            minWidth: 0,
          }}
        >
          <MultiCurrencyAmount
            amount={priceBase}
            variant="compact"
            showAlternatives={false}
          />
          <Typography
            variant="caption"
            color={disponibilidad.sinStock ? "error.main" : "text.secondary"}
            noWrap
            sx={{ fontSize: "0.65rem", lineHeight: 1.2 }}
          >
            {disponibilidad.label}
          </Typography>
        </ButtonBase>

        <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
          <ProductQuickActions
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
          />
        </Box>
      </Box>

      <Popover
        open={Boolean(priceDetailAnchor)}
        anchorEl={priceDetailAnchor}
        onClose={closePriceDetail}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
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
