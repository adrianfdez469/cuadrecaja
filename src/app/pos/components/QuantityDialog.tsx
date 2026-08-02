"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Dialog, Typography } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { useCartStore } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import { QuantityStepper } from "./QuantityStepper";
import { ProductAvatarPlaceholder } from "./ProductAvatarPlaceholder";

interface QuantityDialogProps {
  productoTienda: IProductoTiendaV2 | null;
  onClose: () => void;
  onConfirm: () => void;
  onAddToCart?: () => void; // Nueva prop para callback después de agregar al carrito
  maxDisponibleOverride?: number; // Máximo disponible calculado externamente (considera stock del padre para fracciones)
}

export const QuantityDialog = ({
  productoTienda,
  onClose,
  onConfirm,
  onAddToCart,
  maxDisponibleOverride,
}: QuantityDialogProps) => {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, items } = useCartStore();
  const { tasasVigentes, monedaBase } = useAppContext();
  const [isDecimalInput, setIsDecimalInput] = useState(false);

  const getInitialMaxQuantity = useCallback((): number => {
    if (!productoTienda) return 0;

    const cartQuantity =
      items.find((item) => item.id === productoTienda.id)?.quantity || 0;

    if (
      typeof maxDisponibleOverride === "number" &&
      maxDisponibleOverride >= 0
    ) {
      return Math.max(0, maxDisponibleOverride - cartQuantity);
    }

    const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
    const existencia = productoTienda.existencia || 0;

    if (unidadesPorFraccion && unidadesPorFraccion > 0) {
      return Math.max(0, unidadesPorFraccion - 1 - cartQuantity);
    } else {
      return Math.max(0, existencia - cartQuantity);
    }
  }, [productoTienda, items, maxDisponibleOverride]);

  useEffect(() => {
    setIsDecimalInput(productoTienda?.producto?.permiteDecimal || false);

    const maxDisponible = getInitialMaxQuantity();
    const minValue = productoTienda?.producto?.permiteDecimal ? 0.1 : 1;
    setQuantity(maxDisponible >= minValue ? minValue : 0);
  }, [productoTienda, getInitialMaxQuantity]);

  const getMaxQuantity = useCallback(
    (decrementForPrecision: number = 0): number => {
      if (!productoTienda) return 0;

      const cartQuantity =
        items.find((item) => item.id === productoTienda.id)?.quantity || 0;

      if (
        typeof maxDisponibleOverride === "number" &&
        maxDisponibleOverride >= 0
      ) {
        return Math.max(
          0,
          maxDisponibleOverride - cartQuantity - decrementForPrecision,
        );
      }

      const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
      const existencia = productoTienda.existencia || 0;

      if (unidadesPorFraccion && unidadesPorFraccion > 0) {
        return Math.max(
          0,
          unidadesPorFraccion - 1 - cartQuantity - decrementForPrecision,
        );
      } else {
        return Math.max(0, existencia - cartQuantity - decrementForPrecision);
      }
    },
    [productoTienda, items, maxDisponibleOverride],
  );

  const getMaxForDisplay = useCallback((): number => {
    if (!productoTienda) return 0;

    const cartQuantity =
      items.find((item) => item.id === productoTienda.id)?.quantity || 0;

    if (
      typeof maxDisponibleOverride === "number" &&
      maxDisponibleOverride >= 0
    ) {
      return Math.max(0, maxDisponibleOverride - cartQuantity);
    }

    const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
    const existencia = productoTienda.existencia || 0;

    if (unidadesPorFraccion && unidadesPorFraccion > 0) {
      return Math.max(0, unidadesPorFraccion - 1 - cartQuantity);
    } else {
      return Math.max(0, existencia - cartQuantity);
    }
  }, [productoTienda, items, maxDisponibleOverride]);

  const handleConfirmQuantity = () => {
    const maxDisponible = getMaxForDisplay();
    if (
      !productoTienda ||
      quantity <= 0 ||
      quantity > maxDisponible ||
      maxDisponible <= 0
    ) {
      return;
    }

    addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: convertToBase(
          productoTienda.precio,
          productoTienda.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        ),
      },
      quantity,
    );
    onClose();
    if (onAddToCart) {
      onAddToCart();
    }
  };

  const handlePayAll = () => {
    const maxDisponible = getMaxForDisplay();
    if (
      !productoTienda ||
      quantity <= 0 ||
      quantity > maxDisponible ||
      maxDisponible <= 0
    ) {
      return;
    }

    addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: convertToBase(
          productoTienda.precio,
          productoTienda.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        ),
      },
      quantity,
    );
    onConfirm();
    if (onAddToCart) {
      onAddToCart();
    }
  };

  const maxForDisplay = getMaxForDisplay();
  const hasStock = maxForDisplay > 0;
  const minQuantity = isDecimalInput ? 0.01 : 1;
  const stockReferenceValue = productoTienda
    ? Math.max(
        productoTienda.existencia || 0,
        productoTienda.producto?.unidadesPorFraccion || 0,
      )
    : 0;

  return (
    <Dialog open={Boolean(productoTienda)} onClose={onClose}>
      {productoTienda && (
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={1}
        >
          <ProductAvatarPlaceholder />

          <Typography variant="h6" textAlign="center">
            {productoTienda.producto.nombre}
          </Typography>

          <Box sx={{ textAlign: "center", width: "100%", px: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25 }}
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
              align="center"
              sx={{ width: "100%" }}
            />
          </Box>

          {hasStock ? (
            <Typography variant="body2" color="text.secondary">
              {productoTienda.producto.unidadesPorFraccion
                ? `Stock: ${Math.max(0, productoTienda.existencia || 0)} | Máx. por venta: ${maxForDisplay}`
                : `Disponibles: ${maxForDisplay}`}
            </Typography>
          ) : (
            <Typography variant="body2" color="error.main">
              Sin stock disponible
            </Typography>
          )}

          {hasStock && (
            <Button
              size="small"
              onClick={() => setQuantity(maxForDisplay)}
              sx={{ minHeight: 0, py: 0 }}
            >
              Usar máximo
            </Button>
          )}

          <Box sx={{ width: "100%", mt: 1 }}>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={minQuantity}
              max={maxForDisplay}
              allowDecimal={isDecimalInput}
              showBulkChip10={stockReferenceValue >= 10}
              showBulkChip50={stockReferenceValue >= 50}
              showBulkChip100={stockReferenceValue >= 100}
              disabled={!hasStock}
            />
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleConfirmQuantity}
            disabled={
              quantity <= 0 ||
              quantity > getMaxQuantity() ||
              maxForDisplay <= 0
            }
            sx={{ mt: 2 }}
          >
            Agregar al Carrito
          </Button>

          <Box sx={{ width: "100%", mt: 2 }}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              onClick={handlePayAll}
              disabled={
                quantity <= 0 ||
                quantity > getMaxQuantity() ||
                maxForDisplay <= 0
              }
            >
              Venta Rápida
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              textAlign="center"
              sx={{ mt: 0.5 }}
            >
              Agrega y pasa directo a cobrar
            </Typography>
          </Box>
        </Box>
      )}
    </Dialog>
  );
};
