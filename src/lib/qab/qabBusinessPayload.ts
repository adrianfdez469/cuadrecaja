import { toQabCurrencyCodeOrNull } from "@/schemas/qabCurrency";
import { qabBusinessPayloadSchema } from "@/schemas/qabBusiness";
import type {
  IQabBusinessPayload,
  IQabBusinessPayloadInput,
  IQabDisplayCurrenciesInput,
} from "@/schemas/qabBusiness";

/**
 * PURE. THE definition of "which currencies this business shows in the online
 * storefront", and the ONE place it is written (E-014 / E-039). Every reader —
 * this feature's emitter and any future one — calls THIS; nobody re-derives it
 * from `NegocioMoneda` or from `Negocio.monedaBase`.
 *
 * The list is the `monedaCode` of every row with `activo === true`, PLUS
 * `monedaBase`, keeping only the codes `toQabCurrencyCodeOrNull` accepts,
 * deduplicated, and sorted ascending with the default string comparison — never
 * `localeCompare`, whose order depends on a locale. The sort is what makes two
 * emissions of the same set produce identical payloads.
 *
 * A malformed code is DROPPED, and dropping it is what makes the rest of the list
 * travel (criterion 4). That is this function's only guard: it has no other error
 * branch and no error class of its own — unlike `buildQabCurrencyPayload`, which
 * throws `QabCurrencyPayloadError`, and `buildQabStorePayload`, which throws
 * `QabStorePayloadError`. THERE IS NO `QabBusinessPayloadError`: nothing here
 * refuses.
 *
 * It does NOT prune a currency for having no exchange rate: there is no rate in
 * the input. The shape guard and the rate guard are two different guards and they
 * do not overlap (contract v12.1: a currency of the list with no `CURRENCY` and
 * no `EXCHANGE_RATE` yet does not fail the event — it is stored in the list and
 * simply not painted until it has a rate).
 *
 * The base is in the list whenever it has the shape of a code, so the "only the
 * base" case travels as `["CUP"]` and never as `[]`. The result IS `[]` in one
 * case: a business whose `monedaBase` is malformed and that has no well-formed
 * active row. That is the degenerate half of criterion 4, not the "only the
 * base" convention.
 *
 * NOT the same question as `useMonedasAlternativas`
 * (`src/components/MultiCurrencyAmount/useMonedasAlternativas.ts`), and the two
 * must NOT be unified: that hook answers "in which OTHER currencies can the POS
 * show this amount right now", so it drops the base and drops whatever has no
 * live rate. Here the base IS part of the answer and the rate is irrelevant. One
 * difference in each direction: neither is derivable from the other.
 */
export function buildQabDisplayCurrencies(input: IQabDisplayCurrenciesInput): string[] {
  const codes = new Set<string>();

  for (const row of input.monedas) {
    // `=== true` and not `!row.activo`: with `strict: false` a boolean guard over
    // a loosely typed row does not narrow, and this reads the persisted value
    // rather than its truthiness (E-036).
    if (row.activo !== true) continue;
    const code = toQabCurrencyCodeOrNull(row.monedaCode);
    if (code !== null) codes.add(code);
  }

  const base = toQabCurrencyCodeOrNull(input.monedaBase);
  if (base !== null) codes.add(base);

  return Array.from(codes).sort();
}

/**
 * PURE. The whole BUSINESS payload, already parsed by `qabBusinessPayloadSchema`.
 * `displayCurrencies` comes from `buildQabDisplayCurrencies` and from nowhere
 * else.
 *
 * `updatedAt` is `input.occurredAt.toISOString()`: the instant the list changed,
 * taken ONCE by the mutating route and shared with `OutboxEvento.ocurridoAt`.
 * NEVER a `max()` of anything, and never the timestamp of a `NegocioMoneda` row —
 * that table has no time column at all (ADR 0091 § 1, ADR 0092 § 2).
 *
 * Called inside the mutation's transaction, so anything it throws rolls the
 * mutation back. It throws `ZodError` when `negocioId` is not a uuid, and
 * `RangeError` from `toISOString()` when `occurredAt` is an Invalid Date — the
 * schema never sees that one.
 */
export function buildQabBusinessPayload(
  input: IQabBusinessPayloadInput,
): IQabBusinessPayload {
  return qabBusinessPayloadSchema.parse({
    // `businessId` is the SAME value the caller writes to `OutboxEvento.negocioId`
    // and to `entidadId`, never a second read: a payload carrying another
    // business's id makes QAB answer `403 BUSINESS_MISMATCH` and reject the whole
    // batch of whoever carries it.
    businessId: input.negocioId,
    displayCurrencies: buildQabDisplayCurrencies({
      monedas: input.monedas,
      monedaBase: input.monedaBase,
    }),
    updatedAt: input.occurredAt.toISOString(),
  });
}
