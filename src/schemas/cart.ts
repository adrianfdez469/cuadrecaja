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
  /**
   * Discount codes typed by the cashier for THIS account.
   *
   * Per cart on purpose. It used to be component state inside the cart
   * drawer, which on desktop stays mounted while accounts are switched — so a
   * code applied to one account went on discounting the next one. It also
   * meant the amount could only be known from inside the drawer, which is why
   * nothing outside it could show a trustworthy total.
   */
  discountCodes: z.array(z.string()).default([]),
});

export type ICartItem = z.infer<typeof cartItemSchema>;
export type ICart = z.infer<typeof cartSchema>;
