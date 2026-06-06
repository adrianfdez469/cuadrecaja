import { z } from "zod";

export const cartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  productoTiendaId: z.string(),
  fechaVencimiento: z.string().nullable().optional(),
  monedaPrecioCode: z.string().nullable().optional(),
  priceBase: z.number().optional(), // equivalente en monedaBase al momento de agregar al carrito
});

export const cartSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(cartItemSchema),
  total: z.number(),
});

export type ICartItem = z.infer<typeof cartItemSchema>;
export type ICart = z.infer<typeof cartSchema>;
