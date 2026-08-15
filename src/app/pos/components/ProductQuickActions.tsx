"use client";

import { memo, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { IProductoTiendaPos } from "@/schemas/producto";
import { useCartItemQuantity, useCartStore } from "@/store/cartStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import SelectableTextField from "@/components/SelectableTextField";
import { formatQuantity } from "@/utils/formatters";
import {
  clampQuantity,
  parseQuantityText,
  sanitizeQuantityDraft,
} from "@/app/pos/utils/quantityInput";

// Hoisted out of the render: this component is mounted once per product card,
// and an inline object would make Emotion re-serialize every one of these —
// several of them responsive, which costs multiple times a flat rule — on
// every render of the grid.
const ROOT_SX = {
  flexShrink: 0,
  bgcolor: "action.hover",
  borderRadius: 2,
  px: 0.5,
  py: 0.25,
} as const;
const STEP_BUTTON_SX = {
  minWidth: { xs: 44, sm: 36 },
  minHeight: { xs: 44, sm: 36 },
  "&:disabled": { opacity: 0.5 },
} as const;
const ADD_BUTTON_SX = {
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
} as const;
const STEP_ICON_SX = { fontSize: { xs: 18, sm: 20 } } as const;
const QUANTITY_SLOT_SX = {
  // Más ancho que la cifra del stepper del carrito porque aquí además es un
  // campo de escritura: con productos decimales el valor llega a "12.50" y a
  // 44px se recortaba al teclear.
  width: 60,
  minWidth: 60,
  minHeight: { xs: 44, sm: 36 },
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "text",
} as const;
const QUANTITY_FIELD_SX = { width: "100%", minWidth: 0 } as const;
const QUANTITY_TEXT_SX = {
  width: "100%",
  textAlign: "center",
  fontWeight: 600,
  fontSize: { xs: "1rem", sm: "1.125rem" },
} as const;
const QUANTITY_INPUT_STYLE = {
  textAlign: "center",
  fontWeight: 600,
  fontSize: "1.125rem",
  padding: 0,
} as const;

interface ProductQuickActionsProps {
  productoTienda: IProductoTiendaPos;
  /**
   * Sellable units before the cart is deducted, precomputed by
   * `buildProductIndex`. Taking the number instead of the whole catalog is
   * what stops every stepper in the grid from scanning it on every render.
   */
  disponible: number;
  onStopPropagation?: (e: React.MouseEvent) => void;
}

/**
 * Controles rápidos de cantidad en el carrito: +/-1 y el número tocable
 * para escribir una cantidad exacta directamente, sin abrir ningún modal.
 * Sincronizado en tiempo real con el carrito y respeta stock/disponibilidad.
 */
function ProductQuickActionsComponent({
  productoTienda,
  disponible,
  onStopPropagation,
}: ProductQuickActionsProps) {
  // Only this product's quantity, not the whole store: subscribing to the
  // full state made every card in the grid re-render on any cart mutation.
  // The actions are read through `getState()` inside the handlers instead of
  // being selected, so this component does not subscribe to them at all.
  const cartQuantity = useCartItemQuantity(productoTienda.id);
  const { tasasVigentes, monedaBase } = useAppContext();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");

  const allowDecimal = Boolean(productoTienda.producto?.permiteDecimal);

  const getMaxDisponible = () => Math.max(0, disponible - cartQuantity);

  const buildCartLine = () => ({
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
  });

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPropagation?.(e);
    if (getMaxDisponible() >= 1) {
      useCartStore.getState().addToCart(buildCartLine(), 1);
    }
  };

  const handleQuickDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPropagation?.(e);
    if (cartQuantity <= 0) return;
    const nuevaCantidad = Math.round((cartQuantity - 1) * 100) / 100;
    const { removeFromCart, updateQuantity } = useCartStore.getState();
    if (nuevaCantidad <= 0) {
      removeFromCart(productoTienda.id);
    } else {
      updateQuantity(productoTienda.id, nuevaCantidad);
    }
  };

  const maxDisponible = getMaxDisponible();
  const canAdd = maxDisponible >= 1;

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStopPropagation?.(e);
    // La cantidad del carrito hereda el tope disponible, que puede traer
    // ruido de coma flotante; el borrador arranca ya recortado a 2 decimales.
    setDraftText(cartQuantity > 0 ? formatQuantity(cartQuantity) : "");
    setEditing(true);
  };

  // Aplica la cantidad al carrito de inmediato — se llama en cada tecleo
  // válido, no solo al perder foco. En móvil el teclado numérico no
  // siempre tiene una tecla "Enter"/"Listo", así que depender del blur
  // para confirmar deja la edición atascada; el cambio debe verse al
  // instante, sin requerir tocar afuera.
  // Devuelve la cantidad efectivamente aplicada (ya limitada al máximo
  // disponible), para que quien la llama pueda reflejarla en el texto
  // visible cuando el tope obligó a bajarla.
  const applyQuantity = (value: number): number => {
    // Read live rather than from the render: this fires on every keystroke,
    // and two of them within the same render pass would both see the old
    // quantity and add the line twice instead of updating it.
    const store = useCartStore.getState();
    const currentQuantity =
      store.items.find((item) => item.productoTiendaId === productoTienda.id)
        ?.quantity ?? 0;

    if (value <= 0) {
      if (currentQuantity > 0) store.removeFromCart(productoTienda.id);
      return 0;
    }

    const clamped = clampQuantity(
      value,
      allowDecimal ? 0.01 : 1,
      disponible,
      allowDecimal,
    );

    if (currentQuantity > 0) {
      store.updateQuantity(productoTienda.id, clamped);
    } else if (clamped > 0) {
      store.addToCart(buildCartLine(), clamped);
    }
    return clamped;
  };

  const handleDraftChange = (text: string) => {
    // Limita a 2 decimales visualmente mientras se escribe (no solo al
    // aplicar) — ninguna card de cantidad debe mostrar más de 2 lugares
    // después de la coma/punto.
    const cleaned = sanitizeQuantityDraft(text, allowDecimal);
    const parsed = parseQuantityText(cleaned, allowDecimal);

    if (parsed === null) {
      setDraftText(cleaned);
      return;
    }

    const applied = applyQuantity(parsed);
    // Si el tope disponible obligó a bajar el valor, el texto visible debe
    // reflejarlo al instante — no solo el carrito por detrás, tocar afuera
    // no debería ser necesario para verlo.
    setDraftText(applied !== parsed ? formatQuantity(applied) : cleaned);
  };

  // Solo cierra el modo edición — el valor ya se aplicó tecla a tecla en
  // handleDraftChange. Sirve como respaldo por si queda un estado
  // intermedio inválido (ej. "." solo): no se pierde nada, se queda con
  // la última cantidad válida aplicada.
  const stopEditing = () => setEditing(false);

  return (
    <Box
      role="group"
      aria-label={`Cantidad de ${productoTienda.producto.nombre} en carrito`}
      display="flex"
      alignItems="center"
      gap={0.25}
      onClick={(e) => {
        e.stopPropagation();
        onStopPropagation?.(e);
      }}
      // Misma píldora agrupada que el stepper de CartItemCard: −, cantidad
      // y + leen como un único control en vez de tres piezas sueltas.
      sx={ROOT_SX}
    >
      <IconButton
        size="small"
        onClick={handleQuickDecrement}
        disabled={cartQuantity <= 0}
        aria-label={`Quitar uno de ${productoTienda.producto.nombre}`}
        sx={STEP_BUTTON_SX}
      >
        <RemoveIcon sx={STEP_ICON_SX} />
      </IconButton>

      <Box onClick={startEditing} sx={QUANTITY_SLOT_SX}>
        {editing ? (
          <SelectableTextField
            autoFocus
            value={draftText}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={stopEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Ver comentario equivalente en QuantityStepper: onKeyDown
                // llega al wrapper de MUI, no al <input> — currentTarget no
                // sirve, hay que usar target.
                (e.target as HTMLInputElement).blur();
              }
            }}
            inputProps={{
              inputMode: allowDecimal ? "decimal" : "numeric",
              "aria-label": `Escribir cantidad de ${productoTienda.producto.nombre}`,
              style: QUANTITY_INPUT_STYLE,
            }}
            variant="standard"
            sx={QUANTITY_FIELD_SX}
          />
        ) : (
          <Typography
            variant="body2"
            sx={QUANTITY_TEXT_SX}
            aria-live="polite"
            aria-atomic="true"
          >
            {allowDecimal
              ? cartQuantity.toFixed(2)
              : formatQuantity(cartQuantity)}
          </Typography>
        )}
      </Box>

      <IconButton
        size="small"
        onClick={handleQuickAdd}
        disabled={!canAdd}
        aria-label={`Agregar uno de ${productoTienda.producto.nombre} al carrito`}
        sx={ADD_BUTTON_SX}
      >
        <AddIcon sx={STEP_ICON_SX} />
      </IconButton>
    </Box>
  );
}

export const ProductQuickActions = memo(ProductQuickActionsComponent);
