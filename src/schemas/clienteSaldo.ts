import { z } from "zod";
import { clienteSchema } from "@/schemas/cliente";

/** A Cliente row as GET /api/clientes returns it: the entity plus its live balance. */
export const clienteConSaldoSchema = clienteSchema.extend({
  saldo: z.number(),
});

/**
 * What the selector paints and what the cache persists — the SAME four fields, on purpose
 * (ADR 0108). A fifth field here is a fifth field on disk.
 */
export const clienteOptionSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  telefono: z.string().nullable(),
  saldo: z.number(),
});

export const CLIENTE_UPSERT_ACTIONS = ["CREATE", "REACTIVATE", "DUPLICATE"] as const;

export const clienteUpsertResponseSchema = z.object({
  action: z.enum(["CREATE", "REACTIVATE"]),
  cliente: clienteConSaldoSchema,
});

export const clienteDeleteConflictSchema = z.object({
  error: z.string(),
  saldoPendiente: z.number(),
});

export type IClienteConSaldo = z.infer<typeof clienteConSaldoSchema>;
export type IClienteOption = z.infer<typeof clienteOptionSchema>;
export type IClienteUpsertAction = (typeof CLIENTE_UPSERT_ACTIONS)[number];
export type IClienteUpsertResponse = z.infer<typeof clienteUpsertResponseSchema>;
export type IClienteDeleteConflict = z.infer<typeof clienteDeleteConflictSchema>;
