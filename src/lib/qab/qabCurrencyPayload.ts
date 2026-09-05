import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";
import type { IQabCatalogEmissionError } from "@/lib/qab/qabCatalogEmission";
import {
  isQabAnchorCurrency,
  qabCurrencyPayloadSchema,
  qabExchangeRatePayloadSchema,
  toQabCurrencyCodeOrNull,
} from "@/schemas/qabCurrency";
import type {
  IQabCurrencyPayload,
  IQabCurrencyPayloadInput,
  IQabExchangeRatePayload,
  IQabExchangeRatePayloadInput,
} from "@/schemas/qabCurrency";
import { toQabExchangeRate } from "@/schemas/qabDecimals";

/** Raised when a persisted row cannot produce a valid CURRENCY/EXCHANGE_RATE payload. */
export class QabCurrencyPayloadError extends Error {
  readonly code: IQabCatalogEmissionError;
  readonly currencyCode: string;

  constructor(code: IQabCatalogEmissionError, currencyCode: string) {
    super("A currency row cannot produce a valid payload");
    this.name = "QabCurrencyPayloadError";
    this.code = code;
    this.currencyCode = currencyCode;
  }
}

/**
 * PURE. Throws QabCurrencyPayloadError(`currencyCodeInvalid`) when `code` is not
 * exactly QAB_CURRENCY_CODE_LENGTH characters. `name`/`symbol` are the
 * INTERNATIONAL ones (`Moneda.nombre`/`Moneda.simbolo`), never a merchant's.
 * The payload carries NO `businessId`: the schema does not declare the key.
 */
export function buildQabCurrencyPayload(
  input: IQabCurrencyPayloadInput,
): IQabCurrencyPayload {
  const code = toQabCurrencyCodeOrNull(input.code);
  if (code === null) {
    throw new QabCurrencyPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid,
      input.code,
    );
  }

  return qabCurrencyPayloadSchema.parse({
    code,
    name: input.nombre,
    symbol: input.simbolo,
    // Retiring a currency is `active: false`, never a DELETE.
    active: input.activo,
    updatedAt: input.occurredAt.toISOString(),
  });
}

/**
 * PURE. `rate` is rounded with `toQabExchangeRate` (SIX decimals) before the
 * schema sees it.
 *
 * Throws QabCurrencyPayloadError with:
 *  - `currencyCodeInvalid` when the code is not three characters, OR when it is
 *    QAB_ANCHOR_CURRENCY_CODE: CUP is the anchor and never travels as a rate.
 *  - `exchangeRateTooSmall` when the ROUNDED rate is not strictly greater than
 *    zero — a rate under 5e-7 CUP per unit rounds to 0 and the contract requires
 *    `> 0`.
 */
export function buildQabExchangeRatePayload(
  input: IQabExchangeRatePayloadInput,
): IQabExchangeRatePayload {
  const code = toQabCurrencyCodeOrNull(input.monedaCode);
  if (code === null || isQabAnchorCurrency(code)) {
    throw new QabCurrencyPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid,
      input.monedaCode,
    );
  }

  const rate = toQabExchangeRate(input.tasa);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new QabCurrencyPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall,
      code,
    );
  }

  return qabExchangeRatePayloadSchema.parse({
    businessId: input.negocioId,
    currency: code,
    rate,
    updatedAt: input.occurredAt.toISOString(),
  });
}
