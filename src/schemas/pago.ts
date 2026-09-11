import { z } from "zod";
import { tasaSnapshotSchema } from "./tasaCambio";
import {
  CONTROL_CHARACTERS_MESSAGE,
  hasControlCharacters,
} from "@/utils/printableText";

/**
 * The two forms of money physically received. Credit is NOT one of them and never will
 * be a third value here: it travels in Venta.creditoBase (ADR 0111). The test of
 * criterion 12 exists to keep this from being reverted by accident.
 */
export const pagoLineaSchema = z.object({
  tipo: z.enum(["cash", "transfer"]),
  moneda: z.string().min(1),
  monto: z.number().positive(),
  equivalenteBase: z.number().nonnegative(),
  transferDestinationId: z.string().uuid().optional(),
});

export const vueltoLineaSchema = z.object({
  moneda: z.string().min(1),
  monto: z.number().nonnegative(),
});

export const pagosDetalleSchema = z.array(pagoLineaSchema);
export const vueltoDetalleSchema = z.array(vueltoLineaSchema);

/**
 * Propina: mismo shape que un pago, porque no es dinero aparte sino la parte
 * de `pagosDetalle` que no pertenece al negocio. Se guarda desglosada por
 * moneda y forma de pago para poder repartirla y reportarla.
 */
export const tipDetalleSchema = z.array(pagoLineaSchema);

/** A transfer line that moves money needs somewhere for it to land. */
function refinePagoLineas(pagos: IPagosDetalle, ctx: z.RefinementCtx): void {
  pagos.forEach((p, i) => {
    if (p.tipo === "transfer" && p.monto > 0 && !p.transferDestinationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "transferDestinationId es requerido para pagos por transferencia",
        path: [i, "transferDestinationId"],
      });
    }
  });
}

/** Validación app: requiere transferDestinationId en líneas transfer con monto > 0 */
export const pagosDetalleAppSchema = pagosDetalleSchema
  .min(1)
  .superRefine(refinePagoLineas);

export const resumenMonedaCierreSchema = z.object({
  id: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  monedaCode: z.string(),
  totalEfectivo: z.number(),
  totalTransfer: z.number(),
  equivalenteBase: z.number(),
  tipCash: z.number(),
  tipTransfer: z.number(),
});

export const multimonedaExtrasSchema = z.object({
  monedaCobro: z.string().min(1),
  pagosDetalle: pagosDetalleSchema,
  vueltoDetalle: vueltoDetalleSchema,
  tasaSnapshot: tasaSnapshotSchema,
  discountTotal: z.number().nonnegative().optional(),
  // A diferencia del descuento —que el servidor recalcula desde las reglas—,
  // la propina no es recalculable: es una decisión del cajero y hay que
  // transportarla. El servidor la valida contra el excedente, no la deriva.
  tipTotal: z.number().nonnegative().optional(),
  tipDetail: tipDetalleSchema.optional(),
  // Credit sale, sent by the checkout alongside the payment lines. F-034 is what
  // validates them on the server; F-031 only declares their shape.
  creditoBase: z.number().nonnegative().optional(),
  clienteId: z.string().uuid().optional(),
  // The name of the customer the cashier typed when no row exists yet — an offline sale
  // naming a customer that has to be created on arrival. Sent alongside `clienteId` when
  // both are known, so the ticket can print the name with no catalogue at hand. The length
  // bound must stay in step with `clienteSchema.nombre` in src/schemas/cliente.ts; the test
  // of criterion 8 is what keeps the two numbers together.
  //
  // The character bound is not decoration. This string is written verbatim into
  // Cliente.nombre and printed on the ticket, and the ESC/POS encoder writes ticket text to
  // the printer with no escaping at all: a control byte inside a name is a command to the
  // hardware, not text (ADR 0120). Rejected here rather than cleaned, so what reaches the
  // row is what the cashier typed.
  clienteNombre: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !hasControlCharacters(value), {
      message: CONTROL_CHARACTERS_MESSAGE,
    })
    .optional(),
});

/**
 * The credit fields alone, derived from multimonedaExtrasSchema instead of restated, so
 * there is one declaration of their shape. Both sale routes parse the incoming body
 * through this before anything reads the numbers: neither route runs the full extras
 * schema today, and checkCreditInvariant relies on its caller for the sign of
 * `creditoBase`.
 */
export const creditoExtrasSchema = multimonedaExtrasSchema.pick({
  creditoBase: true,
  clienteId: true,
  clienteNombre: true,
});

/**
 * The app route's payment lines together with the credit that may replace them.
 *
 * A sale is allowed to arrive with no payment lines only when it carries credit. The
 * line-level rule — a transfer with an amount needs a destination — is the SAME function
 * `pagosDetalleAppSchema` uses, not a second copy of it.
 */
export const pagosDetalleConCreditoAppSchema = z
  .object({
    pagosDetalle: pagosDetalleSchema.superRefine(refinePagoLineas),
    creditoBase: z.number().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.pagosDetalle.length > 0) return;
    if ((Number(value.creditoBase) || 0) > 0) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE,
      path: ["pagosDetalle"],
    });
  });

/**
 * What the app route rejects with when a sale arrives with no payment lines and no credit
 * either. It lives here and not in src/constants/creditoVenta.ts on purpose: that module
 * imports the violation vocabulary from src/lib/cuentasPorCobrar/creditInvariant.ts, which
 * in turn imports this file — importing it back would close a cycle between two modules
 * that evaluate schemas at the top level (E-028). The route's own 400 body keeps the
 * wording it has today (criterion 12: "exactly today's behaviour").
 */
export const EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE =
  "Una venta sin lineas de pago solo se acepta si lleva creditoBase mayor que cero";

export type IPagoLinea = z.infer<typeof pagoLineaSchema>;
export type IVueltoLinea = z.infer<typeof vueltoLineaSchema>;
export type IPagosDetalle = z.infer<typeof pagosDetalleSchema>;
export type IVueltoDetalle = z.infer<typeof vueltoDetalleSchema>;
export type ITipDetalle = z.infer<typeof tipDetalleSchema>;
export type IResumenMonedaCierre = z.infer<typeof resumenMonedaCierreSchema>;
export type IMultimonedaExtras = z.infer<typeof multimonedaExtrasSchema>;
export type ICreditoExtras = z.infer<typeof creditoExtrasSchema>;
