import { z } from "zod";
import { movimientoCuentaPorCobrarSchema } from "@/schemas/cuentaPorCobrar";
import { VENTA_DELETE_BLOCK_REASONS } from "@/lib/cuentasPorCobrar/ventaDeleteGuard";

/**
 * This module imports ONLY `zod`, `@/schemas/cuentaPorCobrar` and
 * `@/lib/cuentasPorCobrar/ventaDeleteGuard`. It does NOT import `@/schemas/venta` nor
 * `@/schemas/cuentasPorCobrarPanel`: `venta.ts` imports this module, and
 * `cuentasPorCobrarPanel.ts` imports `ventaSchema`; either one would close a value cycle
 * between modules that evaluate schemas at the top level (E-028).
 */

/**
 * The credit block of a serialized sale: what the list needs to paint the state and what the
 * delete gate needs to decide. It is a READ shape — nothing writes a sale through it.
 *
 * `null` or absent means "this sale has no CuentaPorCobrar", which is every sale with
 * creditoBase = 0 and every sale queued offline whose account does not exist yet.
 */
export const ventaCreditoResumenSchema = z.object({
  cuentaId: z.string().uuid(),
  /** CuentaPorCobrar.montoOriginal, in base currency. */
  montoOriginal: z.number(),
  /** The DENORMALIZED balance, in base currency. */
  saldoPendiente: z.number(),
  /** null = live account. A date = fully settled. */
  settledAt: z.coerce.date().nullable(),
  /** Collections received net of reversals: HOW MANY. summarizeVentaCobros is the definition. */
  cobros: z.number().int(),
  /** Those same collections, in base currency. */
  cobrosMontoBase: z.number(),
  /** Ledger rows of ANY tipo, collections included. The delete gate reads this one too. */
  movimientos: z.number().int(),
});

/** The body of every 409 the two DELETE routes produce for a credit reason. */
export const ventaDeleteBloqueadaResponseSchema = z.object({
  /** Ready to show. Built by VENTA_DELETE_BLOCK_TEXT, never composed at the call site. */
  error: z.string(),
  reason: z.enum(VENTA_DELETE_BLOCK_REASONS),
  cobros: z.number().int(),
  cobrosMontoBase: z.number(),
});

/** GET .../[ventaId]/credito — the debt of ONE sale, with its whole ledger. */
export const ventaCreditoDetalleResponseSchema = z.object({
  /** The instant the response was measured against, echoed like the panel of F-035 does. */
  at: z.coerce.date(),
  cuenta: ventaCreditoResumenSchema.extend({
    ventaId: z.string().uuid(),
    clienteId: z.string().uuid(),
    clienteNombre: z.string(),
    monedaDeudaCode: z.string().nullable(),
    montoDeudaMonedaOriginal: z.number().nullable(),
    /** Newest first. IMPORTED from F-031, never restated (E-039). */
    movimientosDetalle: z.array(movimientoCuentaPorCobrarSchema),
  }),
});

/*
 * Two notes of shape that are not decoration:
 *
 * - `movimientos` (a number) and `movimientosDetalle` (the list) are different fields on
 *   purpose: the listing pays only for the number, the detail pays for the list. Naming them
 *   alike would invite one to overwrite the other in the `extend`.
 * - `settledAt` CROSSES THE WIRE AS A STRING. `/ventas` consumes `getSells` WITHOUT going
 *   through Zod, so on that screen the field is a string even though the type says `Date`
 *   (E-074). That is why `resolveVentaCreditoEstado` only compares it against `null` and calls
 *   no `Date` method. The detail GET's response IS parsed with its schema in the service,
 *   which is what turns it into a `Date` before anything sorts or formats it.
 */

export type IVentaCreditoResumen = z.infer<typeof ventaCreditoResumenSchema>;
export type IVentaDeleteBloqueadaResponse = z.infer<
  typeof ventaDeleteBloqueadaResponseSchema
>;
export type IVentaCreditoDetalleResponse = z.infer<
  typeof ventaCreditoDetalleResponseSchema
>;
