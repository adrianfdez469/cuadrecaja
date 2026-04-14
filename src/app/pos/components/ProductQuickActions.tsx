"use client";

import { Box, IconButton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { useCartStore } from "@/store/cartStore";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";

interface ProductQuickActionsProps {
  productoTienda: IProductoTiendaV2;
  allProductosTienda: IProductoTiendaV2[];
  onStopPropagation?: (e: React.MouseEvent) => void;
}

/**
 * Controles rápidos +/- para agregar/decrementar cantidad en el carrito.
 * Sincronizado en tiempo real con el carrito y respeta stock/disponibilidad.
 */
export function ProductQuickActions({
  productoTienda,
  allProductosTienda,
  onStopPropagation,
}: ProductQuickActionsProps) {
  const { items, addToCart, updateQuantity, removeFromCart } = useCartStore();

  const getCartQuantity = (productoTiendaId: string) => {
    return items.find((item) => item.productoTiendaId === productoTiendaId)?.quantity || 0;
  };

  const getMaxDisponible = () => {
    const { maxPorTransaccion } = calcularDisponibilidadReal(productoTienda, allProductosTienda);
    const cartQty = getCartQuantity(productoTienda.id);
    return Math.max(0, maxPorTransaccion - cartQty);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPropagation?.(e);
    const { maxPorTransaccion } = calcularDisponibilidadReal(productoTienda, allProductosTienda);
    const cartQty = getCartQuantity(productoTienda.id);
    const disponible = maxPorTransaccion - cartQty;
    const permiteDecimal = productoTienda.producto?.permiteDecimal;
    const incremento = permiteDecimal ? 0.1 : 1;
    if (disponible >= incremento) {
      addToCart(
        {
          id: productoTienda.id,
          name: productoTienda.producto.nombre,
          price: productoTienda.precio,
          productoTiendaId: productoTienda.id,
          fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        },
        incremento
      );
    }
  };

  const handleQuickDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPropagation?.(e);
    const item = items.find((i) => i.productoTiendaId === productoTienda.id);
    if (!item) return;
    const permiteDecimal = productoTienda.producto?.permiteDecimal;
    const decremento = permiteDecimal ? 0.1 : 1;
    const nuevaCantidad = Math.round((item.quantity - decremento) * 100) / 100;
    if (nuevaCantidad <= 0) {
      removeFromCart(productoTienda.id);
    } else {
      updateQuantity(productoTienda.id, nuevaCantidad);
    }
  };

  const cartQuantity = getCartQuantity(productoTienda.id);
  const maxDisponible = getMaxDisponible();
  const incrementoMin = productoTienda.producto?.permiteDecimal ? 0.1 : 1;
  const canAdd = maxDisponible >= incrementoMin;

  return (
    <Box
      role="group"
      aria-label={`Cantidad de ${productoTienda.producto.nombre} en carrito`}
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      gap={0.25}
      onClick={(e) => {
        e.stopPropagation();
        onStopPropagation?.(e);
      }}
    >
      <IconButton
        size="small"
        onClick={handleQuickDecrement}
        disabled={cartQuantity <= 0}
        aria-label={`Quitar uno de ${productoTienda.producto.nombre}`}
        sx={{
          minWidth: { xs: 44, sm: 36 },
          minHeight: { xs: 44, sm: 36 },
          bgcolor: "action.hover",
          "&:hover": { bgcolor: "action.selected" },
          "&:disabled": { opacity: 0.5 },
        }}
      >
        <RemoveIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
      </IconButton>
      <Typography
        variant="body2"
        sx={{
          minWidth: 24,
          textAlign: "center",
          fontWeight: 600,
          fontSize: { xs: "0.875rem", sm: "1rem" },
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        {productoTienda.producto?.permiteDecimal ? cartQuantity.toFixed(1) : cartQuantity}
      </Typography>
      <IconButton
        size="small"
        onClick={handleQuickAdd}
        disabled={!canAdd}
        aria-label={`Agregar uno de ${productoTienda.producto.nombre} al carrito`}
        sx={{
          minWidth: { xs: 44, sm: 36 },
          minHeight: { xs: 44, sm: 36 },
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "&:hover": {
            bgcolor: "primary.dark",
            color: "primary.contrastText",
          },
          "&:disabled": {
            bgcolor: "action.disabledBackground",
            color: "action.disabled",
          },
        }}
      >
        <AddIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
      </IconButton>
    </Box>
  );
}
