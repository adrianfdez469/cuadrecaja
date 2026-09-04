import { z } from "zod";
import { QAB_ORDER_STATUSES } from "@/constants/qab";

/**
 * Response of `GET /api/tienda-online/estado`.
 * The ONLY endpoint of the module that is not behind the switch: the Drawer of
 * EVERY authenticated user needs it to decide whether the section exists at all.
 */
export const tiendaOnlineEstadoSchema = z
  .object({ tiendaOnlineHabilitada: z.boolean() })
  .strict();
export type ITiendaOnlineEstado = z.infer<typeof tiendaOnlineEstadoSchema>;

/**
 * Response of the two scaffolding GETs of F-004. `z.literal(true)` is the point:
 * these routes are only reachable with the switch on, and the schema says so.
 * F-005 and F-011 extend it with `.extend`; they do not replace it.
 */
export const tiendaOnlineScaffoldSchema = z
  .object({
    negocioId: z.string().uuid(),
    tiendaOnlineHabilitada: z.literal(true),
  })
  .strict();
export type ITiendaOnlineScaffold = z.infer<typeof tiendaOnlineScaffoldSchema>;

/**
 * Body of `PATCH /api/tienda-online/pedidos/[pedidoId]/status`.
 * SHAPE ONLY. Which transitions are legal is F-011's problem, not this schema's:
 * every value of the enum parses here, including nonsensical ones.
 */
export const pedidoEntranteStatusUpdateSchema = z
  .object({ status: z.enum(QAB_ORDER_STATUSES) })
  .strict();
export type IPedidoEntranteStatusUpdate = z.infer<
  typeof pedidoEntranteStatusUpdateSchema
>;
