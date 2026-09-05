import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";
import type { IQabCatalogEmissionError } from "@/lib/qab/qabCatalogEmission";
import { toQabCurrencyCodeOrNull } from "@/schemas/qabCurrency";
import { toQabPrice } from "@/schemas/qabDecimals";
import { qabProductPayloadSchema } from "@/schemas/qabProduct";
import type {
  IQabProductPayload,
  IQabProductPayloadInput,
} from "@/schemas/qabProduct";

/** Raised when a persisted row cannot produce a valid PRODUCT payload. */
export class QabProductPayloadError extends Error {
  readonly code: IQabCatalogEmissionError;
  readonly productoTiendaId: string;

  constructor(code: IQabCatalogEmissionError, productoTiendaId: string) {
    super("A product row cannot produce a valid PRODUCT payload");
    this.name = "QabProductPayloadError";
    this.code = code;
    this.productoTiendaId = productoTiendaId;
  }
}

/**
 * PURE. Builds the whole PRODUCT payload from rows that are already persisted,
 * KEY BY KEY, and returns it already parsed by `qabProductPayloadSchema`.
 *
 * Throws QabProductPayloadError with:
 *  - `currencyCodeInvalid` when `currencyCode` is not exactly
 *    QAB_CURRENCY_CODE_LENGTH characters. Refusing is deliberate: `currency`
 *    resolves a foreign key into QAB's GLOBAL currency table, and a four-letter
 *    row there would be visible to every other business.
 *  - `priceInvalid` when `precio` is not finite or is negative.
 *
 * `price` is rounded with `toQabPrice` BEFORE the schema sees it, so `2.675`
 * becomes `2.67` instead of being rejected.
 *
 * A spread of a Prisma row is FORBIDDEN here: every key is written out, so no
 * future column of `Producto` or `ProductoTienda` — `costo`, `margen`,
 * `existencia`, `proveedorId` — can reach the wire by accident.
 */
export function buildQabProductPayload(
  input: IQabProductPayloadInput,
): IQabProductPayload {
  const currency = toQabCurrencyCodeOrNull(input.currencyCode);
  if (currency === null) {
    throw new QabProductPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid,
      input.productoTiendaId,
    );
  }

  if (!Number.isFinite(input.precio) || input.precio < 0) {
    throw new QabProductPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.priceInvalid,
      input.productoTiendaId,
    );
  }

  const price = toQabPrice(input.precio);
  if (price < 0) {
    throw new QabProductPayloadError(
      QAB_CATALOG_EMISSION_ERRORS.priceInvalid,
      input.productoTiendaId,
    );
  }

  return qabProductPayloadSchema.parse({
    storeProductId: input.productoTiendaId,
    productId: input.productoId,
    businessId: input.negocioId,
    storeId: input.tiendaId,
    localName: input.nombre,
    barcodes: input.barcodes,
    localCategoryId: input.categoriaId,
    price,
    // Exactly QAB_CURRENCY_CODE_LENGTH characters by the check above.
    currency,
    canonicalProductId: input.productoCanonicoId,
    // cuadrecaja stores no product image. The panel's `imageUrls` is not ours
    // and survives regardless: this key is the singular one of the contract.
    imageUrl: null,
    publishToStore: input.publicarEnTienda,
    updatedAt: input.occurredAt.toISOString(),
  });
}
