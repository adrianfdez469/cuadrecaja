import { z } from "zod";
import {
  QAB_ANCHOR_CURRENCY_CODE,
  QAB_CURRENCY_CODE_LENGTH,
  QAB_CURRENCY_TEXT_FORBIDDEN_PATTERN,
  QAB_EXCHANGE_RATE_DECIMALS,
} from "@/constants/qab";
import { hasQabScale } from "@/schemas/qabDecimals";

/**
 * `CURRENCY` and `EXCHANGE_RATE` of contract v10.1.
 *
 * They share this file because they share their key (`code`) and because the
 * order between them is the one that fails IN SILENCE: whoever touches one has
 * to see the other.
 */

/**
 * A wire currency code. EXACTLY QAB_CURRENCY_CODE_LENGTH characters:
 * cuadrecaja's own `monedaCreateSchema` allows up to ten, so this is a real
 * border and not a formality.
 */
export const qabCurrencyCodeSchema: z.ZodType<string, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (typeof input !== "string" || input.length !== QAB_CURRENCY_CODE_LENGTH) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB currency code" });
      return z.NEVER;
    }
    return input;
  });
export type IQabCurrencyCode = z.infer<typeof qabCurrencyCodeSchema>;

/** PURE. The code when it conforms, `null` when it does not. Never throws. */
export function toQabCurrencyCodeOrNull(code: unknown): string | null {
  const parsed = qabCurrencyCodeSchema.safeParse(code);
  return parsed.success ? parsed.data : null;
}

/** PURE. `code === QAB_ANCHOR_CURRENCY_CODE`. The one place that comparison is written. */
export function isQabAnchorCurrency(code: string): boolean {
  return code === QAB_ANCHOR_CURRENCY_CODE;
}

/**
 * PURE. True when `value` carries no character of
 * QAB_CURRENCY_TEXT_FORBIDDEN_PATTERN. The ONE place that test is written
 * (E-014): the admin schema and any future caller import THIS, never the regex.
 */
export function isQabCurrencyText(value: string): boolean {
  if (typeof value !== "string") return false;
  return !QAB_CURRENCY_TEXT_FORBIDDEN_PATTERN.test(value);
}

/**
 * A trimmed, capped, control-and-markup-free name or symbol of the GLOBAL
 * `Moneda` row. Used by the admin route's body schema, NOT by
 * `qabCurrencyPayloadSchema` — a row stored before this feature existed may
 * exceed the cap, and a legacy value must not roll back a mutation that does
 * not even touch it.
 */
export function qabCurrencyTextSchema(
  maxLength: number,
): z.ZodType<string, unknown> {
  return z.unknown().transform((input, ctx) => {
    if (typeof input !== "string") {
      ctx.addIssue({ code: "custom", message: "Invalid currency text" });
      return z.NEVER;
    }
    const trimmed = input.trim();
    if (
      trimmed.length < 1 ||
      trimmed.length > maxLength ||
      !isQabCurrencyText(trimmed)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid currency text" });
      return z.NEVER;
    }
    return trimmed;
  });
}

/**
 * `payload` of a CURRENCY event, contract v10.1. STRICT, and it declares NO
 * `businessId` key: the table is GLOBAL to the platform and it is the only
 * payload that skips the identity check. A `businessId` here does not parse,
 * which is what makes acceptance criterion 12 structural.
 *
 * `updatedAt` is validated and NOT compared with anything on the other side:
 * there is no anti-stale guard for this entity.
 */
export const qabCurrencyPayloadSchema = z
  .object({
    code: qabCurrencyCodeSchema,
    name: z.string().min(1),
    symbol: z.string().min(1),
    active: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabCurrencyPayload = z.infer<typeof qabCurrencyPayloadSchema>;

/** Flat input of `buildQabCurrencyPayload`. `code`/`name`/`symbol` come from `Moneda`. */
export const qabCurrencyPayloadInputSchema = z
  .object({
    /** `Moneda.code`. */
    code: z.string(),
    /** `Moneda.nombre` — the INTERNATIONAL name, never a merchant's own wording. */
    nombre: z.string().min(1),
    /** `Moneda.simbolo` — likewise international. */
    simbolo: z.string().min(1),
    /** `Moneda.activo`. Retiring a currency is `active: false`, never a DELETE. */
    activo: z.boolean(),
    /** Instant of the mutation. Also written to OutboxEvento.ocurridoAt. */
    occurredAt: z.date(),
  })
  .strict();
export type IQabCurrencyPayloadInput = z.infer<
  typeof qabCurrencyPayloadInputSchema
>;

/**
 * `rate` of an EXCHANGE_RATE event: a NUMBER, strictly positive, with at most
 * QAB_EXCHANGE_RATE_DECIMALS decimals. Rejects a value that
 * `toQabExchangeRate` has not already rounded, so a caller that forgets the
 * helper fails loudly.
 */
export const qabExchangeRateValueSchema: z.ZodType<number, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (
      typeof input !== "number" ||
      !Number.isFinite(input) ||
      input <= 0 ||
      !hasQabScale(input, QAB_EXCHANGE_RATE_DECIMALS)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB exchange rate" });
      return z.NEVER;
    }
    return input;
  });

/**
 * `payload` of an EXCHANGE_RATE event, contract v10.1. STRICT.
 * `businessId` IS declared here: rates are per business, unlike CURRENCY.
 * Append-only on the other side: every event inserts a row, `operation` is
 * ignored and a DELETE inserts too — so this feature never emits one.
 */
export const qabExchangeRatePayloadSchema = z
  .object({
    businessId: z.string().uuid(),
    currency: qabCurrencyCodeSchema,
    rate: qabExchangeRateValueSchema,
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabExchangeRatePayload = z.infer<
  typeof qabExchangeRatePayloadSchema
>;

/** Flat input of `buildQabExchangeRatePayload`. */
export const qabExchangeRatePayloadInputSchema = z
  .object({
    negocioId: z.string().uuid(),
    /** `TasaCambio.monedaCode`. */
    monedaCode: z.string(),
    /** `TasaCambio.tasa`, RAW. The builder rounds it; this schema does not. */
    tasa: z.number(),
    occurredAt: z.date(),
  })
  .strict();
export type IQabExchangeRatePayloadInput = z.infer<
  typeof qabExchangeRatePayloadInputSchema
>;
