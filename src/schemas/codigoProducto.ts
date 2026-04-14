import { z } from 'zod';

export const codigoProductoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().min(1),
  productoId: z.string().uuid(),
});

export type ICodigoProducto = z.infer<typeof codigoProductoSchema>;
