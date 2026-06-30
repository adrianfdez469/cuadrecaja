import { z } from "zod";

export const ticketPlantillaSchema = z.object({
  id: z.string().uuid().optional(),
  tiendaId: z.string().uuid(),
  encabezado: z.string().max(500).nullable().optional(),
  pie: z.string().max(500).nullable().optional(),
  mostrarCajero: z.boolean().default(true),
  mostrarDescuentos: z.boolean().default(true),
  mostrarMultimoneda: z.boolean().default(true),
  anchoPapel: z.union([z.literal(58), z.literal(80)]).default(58),
  logoUrl: z.string().max(500).nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const updateTicketPlantillaSchema = ticketPlantillaSchema.omit({
  id: true,
  tiendaId: true,
  updatedAt: true,
});

export type ITicketPlantilla = z.infer<typeof ticketPlantillaSchema>;
export type IUpdateTicketPlantilla = z.infer<typeof updateTicketPlantillaSchema>;

export const DEFAULT_TICKET_PLANTILLA: Omit<
  ITicketPlantilla,
  "tiendaId" | "id" | "updatedAt"
> = {
  encabezado: null,
  pie: null,
  mostrarCajero: true,
  mostrarDescuentos: true,
  mostrarMultimoneda: true,
  anchoPapel: 58,
  logoUrl: null,
};
