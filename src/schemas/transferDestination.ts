import { z } from 'zod';

export const transferDestinationSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().nullable(),
  default: z.boolean(),
  tiendaId: z.string().uuid(),
});

export const createTransferDestinationSchema = transferDestinationSchema.omit({ id: true });
export const updateTransferDestinationSchema = createTransferDestinationSchema.partial();

export type ITransferDestination = z.infer<typeof transferDestinationSchema>;
export type ICreateTransferDestination = z.infer<typeof createTransferDestinationSchema>;
export type IUpdateTransferDestination = z.infer<typeof updateTransferDestinationSchema>;
