import { z } from "zod";
import { QAB_AMOUNT_DECIMALS } from "@/constants/qab";
import { qabCurrencyCodeSchema } from "@/schemas/qabCurrency";
import { hasQabScale } from "@/schemas/qabDecimals";

/**
 * `price` of a PRODUCT event: a JSON NUMBER (never a quoted string, unlike the
 * order amounts of § ③④), finite, >= 0, with at most QAB_AMOUNT_DECIMALS
 * decimals. Rejects a value `toQabPrice` has not already rounded.
 */
export const qabProductPriceSchema: z.ZodType<number, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (
      typeof input !== "number" ||
      !Number.isFinite(input) ||
      input < 0 ||
      !hasQabScale(input, QAB_AMOUNT_DECIMALS)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB price" });
      return z.NEVER;
    }
    return input;
  });

/**
 * `payload` of a PRODUCT event, contract v10.1 § ① (unchanged since v4). STRICT,
 * and that is the whole point: the key `barcode` (singular, ANY value, `null`
 * included) does not parse here, so criterion 4 is structural and not a thing to
 * remember — and neither `costo`, nor `margen`, nor `existencia`, nor
 * `proveedorId` can survive a future change to the `Producto` row.
 *
 * The payload is built KEY BY KEY from the persisted rows. A spread of a Prisma
 * row (`{...productoRow}`) is FORBIDDEN: `.strict()` would then only fail at
 * runtime, on the day someone adds a column, instead of never being reachable.
 *
 * Keys the panel owns and a PRODUCT event never carries — `description`,
 * `imageUrls`, `priceOverride`, `visible`, `featured` — are absent by
 * construction. `imageUrl` (singular) IS a key of the payload and cuadrecaja has
 * no product image, so it always travels as `null`; the panel's `imageUrls`
 * survives regardless.
 */
export const qabProductPayloadSchema = z
  .object({
    storeProductId: z.string().uuid(),
    productId: z.string().uuid(),
    businessId: z.string().uuid(),
    storeId: z.string().uuid(),
    localName: z.string().min(1),
    /** `[]` is VALID and means "no barcode", not "not synced yet". Never `null`. */
    barcodes: z.array(z.string().min(1)),
    localCategoryId: z.string().uuid().nullable(),
    price: qabProductPriceSchema,
    currency: qabCurrencyCodeSchema,
    canonicalProductId: z.string().nullable(),
    imageUrl: z.string().nullable(),
    publishToStore: z.boolean(),
    /** ISO 8601 with milliseconds. ANTI-STALE guard on the other side. */
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabProductPayload = z.infer<typeof qabProductPayloadSchema>;

/**
 * Flat input of `buildQabProductPayload`. Exactly what the transaction reads
 * back, spelled out one key at a time. `currencyCode` arrives ALREADY RESOLVED
 * (`ProductoTienda.monedaPrecioCode ?? Negocio.monedaBase`): resolving it here
 * would need the business row, which this builder deliberately does not take.
 */
export const qabProductPayloadInputSchema = z
  .object({
    negocioId: z.string().uuid(),
    /** `ProductoTienda.id` — the identity of the row on the other side. */
    productoTiendaId: z.string().uuid(),
    /** `ProductoTienda.tiendaId`. */
    tiendaId: z.string().uuid(),
    /** `Producto.id`. */
    productoId: z.string().uuid(),
    /** `Producto.nombre`. */
    nombre: z.string().min(1),
    /** `CodigoProducto.codigo` of EVERY row of the product. `[]` when it has none. */
    barcodes: z.array(z.string().min(1)),
    /** `Producto.categoriaId`. Travels verbatim: QAB treats it as an opaque id. */
    categoriaId: z.string().uuid().nullable(),
    /** `ProductoTienda.precio`, RAW. The builder rounds it; this schema does not. */
    precio: z.number(),
    /** Already resolved. Never the raw nullable column. */
    currencyCode: z.string(),
    /** `Producto.productoCanonicoId`. NOT a `Producto.id`: no relation, no FK. */
    productoCanonicoId: z.string().nullable(),
    /** `Producto.publicarEnTienda`. NOT `Tienda.publicarEnTienda` — two columns, same wire key. */
    publicarEnTienda: z.boolean(),
    occurredAt: z.date(),
  })
  .strict();
export type IQabProductPayloadInput = z.infer<
  typeof qabProductPayloadInputSchema
>;
