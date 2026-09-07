import { z } from "zod";
import { qabCurrencyCodeSchema } from "@/schemas/qabCurrency";

/**
 * `payload` of a BUSINESS event, contract v12.1. STRICT.
 *
 * `displayCurrencies` is validated CODE BY CODE with `qabCurrencyCodeSchema`, the
 * same schema `buildQabDisplayCurrencies` filters with — so the second parse
 * cannot reject what the first accepted, and a malformed code cannot reach the
 * payload even through a caller that skipped the builder.
 *
 * `[]` parses: the contract declares it valid and means "only the base
 * currency". cuadrecaja never uses it to mean that: see
 * `buildQabDisplayCurrencies`.
 *
 * `updatedAt` is the instant the LIST changed (ADR 0091 § 1, ADR 0092 § 2).
 */
export const qabBusinessPayloadSchema = z
  .object({
    businessId: z.string().uuid(),
    displayCurrencies: z.array(qabCurrencyCodeSchema),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabBusinessPayload = z.infer<typeof qabBusinessPayloadSchema>;

/**
 * One `NegocioMoneda` row of ONE business, as the list builder reads it. A narrow
 * row shape and NOT `INegocioMoneda` of `@/schemas/moneda`: that one is the API
 * shape of the row (uuids, the nested `moneda`, its denominations) and the
 * builder must accept rows read with a two-column `select`. Same precedent as
 * `IQabProductEmissionRow` and `IQabCurrencyEmissionRow`, which are narrow row
 * shapes too. A full `INegocioMoneda` satisfies this structurally.
 */
export const qabNegocioMonedaRowSchema = z.object({
  monedaCode: z.string(),
  activo: z.boolean(),
});

const displayCurrenciesShape = {
  /**
   * EVERY `NegocioMoneda` row of ONE business, active and inactive alike. The
   * `activo` filter belongs to `buildQabDisplayCurrencies` and to no Prisma
   * `where` (E-014). There is NO rate here, and that absence is the structural
   * form of "the list is never pruned for lack of a rate".
   */
  monedas: z.array(qabNegocioMonedaRowSchema),
  /** `Negocio.monedaBase`, verbatim: a String with no FK to `Moneda` and no shape guarantee. */
  monedaBase: z.string(),
};

export const qabDisplayCurrenciesInputSchema = z.object(displayCurrenciesShape).strict();
export type IQabDisplayCurrenciesInput = z.infer<typeof qabDisplayCurrenciesInputSchema>;

export const qabBusinessPayloadInputSchema = z
  .object({
    negocioId: z.string().uuid(),
    ...displayCurrenciesShape,
    /** Instant of the mutation. Also written to `OutboxEvento.ocurridoAt`. */
    occurredAt: z.date(),
  })
  .strict();
export type IQabBusinessPayloadInput = z.infer<typeof qabBusinessPayloadInputSchema>;
