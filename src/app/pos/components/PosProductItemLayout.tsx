"use client";

import { Box, Paper, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { ProductQuickActions } from "./ProductQuickActions";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";
import { useCartStore } from "@/store/cartStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";

const sectionLabelSx = {
  mb: 0.25,
  fontSize: "0.65rem",
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
};

interface PosProductItemLayoutProps {
  productoTienda: IProductoTiendaV2;
  allProductosTienda: IProductoTiendaV2[];
  onClick?: () => void;
  showDescription?: boolean;
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
      primary: `Máx: ${disponible}`,
      secondary: `Stock: ${existenciaReal}`,
      sinStock: disponible === 0,
    };
  }

  return {
    primary: `Cant: ${disponible}`,
    secondary: null,
    sinStock: disponible === 0,
  };
}

export function PosProductItemLayout({
  productoTienda,
  allProductosTienda,
  onClick,
  showDescription = false,
  highlightName = false,
  sx,
}: PosProductItemLayoutProps) {
  const { items } = useCartStore();
  const { tasasVigentes, monedaBase } = useAppContext();
  const cartQty =
    items.find((item) => item.productoTiendaId === productoTienda.id)
      ?.quantity || 0;
  const disponibilidad = getDisponibilidadInfo(
    productoTienda,
    allProductosTienda,
    cartQty,
  );

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
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
      {/* Fila 1: nombre */}
      <Box
        mb={showDescription && productoTienda.producto.descripcion ? 0.5 : 1}
      >
        <Typography
          variant="body2"
          fontWeight={highlightName ? 700 : 600}
          sx={{
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {productoTienda.producto.nombre}
        </Typography>
        {showDescription && productoTienda.producto.descripcion && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 0.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
            }}
          >
            {productoTienda.producto.descripcion}
          </Typography>
        )}
      </Box>

      {/* Fila 2: precio | disponibilidad */}
      <Box
        display="grid"
        gridTemplateColumns="1fr 1fr"
        gap={1}
        mb={1.25}
        sx={{
          borderTop: "1px dashed",
          borderColor: "divider",
          pt: 1,
        }}
      >
        <Box minWidth={0} sx={{ overflow: "hidden" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={sectionLabelSx}
          >
            Precio
          </Typography>
          <MultiCurrencyAmount
            amount={convertToBase(
              productoTienda.precio,
              productoTienda.monedaPrecioCode ?? monedaBase,
              tasasVigentes,
              monedaBase,
            )}
            variant="compact"
          />
        </Box>

        <Box minWidth={0} sx={{ overflow: "hidden" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            align="right"
            sx={sectionLabelSx}
          >
            Disponible
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            align="right"
            color={disponibilidad.sinStock ? "error.main" : "text.primary"}
            sx={{ lineHeight: 1.35 }}
          >
            {disponibilidad.primary}
          </Typography>
          {disponibilidad.secondary && (
            <Typography
              variant="caption"
              color="text.secondary"
              align="right"
              display="block"
            >
              {disponibilidad.secondary}
            </Typography>
          )}
          {cartQty > 0 && (
            <Typography
              variant="caption"
              color="primary.main"
              align="right"
              display="block"
              fontWeight={600}
              sx={{ mt: 0.25 }}
            >
              En carrito:{" "}
              {productoTienda.producto?.permiteDecimal
                ? cartQty.toFixed(1)
                : cartQty}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Fila 3: acciones rápidas centradas (no propagan el click de la card) */}
      <Box
        display="flex"
        justifyContent="center"
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 200,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ProductQuickActions
            productoTienda={productoTienda}
            allProductosTienda={allProductosTienda}
            centered
          />
        </Box>
      </Box>
    </Paper>
  );
}
