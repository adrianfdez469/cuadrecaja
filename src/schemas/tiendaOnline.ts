import { z } from "zod";
import {
  QAB_ORDER_STATUS_FAILURE_CODES,
  QAB_ORDER_STATUS_REPORTABLE,
  QAB_PRODUCT_PAGE_SIZE_MAX,
  QAB_PRODUCT_SEARCH_MAX_LENGTH,
  QAB_SLUG_QUERY_MAX_LENGTH,
  QAB_SLUG_UPSTREAM_CODES,
  QAB_STORE_ADDRESS_MAX_LENGTH,
  QAB_STORE_CITY_MAX_LENGTH,
  QAB_STORE_DESCRIPTION_MAX_LENGTH,
  QAB_STORE_EMAIL_MAX_LENGTH,
  QAB_STORE_PHONE_MAX_LENGTH,
  QAB_STORE_PROVINCE_MAX_LENGTH,
  QAB_STORE_SYNC_CODES,
  QAB_STORE_SYNC_STATES,
  QAB_UNPUBLISH_REASON_MAX_LENGTH,
} from "@/constants/qab";
import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX,
} from "@/constants/tiendaOnline";
import {
  openingHoursIssueSchema,
  openingHoursSchema,
} from "@/schemas/qabOpeningHours";
import { qabSlugSchema } from "@/schemas/qabStore";
import { qabWhatsappUrlSchema } from "@/schemas/qabWhatsappUrl";
import { TipoLocalEnum } from "@/schemas/tienda";

/**
 * Response of `GET /api/tienda-online/estado`.
 * The ONLY endpoint of the module that is not behind the switch: the Drawer of
 * EVERY authenticated user needs it to decide whether the section exists at all.
 */
export const tiendaOnlineEstadoSchema = z
  .object({ tiendaOnlineHabilitada: z.boolean() })
  .strict();
export type ITiendaOnlineEstado = z.infer<typeof tiendaOnlineEstadoSchema>;

/**
 * Response of the two scaffolding GETs of F-004. `z.literal(true)` is the point:
 * these routes are only reachable with the switch on, and the schema says so.
 * F-005 and F-011 extend it with `.extend`; they do not replace it.
 */
export const tiendaOnlineScaffoldSchema = z
  .object({
    negocioId: z.string().uuid(),
    tiendaOnlineHabilitada: z.literal(true),
  })
  .strict();
export type ITiendaOnlineScaffold = z.infer<typeof tiendaOnlineScaffoldSchema>;

/* -------------------------------------------------------------------------- */
/* F-005 — the configuration screen of one local                               */
/* -------------------------------------------------------------------------- */

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A free-text field of the form. Trims, and turns the EMPTY STRING INTO `null`:
 * a field the merchant clears means «delete it», and `""` is a value on the
 * other side, not a deletion.
 */
function nullableText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === null || value.length === 0 ? null : value));
}

function isEmailOrNull(value: string | null): boolean {
  return value === null || EMAIL_PATTERN.test(value);
}

/** The closed vocabulary the screen is allowed to be told about a failed sync. */
export const qabStoreSyncCodeSchema = z.enum(QAB_STORE_SYNC_CODES);
export type IQabStoreSyncCode = z.infer<typeof qabStoreSyncCodeSchema>;

/** Per-local sync state, derived from OutboxEvento. Closed vocabulary: ADR 0034. */
export const qabStoreSyncStateSchema = z
  .object({
    state: z.enum(QAB_STORE_SYNC_STATES),
    /** null when `state` is SYNCED or PENDING with no previous failure. */
    code: qabStoreSyncCodeSchema.nullable(),
    attempts: z.number().int().min(0),
    /** `ocurridoAt` of the oldest pending event, or null when there is none. */
    since: z.string().datetime().nullable(),
  })
  .strict();
export type IQabStoreSyncState = z.infer<typeof qabStoreSyncStateSchema>;
export type IQabStoreSyncStateName = IQabStoreSyncState["state"];

/** One local as the configuration screen sees it. */
export const tiendaOnlineLocalSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string().min(1),
    tipo: TipoLocalEnum,
    publicarEnTienda: z.boolean(),
    slug: z.string().nullable(),
    /**
     * What QAB actually assigned. Read-only on the browser's path: the PATCH body
     * still never accepts it (see `tiendaOnlineLocalUpdateSchema`). The ONE writer
     * is the cron's slug-learning phase of F-020, server side.
     */
    slugQab: z.string().nullable(),
    descripcion: z.string().nullable(),
    direccion: z.string().nullable(),
    ciudad: z.string().nullable(),
    provincia: z.string().nullable(),
    latitud: z.number().nullable(),
    longitud: z.number().nullable(),
    telefono: z.string().nullable(),
    whatsapp: z.string().nullable(),
    email: z.string().nullable(),
    /** null when there is no calendar OR when the stored one does not validate. */
    horarios: openingHoursSchema.nullable(),
    /** true when the stored `horarios` is non-empty and does NOT validate. */
    horariosInvalid: z.boolean(),
    /**
     * The coded rules the STORED calendar breaks, empty when it validates.
     *
     * Additive to the interface contract, and required by the design contract:
     * `horarios` comes back as `null` when it does not validate, so without
     * these the screen could only say «the saved calendar is unusable» and never
     * WHICH of the rules it breaks — which is what acceptance criterion 8 and
     * design criterion 36 ask for. `.default([])` so a payload without the key
     * still parses.
     */
    horariosIssues: z.array(openingHoursIssueSchema).default([]),
    motivoDespublicacion: z
      .string()
      .max(QAB_UNPUBLISH_REASON_MAX_LENGTH)
      .nullable(),
    /** `tipo === "TIENDA"`. An ALMACEN never publishes. */
    publishable: z.boolean(),
    /**
     * No STORE event of this local carries `publishToStore: true`, i.e. it has
     * never been published. Drives the brand question, which is asked ONCE per
     * local. NOT "no event has ever been emitted": every applied PATCH emits, so
     * that would let a plain save consume the question. See ADR 0035.
     */
    firstPublishPending: z.boolean(),
    syncState: qabStoreSyncStateSchema,
  })
  .strict();
export type ITiendaOnlineLocal = z.infer<typeof tiendaOnlineLocalSchema>;

/** Response of GET /api/tienda-online/configuracion. Extends the F-004 scaffold. */
export const tiendaOnlineConfiguracionSchema = tiendaOnlineScaffoldSchema
  .extend({ locales: z.array(tiendaOnlineLocalSchema) })
  .strict();
export type ITiendaOnlineConfiguracion = z.infer<
  typeof tiendaOnlineConfiguracionSchema
>;

/**
 * Body of PATCH /api/tienda-online/configuracion/[tiendaId].
 *
 * FULL REPLACEMENT of the online-store block, not a partial: every key is
 * required, `null` included. It is the same omission rule QAB applies, one step
 * earlier - what you do not send is cleared. See ADR 0032.
 *
 * `slugQab` is absent on purpose: the merchant does not choose their public
 * address, so a body carrying it is an attempt to choose it. The column is
 * written ONLY by the cron's slug-learning phase (F-020), never from a request.
 */
export const tiendaOnlineLocalUpdateSchema = z
  .object({
    publicarEnTienda: z.boolean(),
    slug: qabSlugSchema.nullable(),
    descripcion: nullableText(QAB_STORE_DESCRIPTION_MAX_LENGTH),
    direccion: nullableText(QAB_STORE_ADDRESS_MAX_LENGTH),
    ciudad: nullableText(QAB_STORE_CITY_MAX_LENGTH),
    provincia: nullableText(QAB_STORE_PROVINCE_MAX_LENGTH),
    latitud: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX).nullable(),
    longitud: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX).nullable(),
    telefono: nullableText(QAB_STORE_PHONE_MAX_LENGTH),
    whatsapp: nullableText(QAB_STORE_PHONE_MAX_LENGTH),
    email: nullableText(QAB_STORE_EMAIL_MAX_LENGTH).refine(isEmailOrNull),
    horarios: openingHoursSchema.nullable(),
    motivoDespublicacion: nullableText(QAB_UNPUBLISH_REASON_MAX_LENGTH),
  })
  .strict();
export type ITiendaOnlineLocalUpdate = z.infer<
  typeof tiendaOnlineLocalUpdateSchema
>;

/** Response of the PATCH. `eventId` is the OutboxEvento id, as a decimal string. */
export const tiendaOnlineLocalUpdateResultSchema = z
  .object({ local: tiendaOnlineLocalSchema, eventId: z.string().min(1) })
  .strict();
export type ITiendaOnlineLocalUpdateResult = z.infer<
  typeof tiendaOnlineLocalUpdateResultSchema
>;

/**
 * Query of GET /api/tienda-online/slug-availability.
 *
 * `slug` and `name` are capped but NOT format-checked: an unusable candidate has
 * to reach QAB so it can answer `reason: "invalid"`. The cap is what stops an
 * unbounded string from leaving cuadrecaja (security-guardian, F-005).
 */
export const tiendaOnlineSlugQuerySchema = z
  .object({
    slug: z.string().trim().min(1).max(QAB_SLUG_QUERY_MAX_LENGTH).optional(),
    name: z.string().trim().min(1).max(QAB_SLUG_QUERY_MAX_LENGTH).optional(),
    tiendaId: z.string().uuid().optional(),
  })
  .strict()
  .refine((query) => query.slug !== undefined || query.name !== undefined);
export type ITiendaOnlineSlugQuery = z.infer<typeof tiendaOnlineSlugQuerySchema>;

/** Response of GET /api/tienda-online/slug-availability. `reserving` is NOT re-exposed. */
export const tiendaOnlineSlugForecastSchema = z
  .object({
    candidate: z.string(),
    available: z.boolean(),
    /** OPEN string, not an enum: a seventh value must not break the screen (ADR 0033). */
    reason: z.string(),
    resolvedSlug: z.string(),
    url: z.string(),
    storeKnown: z.boolean(),
  })
  .strict();
export type ITiendaOnlineSlugForecast = z.infer<
  typeof tiendaOnlineSlugForecastSchema
>;

/** Body of every 502 of the slug route. Same shape F-003 established. */
export const tiendaOnlineSlugErrorSchema = z
  .object({
    error: z.literal(TIENDA_ONLINE_API_ERRORS.slugUpstream),
    qabError: z.enum(QAB_SLUG_UPSTREAM_CODES),
    retryable: z.boolean(),
  })
  .strict();
export type ITiendaOnlineSlugError = z.infer<typeof tiendaOnlineSlugErrorSchema>;

/* -------------------------------------------------------------------------- */
/* F-006 — the publishing tab                                                  */
/* -------------------------------------------------------------------------- */

/** One store row of a product, as the publishing tab sees it. */
export const tiendaOnlineProductoTiendaSchema = z
  .object({
    productoTiendaId: z.string().uuid(),
    tiendaId: z.string().uuid(),
    tiendaNombre: z.string().min(1),
    precio: z.number(),
    /** Already resolved: `monedaPrecioCode ?? Negocio.monedaBase`. */
    monedaCode: z.string(),
    /**
     * `Tienda.publicarEnTienda`. Lets the screen tell "the local is not
     * published yet" (criterion 7, `skipped_not_published` on the other side)
     * apart from a real failure. A real column that F-005 writes, not a derived
     * guess.
     */
    tiendaPublicada: z.boolean(),
  })
  .strict();
export type ITiendaOnlineProductoTienda = z.infer<
  typeof tiendaOnlineProductoTiendaSchema
>;

/** One product of the publishing tab. */
export const tiendaOnlineProductoSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string().min(1),
    categoriaId: z.string().uuid(),
    categoriaNombre: z.string().min(1),
    publicarEnTienda: z.boolean(),
    barcodes: z.array(z.string().min(1)),
    /** Live ProductoTienda rows in locals of `tipo: "TIENDA"`. May be empty. */
    tiendas: z.array(tiendaOnlineProductoTiendaSchema),
    /** Merged with `mergeQabProductSyncState`. Reuses the F-005 shape. */
    syncState: qabStoreSyncStateSchema,
  })
  .strict();
export type ITiendaOnlineProducto = z.infer<typeof tiendaOnlineProductoSchema>;

/** Response of GET /api/tienda-online/productos. Extends the F-004 scaffold. */
export const tiendaOnlineProductosPageSchema = tiendaOnlineScaffoldSchema
  .extend({
    productos: z.array(tiendaOnlineProductoSchema),
    /** `Producto.id` to pass back as `cursor`, or null when this is the last page. */
    nextCursor: z.string().uuid().nullable(),
    /**
     * Products matching the current filter. Present ONLY when `categoriaId` was
     * given: it is what the bulk-action confirmation announces. `null` otherwise
     * — counting the whole catalog on every page would be a query nobody asked
     * for.
     */
    total: z.number().int().min(0).nullable(),
    /**
     * The caller holds BOTH permissions and may act. The screen disables the
     * switch and the bulk action when this is false (criterion 19). It is NOT
     * the security boundary: the PATCH re-checks server side and answers 403.
     */
    puedePublicar: z.boolean(),
  })
  .strict();
export type ITiendaOnlineProductosPage = z.infer<
  typeof tiendaOnlineProductosPageSchema
>;

/** Query of GET /api/tienda-online/productos. */
export const tiendaOnlineProductosQuerySchema = z
  .object({
    categoriaId: z.string().uuid().optional(),
    search: z.string().trim().min(1).max(QAB_PRODUCT_SEARCH_MAX_LENGTH).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(QAB_PRODUCT_PAGE_SIZE_MAX).optional(),
  })
  .strict();
export type ITiendaOnlineProductosQuery = z.infer<
  typeof tiendaOnlineProductosQuerySchema
>;

/** Body of BOTH publish PATCHes. One key, nothing else. */
export const tiendaOnlinePublicacionUpdateSchema = z
  .object({ publicarEnTienda: z.boolean() })
  .strict();
export type ITiendaOnlinePublicacionUpdate = z.infer<
  typeof tiendaOnlinePublicacionUpdateSchema
>;

/** Response of PATCH /api/tienda-online/productos/[productoId]. */
export const tiendaOnlineProductoUpdateResultSchema = z
  .object({
    producto: tiendaOnlineProductoSchema,
    /** OutboxEvento rows written by this call, bootstrap events included. */
    eventos: z.number().int().min(0),
  })
  .strict();
export type ITiendaOnlineProductoUpdateResult = z.infer<
  typeof tiendaOnlineProductoUpdateResultSchema
>;

/** Response of PATCH /api/tienda-online/productos/categoria/[categoriaId]. */
export const tiendaOnlineBulkResultSchema = z
  .object({
    /** Products whose `publicarEnTienda` this call wrote. The N of criterion 6. */
    productos: z.number().int().min(0),
    /** OutboxEvento rows written, bootstrap events included: N != eventos. */
    eventos: z.number().int().min(0),
  })
  .strict();
export type ITiendaOnlineBulkResult = z.infer<
  typeof tiendaOnlineBulkResultSchema
>;

/** Body of the 409 both PATCHes answer when a payload cannot be built. */
export const tiendaOnlinePayloadRejectedSchema = z
  .object({
    error: z.literal(TIENDA_ONLINE_API_ERRORS.payloadInvalid),
    code: z.string().min(1),
    productoTiendaId: z.string().nullable(),
  })
  .strict();
export type ITiendaOnlinePayloadRejected = z.infer<
  typeof tiendaOnlinePayloadRejectedSchema
>;

/** Body of the 409 the bulk action answers when the category is too large. */
export const tiendaOnlineBulkTooLargeSchema = z
  .object({
    error: z.literal(TIENDA_ONLINE_API_ERRORS.bulkTooLarge),
    productos: z.number().int().min(0),
    max: z.number().int().min(1),
  })
  .strict();
export type ITiendaOnlineBulkTooLarge = z.infer<
  typeof tiendaOnlineBulkTooLargeSchema
>;

/* -------------------------------------------------------------------------- */
/* F-011 — the orders inbox                                                    */
/* -------------------------------------------------------------------------- */

/** Fixed-scale decimal string, exactly QAB_AMOUNT_DECIMALS decimals. */
const TIENDA_ONLINE_AMOUNT_PATTERN = /^-?\d+\.\d{2}$/;
/** Fixed-scale decimal string, exactly QAB_QUANTITY_DECIMALS decimals. */
const TIENDA_ONLINE_QUANTITY_PATTERN = /^-?\d+\.\d{3}$/;

const amountSchema = z.string().regex(TIENDA_ONLINE_AMOUNT_PATTERN);
const quantitySchema = z.string().regex(TIENDA_ONLINE_QUANTITY_PATTERN);

/**
 * The amounts of one order, discriminated by the delivery state.
 *
 * The point of the union is what the PENDING_QUOTE branch does NOT have: no
 * `deliveryFee`, so the filler "0.00" never reaches the screen, and no `total`,
 * so a screen that wants to print a final amount cannot reach for one that does
 * not exist. `kind` comes from `deliveryFeePending` and from nothing else.
 * See ADR 0059.
 */
export const tiendaOnlineOrderAmountsSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal(TIENDA_ONLINE_ORDER_AMOUNT_KIND.quoted),
      subtotal: amountSchema,
      discountTotal: amountSchema,
      deliveryFee: amountSchema,
      /** COMPLETE: subtotal - discountTotal + deliveryFee. */
      total: amountSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal(TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote),
      subtotal: amountSchema,
      discountTotal: amountSchema,
      /** PARTIAL: subtotal - discountTotal, with no delivery anybody quoted yet. */
      partialTotal: amountSchema,
    })
    .strict(),
]);
export type ITiendaOnlineOrderAmounts = z.infer<
  typeof tiendaOnlineOrderAmountsSchema
>;

/**
 * The price of a line before conversion. Non-null ONLY when the row has BOTH
 * `originalCurrencyCode` and `originalUnitPrice`; `lineTotal` may still be null
 * inside it. A pre-distinction order has none of them, and that is neither an
 * error nor missing data.
 *
 * These amounts are NOT summable across lines (R5b): `subtotal` and the totals of
 * the order are always the sum of the already converted `lineTotal`.
 */
export const tiendaOnlineOrderLineOriginalSchema = z
  .object({
    currencyCode: z.string().min(1),
    unitPrice: amountSchema,
    lineTotal: amountSchema.nullable(),
  })
  .strict();
export type ITiendaOnlineOrderLineOriginal = z.infer<
  typeof tiendaOnlineOrderLineOriginalSchema
>;

/**
 * `unitPrice` recomputed from `original` with the order's `rateSnapshot`.
 *
 * It NEVER replaces the stored `unitPrice`: that is the price the buyer agreed
 * to. `matchesStored` is the exact equality of the two fixed-scale strings, with
 * no tolerance — it is the executable reading of acceptance criterion 6, and
 * `false` is not an error of the request. See ADR 0060.
 */
export const tiendaOnlineOrderLineConversionSchema = z
  .object({
    recomputedUnitPrice: amountSchema,
    matchesStored: z.boolean(),
  })
  .strict();
export type ITiendaOnlineOrderLineConversion = z.infer<
  typeof tiendaOnlineOrderLineConversionSchema
>;

export const tiendaOnlineOrderLineSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    quantity: quantitySchema,
    currencyCode: z.string().min(1),
    /** STORED, always. Never the recomputed one. */
    unitPrice: amountSchema,
    lineTotal: amountSchema,
    original: tiendaOnlineOrderLineOriginalSchema.nullable(),
    /**
     * `null` in exactly four cases, and no other: `original` is null; the order
     * has no readable `rateSnapshot`; the rate of the original currency is
     * unreadable; the rate of the line currency is unreadable.
     */
    conversion: tiendaOnlineOrderLineConversionSchema.nullable(),
  })
  .strict();
export type ITiendaOnlineOrderLine = z.infer<typeof tiendaOnlineOrderLineSchema>;

/**
 * Where the conversion came from. The `rates` map itself is NOT re-exposed: the
 * server already did the arithmetic, and no effective rate is published either
 * — a rounded rate does not reproduce the conversion (ADR 0060).
 *
 * `capturedAt` is NOT `.datetime()`: it is a third-party string kept verbatim,
 * and a value that does not parse as an instant must not make the whole response
 * fail its own schema.
 */
export const tiendaOnlineRateSnapshotInfoSchema = z
  .object({
    base: z.string().min(1),
    capturedAt: z.string().nullable(),
  })
  .strict();
export type ITiendaOnlineRateSnapshotInfo = z.infer<
  typeof tiendaOnlineRateSnapshotInfoSchema
>;

/** One order as the inbox listing sees it. No lines: those are the detail's. */
export const tiendaOnlineOrderListItemSchema = z
  .object({
    id: z.string().uuid(),
    /** `Order.code`. Shown on screen on purpose; never logged (ADR 0061). */
    code: z.string().min(1),
    /** QAB's order id, decimal digits. */
    qabOrderId: z.string().min(1),
    /** NEVER null on a listed row: an order with no store is never in scope. */
    tiendaId: z.string().uuid(),
    tiendaNombre: z.string().min(1),
    /** OPEN string, not an enum. No exhaustive switch without a default (ADR 0004). */
    status: z.string().min(1),
    /** CUSTOMER | EXPIRY | STORE, or null. Free text, same reason. */
    cancelledBy: z.string().nullable(),
    /**
     * `isUnattendedOrderStatus(status)`. The SAME status half the counter uses;
     * the scope half is what already put this row on the page (ADR 0058).
     */
    unattended: z.boolean(),
    contactName: z.string().nullable(),
    currencyCode: z.string().min(1),
    amounts: tiendaOnlineOrderAmountsSchema,
    lineCount: z.number().int().min(0),
    /** The order's own instant at QAB. Displayed; NOT the sort key (ADR 0057). */
    qabCreatedAt: z.string().datetime().nullable(),
    /** When this POS wrote the row. The sort key. */
    createdAt: z.string().datetime(),
    /**
     * The session holds `.gestionar` in THIS order's owning store. Lets the
     * screen disable a control it may not use. Convenience for the UI, NOT the
     * security boundary: the PATCH re-checks server side and answers 403.
     */
    canManage: z.boolean(),
  })
  .strict();
export type ITiendaOnlineOrderListItem = z.infer<
  typeof tiendaOnlineOrderListItemSchema
>;

/**
 * The full order. `lineCount` is dropped: `lines.length` is the same number and
 * two copies of one fact drift.
 */
export const tiendaOnlineOrderSchema = tiendaOnlineOrderListItemSchema
  .omit({ lineCount: true })
  .extend({
    contactPhone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactAddress: z.string().nullable(),
    /**
     * The wa.me link QAB composed. `null` when there is none to offer, and the
     * ONLY thing the button is decided on: cuadrecaja never inspects
     * `contactPhone` and never rebuilds this (ADR 0066).
     *
     * `qabWhatsappUrlSchema` checks the HOST and not only the scheme. The mapper
     * satisfies it by construction, so a hand-edited row turns into `null`
     * instead of failing the whole detail response.
     */
    customerWhatsappUrl: qabWhatsappUrlSchema.nullable(),
    notes: z.string().nullable(),
    rateSnapshot: tiendaOnlineRateSnapshotInfoSchema.nullable(),
    lines: z.array(tiendaOnlineOrderLineSchema),
  })
  .strict();
export type ITiendaOnlineOrder = z.infer<typeof tiendaOnlineOrderSchema>;

/** Response of GET /api/tienda-online/pedidos. Extends the F-004 scaffold. */
export const tiendaOnlineOrdersPageSchema = tiendaOnlineScaffoldSchema
  .extend({
    orders: z.array(tiendaOnlineOrderListItemSchema),
    /** `PedidoEntrante.id` to pass back as `cursor`, or null on the last page. */
    nextCursor: z.string().uuid().nullable(),
    /**
     * Acceptance criterion 7. Scoped to the SAME stores as `orders`, computed by
     * `countUnattendedTiendaOnlineOrders` in the same request (ADR 0058).
     */
    unattendedCount: z.number().int().min(0),
    /**
     * Orders of this business whose `storeExternalId` never resolved to a store
     * (`tiendaId: null`). They are in NO scope, so they are in no page and
     * nobody can act on them; the number is here so the fact is visible even
     * though the rows are not (ADR 0056).
     */
    unassignedCount: z.number().int().min(0),
  })
  .strict();
export type ITiendaOnlineOrdersPage = z.infer<
  typeof tiendaOnlineOrdersPageSchema
>;

/** Response of GET /api/tienda-online/pedidos/[pedidoId]. */
export const tiendaOnlineOrderDetailSchema = tiendaOnlineScaffoldSchema
  .extend({ order: tiendaOnlineOrderSchema })
  .strict();
export type ITiendaOnlineOrderDetail = z.infer<
  typeof tiendaOnlineOrderDetailSchema
>;

/** Query of GET /api/tienda-online/pedidos. No status or date filters. */
export const tiendaOnlineOrdersQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX)
      .optional(),
  })
  .strict();
export type ITiendaOnlineOrdersQuery = z.infer<
  typeof tiendaOnlineOrdersQuerySchema
>;

/* -------------------------------------------------------------------------- */
/* F-012 — reporting an order's progress                                       */
/* -------------------------------------------------------------------------- */

/**
 * Body of `PATCH /api/tienda-online/pedidos/[pedidoId]/status`.
 *
 * SHAPE ONLY, and the shape is now the SIX values QAB accepts. The other three
 * of QAB_ORDER_STATUSES answer 400 INVALID_BODY here, which is acceptance
 * criterion 2 for `AWAITING_CUSTOMER`.
 *
 * It does NOT validate the transition: whether this destination makes sense from
 * the order's current state is a product rule that lives in
 * `offerOrderStatusTransitions` and feeds the screen (ADR 0065).
 */
export const pedidoEntranteStatusReportSchema = z
  .object({ status: z.enum(QAB_ORDER_STATUS_REPORTABLE) })
  .strict();
export type IPedidoEntranteStatusReport = z.infer<
  typeof pedidoEntranteStatusReportSchema
>;

/**
 * The 200 of that PATCH.
 *
 * `persisted: false` means QAB accepted and the local row did not change: the
 * buyer already sees `status` and this POS does not. It is NOT an error, and it
 * is why the response says so instead of pretending (ADR 0063).
 */
export const tiendaOnlineOrderStatusResultSchema = z
  .object({
    /** The status QAB now holds. Echo of the accepted request, never a guess. */
    status: z.enum(QAB_ORDER_STATUS_REPORTABLE),
    persisted: z.boolean(),
  })
  .strict();
export type ITiendaOnlineOrderStatusResult = z.infer<
  typeof tiendaOnlineOrderStatusResultSchema
>;

/**
 * The 502 of that PATCH. Same shape the slug forecast already uses, for the same
 * reason: the QAB status is never mirrored (ADR 0022, ADR 0064).
 *
 * `retryable` says whether the SCREEN may offer a person the button again. The
 * server retried nothing.
 */
export const tiendaOnlineOrderStatusErrorSchema = z
  .object({
    error: z.literal(TIENDA_ONLINE_API_ERRORS.qabStatusUpstream),
    qabError: z.enum(QAB_ORDER_STATUS_FAILURE_CODES),
    retryable: z.boolean(),
  })
  .strict();
export type ITiendaOnlineOrderStatusError = z.infer<
  typeof tiendaOnlineOrderStatusErrorSchema
>;
