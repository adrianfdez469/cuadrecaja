"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Dialog, Typography } from "@mui/material";
import { IProductoTiendaPos } from "@/schemas/producto";
import { useCartStore } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import { QuantityStepper } from "./QuantityStepper";
import { formatQuantity } from "@/utils/formatters";
import { clampQuantity } from "@/utils/quantityInput";

interface QuantityDialogProps {
  productoTienda: IProductoTiendaPos | null;
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
  // Derived directly from the prop during render (not via useEffect/useState)
  // so it's never one render behind when productoTienda changes — a stale
  // value here fed QuantityStepper's initial activeStep with the wrong
  // allowDecimal on the very render that mounts it.
  const isDecimalInput = productoTienda?.producto?.permiteDecimal ?? false;

  /**
   * Cuánto se puede agregar todavía.
   *
   * Era el mismo cálculo escrito tres veces —una para el valor inicial, otra
   * para validar y otra para mostrar— y las tres topaban las fracciones en
   * `unidadesPorFraccion - 1`. Ese tope ya no existe: quien llama pasa
   * `maxDisponibleOverride` con la disponibilidad real (incluye lo que hay
   * dentro de los padres sin abrir) y, si no lo pasa, queda la existencia
   * del producto, que es todo lo que se puede afirmar sin la lista completa
   * de productos de la tienda.
   */
  const getMaxQuantity = useCallback(
    (decrementForPrecision: number = 0): number => {
      if (!productoTienda) return 0;

      const cartQuantity =
        items.find((item) => item.id === productoTienda.id)?.quantity || 0;
      const disponible =
        typeof maxDisponibleOverride === "number" && maxDisponibleOverride >= 0
          ? maxDisponibleOverride
          : Math.max(0, productoTienda.existencia || 0);

      return Math.max(0, disponible - cartQuantity - decrementForPrecision);
    },
    [productoTienda, items, maxDisponibleOverride],
  );

  useEffect(() => {
    const maxDisponible = getMaxQuantity();
    const minValue = productoTienda?.producto?.permiteDecimal ? 0.1 : 1;
    setQuantity(maxDisponible >= minValue ? minValue : 0);
  }, [productoTienda, getMaxQuantity]);

  const handleConfirmQuantity = () => {
    const maxDisponible = getMaxQuantity();
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
    const maxDisponible = getMaxQuantity();
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

  const maxForDisplay = getMaxQuantity();
  const hasStock = maxForDisplay > 0;
  const minQuantity = isDecimalInput ? 0.01 : 1;
  // Los atajos de 10/50/100 se ofrecen contra lo que realmente se puede
  // vender. Antes se comparaba también con `unidadesPorFraccion` para que las
  // fracciones no se quedaran sin atajos por culpa del tope de una caja.
  const stockReferenceValue = maxForDisplay;

  return (
    <Dialog
      open={Boolean(productoTienda)}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
    >
      {productoTienda && (
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={1}
        >
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

          {/* Un solo número también aquí: "Máx. por venta" solo tenía sentido
              cuando una fracción no podía pasar de una caja. */}
          {hasStock ? (
            <Typography variant="body2" color="text.secondary">
              {`Disponibles: ${formatQuantity(maxForDisplay)}`}
            </Typography>
          ) : (
            <Typography variant="body2" color="error.main">
              Sin stock disponible
            </Typography>
          )}

          {hasStock && (
            <Button
              size="small"
              onClick={() =>
                setQuantity(
                  clampQuantity(
                    maxForDisplay,
                    minQuantity,
                    maxForDisplay,
                    isDecimalInput,
                  ),
                )
              }
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
              quantity <= 0 || quantity > getMaxQuantity() || maxForDisplay <= 0
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
