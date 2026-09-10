import { z } from "zod";
import { pagoLineaSchema } from "./pago";
import { tasaSnapshotSchema } from "./tasaCambio";

/**
 * The four things that move a balance. THE ONLY declaration of this list in the
 * project: `src/constants/cuentasPorCobrar.ts` (F-033) imports it from here instead
 * of restating it.
 */
export const TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR = [
  "ABONO",
  "AJUSTE_DEVOLUCION",
  "CONDONACION",
  "REVERSION_ABONO",
] as const;

export const tipoMovimientoCuentaPorCobrarEnum = z.enum(
  TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR,
);

export const movimientoCuentaPorCobrarSchema = z.object({
  id: z.string().uuid(),
  cuentaPorCobrarId: z.string().uuid(),
  tipo: tipoMovimientoCuentaPorCobrarEnum,
  /** Always positive and in base currency. The sign belongs to `tipo`. */
  monto: z.number().positive(),
  fecha: z.coerce.date(),
  pagosDetalle: z.array(pagoLineaSchema).nullable().optional(),
  tasaSnapshot: tasaSnapshotSchema.nullable().optional(),
  /** Same bound as MovimientoStock.motivo and DevolucionVenta.motivo. */
  motivo: z.string().max(300, "Máximo 300 caracteres").nullable().optional(),
  usuarioId: z.string().uuid().nullable().optional(),
  revierteId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const cuentaPorCobrarSchema = z.object({
  id: z.string().uuid(),
  ventaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  fechaVenta: z.coerce.date(),
  montoOriginal: z.number(),
  saldoPendiente: z.number(),
  settledAt: z.coerce.date().nullable().optional(),
  monedaDeudaCode: z.string().nullable().optional(),
  montoDeudaMonedaOriginal: z.number().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  movimientos: z.array(movimientoCuentaPorCobrarSchema).optional(),
});

export type ITipoMovimientoCuentaPorCobrar = z.infer<
  typeof tipoMovimientoCuentaPorCobrarEnum
>;
export type IMovimientoCuentaPorCobrar = z.infer<
  typeof movimientoCuentaPorCobrarSchema
>;
export type ICuentaPorCobrar = z.infer<typeof cuentaPorCobrarSchema>;
