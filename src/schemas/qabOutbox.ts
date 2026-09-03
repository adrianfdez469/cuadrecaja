import { z } from "zod";
import { QAB_OUTBOX_ENTITIES, QAB_OUTBOX_OPERATIONS } from "@/constants/qab";

export const qabOutboxEntitySchema = z.enum(QAB_OUTBOX_ENTITIES);
export const qabOutboxOperationSchema = z.enum(QAB_OUTBOX_OPERATIONS);
export type IQabOutboxEntity = z.infer<typeof qabOutboxEntitySchema>;
export type IQabOutboxOperation = z.infer<typeof qabOutboxOperationSchema>;

/**
 * What goes into an OutboxEvento row. Keys match the Prisma field names, which
 * are in Spanish on purpose: the contract publishes executable SQL against them
 * (ADR 0005).
 */
export const outboxEventoCreateSchema = z.object({
  negocioId: z.string().min(1),
  entidad: qabOutboxEntitySchema,
  entidadId: z.string().min(1),
  operacion: qabOutboxOperationSchema,
  payload: z.unknown(),
  ocurridoAt: z.date().optional(),
});
export type IOutboxEventoCreate = z.infer<typeof outboxEventoCreateSchema>;

/**
 * A row as it is read back. `id` is a string, NOT a bigint: the column is a
 * BigInt and no JSON.stringify anywhere should ever meet one.
 */
export const outboxEventoSchema = z.object({
  id: z.string().min(1),
  negocioId: z.string().min(1),
  entidad: qabOutboxEntitySchema,
  entidadId: z.string().min(1),
  operacion: qabOutboxOperationSchema,
  ocurridoAt: z.coerce.date(),
  payload: z.unknown(),
  intentos: z.number().int().min(0),
  procesadoAt: z.coerce.date().nullable(),
  ultimoError: z.string().nullable(),
});
export type IOutboxEvento = z.infer<typeof outboxEventoSchema>;
