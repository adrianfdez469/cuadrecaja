import {
  QAB_CATALOG_EMISSION_ERRORS,
  QAB_CATEGORY_ENTITY,
  QAB_CURRENCY_ENTITY,
  QAB_EXCHANGE_RATE_ENTITY,
  QAB_PRODUCT_ENTITY,
} from "@/constants/qab";
import { buildQabCategoryPayload } from "@/lib/qab/qabCategoryPayload";
import {
  buildQabCurrencyPayload,
  buildQabExchangeRatePayload,
} from "@/lib/qab/qabCurrencyPayload";
import { buildQabProductPayload } from "@/lib/qab/qabProductPayload";
import { isQabAnchorCurrency } from "@/schemas/qabCurrency";
import type {
  IOutboxEventoCreate,
  IQabOutboxOperation,
} from "@/schemas/qabOutbox";

/**
 * The PURE half of the emission: it decides WHICH events one mutation owes and
 * in WHICH ORDER, and it never touches the database.
 *
 * The order of the returned array is the whole point. The caller hands it to
 * `enqueueOutboxEvents` in ONE statement, so the outbox ids come out ascending
 * in this exact order and the drain — which claims `ORDER BY o.id` — preserves
 * it into the batch. See ADR 0043.
 */

export type IQabCatalogEmissionError =
  (typeof QAB_CATALOG_EMISSION_ERRORS)[keyof typeof QAB_CATALOG_EMISSION_ERRORS];

/** One ProductoTienda row of one product, as the planner reads it. */
export interface IQabProductEmissionRow {
  productoTiendaId: string;
  tiendaId: string;
  productoId: string;
  /** `Producto.nombre`. */
  nombre: string;
  /** Every `CodigoProducto.codigo` of the product. `[]` when it has none. */
  barcodes: string[];
  /** `Producto.categoriaId`. */
  categoriaId: string;
  /** `ProductoTienda.precio`, raw. */
  precio: number;
  /** ALREADY RESOLVED: `monedaPrecioCode ?? Negocio.monedaBase`. */
  currencyCode: string;
  /** `Producto.productoCanonicoId`. */
  productoCanonicoId: string | null;
  /** `Producto.publicarEnTienda`, AFTER the update. */
  publicarEnTienda: boolean;
}

/** One category, as the lazy bootstrap needs it. */
export interface IQabCategoryEmissionRow {
  categoriaId: string;
  nombre: string;
  /** `Categoria.color`, raw. `toQabCategoryColor` maps blank to null. */
  color: string | null;
}

/** One currency of the global `Moneda` catalog. */
export interface IQabCurrencyEmissionRow {
  code: string;
  nombre: string;
  simbolo: string;
  activo: boolean;
}

/** The most recent `TasaCambio` of one currency for one business. */
export interface IQabExchangeRateEmissionRow {
  code: string;
  tasa: number;
}

/**
 * What this business has ALREADY synced, read from the outbox before the planner
 * runs. Anything NOT in these sets gets a bootstrap event.
 */
export interface IQabCatalogBootstrapState {
  syncedCategoriaIds: ReadonlySet<string>;
  syncedCurrencyCodes: ReadonlySet<string>;
  syncedExchangeRateCodes: ReadonlySet<string>;
}

/** `operacion` of every PRODUCT event: QAB upserts, and `publishToStore: false` unpublishes. */
const PRODUCT_OPERATION: IQabOutboxOperation = "UPDATE";
/** A bootstrap event is by definition the first one this business emits for that row. */
const BOOTSTRAP_OPERATION: IQabOutboxOperation = "CREATE";
/** CURRENCY and EXCHANGE_RATE ignore `operation`; a DELETE is never emitted for them. */
const CURRENCY_OPERATION: IQabOutboxOperation = "UPDATE";

/** The distinct values of `pick`, in the order they first appear in `rows`. */
function distinctBy<T>(rows: T[], pick: (row: T) => string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const value = pick(row);
    if (seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function indexBy<T>(rows: T[], pick: (row: T) => string): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    if (!index.has(pick(row))) index.set(pick(row), row);
  }
  return index;
}

/**
 * PURE. The whole emission of one publish/unpublish, in DEPENDENCY ORDER:
 * every bootstrap CURRENCY, then every bootstrap EXCHANGE_RATE, then every
 * bootstrap CATEGORY, then one PRODUCT per row of `productos` — the order of
 * QAB_CATALOG_EMISSION_ORDER, and the whole reason ADR 0043 exists.
 *
 * Returns ONE array. The caller hands it to `enqueueOutboxEvents` in a single
 * statement, so the outbox ids come out ascending in this exact order.
 *
 * Bootstrap rules:
 *  - a CURRENCY is emitted for every distinct `currencyCode` of `productos` that
 *    is NOT in `bootstrap.syncedCurrencyCodes` and HAS a row in `monedas`;
 *  - an EXCHANGE_RATE is emitted for such a code only when it is NOT the anchor
 *    AND `tasas` carries a rate for it AND it is not in
 *    `bootstrap.syncedExchangeRateCodes`;
 *  - a CATEGORY is emitted for every distinct `categoriaId` of `productos` that
 *    is NOT in `bootstrap.syncedCategoriaIds` and HAS a row in `categorias`.
 *
 * A code or a category the planner cannot resolve (no row supplied) emits no
 * bootstrap event and does NOT stop the PRODUCT: the product publishes with its
 * `localCategoryId` unresolved on the other side, which is what the contract
 * already does today. This is a documented degradation, not a guarantee.
 *
 * Throws QabProductPayloadError / QabCurrencyPayloadError — inside the caller's
 * transaction, which is what makes criterion 6's atomicity true.
 */
export function planQabProductPublishEvents(args: {
  negocioId: string;
  occurredAt: Date;
  productos: IQabProductEmissionRow[];
  categorias: IQabCategoryEmissionRow[];
  monedas: IQabCurrencyEmissionRow[];
  tasas: IQabExchangeRateEmissionRow[];
  bootstrap: IQabCatalogBootstrapState;
}): IOutboxEventoCreate[] {
  const { negocioId, occurredAt, productos, bootstrap } = args;

  const monedaByCode = indexBy(args.monedas, (row) => row.code);
  const tasaByCode = indexBy(args.tasas, (row) => row.code);
  const categoriaById = indexBy(args.categorias, (row) => row.categoriaId);

  const currencyCodes = distinctBy(productos, (row) => row.currencyCode).filter(
    (code) =>
      !bootstrap.syncedCurrencyCodes.has(code) && monedaByCode.has(code),
  );

  const currencyEvents: IOutboxEventoCreate[] = currencyCodes.map((code) => {
    const moneda = monedaByCode.get(code) as IQabCurrencyEmissionRow;
    return {
      negocioId,
      entidad: QAB_CURRENCY_ENTITY,
      entidadId: code,
      operacion: BOOTSTRAP_OPERATION,
      payload: buildQabCurrencyPayload({
        code: moneda.code,
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        activo: moneda.activo,
        occurredAt,
      }),
      ocurridoAt: occurredAt,
    };
  });

  const exchangeRateEvents: IOutboxEventoCreate[] = currencyCodes
    .filter(
      (code) =>
        !isQabAnchorCurrency(code) &&
        tasaByCode.has(code) &&
        !bootstrap.syncedExchangeRateCodes.has(code),
    )
    .map((code) => ({
      negocioId,
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: code,
      operacion: BOOTSTRAP_OPERATION,
      payload: buildQabExchangeRatePayload({
        negocioId,
        monedaCode: code,
        tasa: (tasaByCode.get(code) as IQabExchangeRateEmissionRow).tasa,
        occurredAt,
      }),
      ocurridoAt: occurredAt,
    }));

  const categoryEvents: IOutboxEventoCreate[] = distinctBy(
    productos,
    (row) => row.categoriaId,
  )
    .filter(
      (categoriaId) =>
        !bootstrap.syncedCategoriaIds.has(categoriaId) &&
        categoriaById.has(categoriaId),
    )
    .map((categoriaId) => {
      const categoria = categoriaById.get(
        categoriaId,
      ) as IQabCategoryEmissionRow;
      return {
        negocioId,
        entidad: QAB_CATEGORY_ENTITY,
        entidadId: categoriaId,
        operacion: BOOTSTRAP_OPERATION,
        payload: buildQabCategoryPayload({
          negocioId,
          categoriaId,
          nombre: categoria.nombre,
          color: categoria.color,
          occurredAt,
        }),
        ocurridoAt: occurredAt,
      };
    });

  const productEvents: IOutboxEventoCreate[] = productos.map((row) => ({
    negocioId,
    entidad: QAB_PRODUCT_ENTITY,
    entidadId: row.productoTiendaId,
    operacion: PRODUCT_OPERATION,
    payload: buildQabProductPayload({
      negocioId,
      productoTiendaId: row.productoTiendaId,
      tiendaId: row.tiendaId,
      productoId: row.productoId,
      nombre: row.nombre,
      barcodes: row.barcodes,
      categoriaId: row.categoriaId,
      precio: row.precio,
      currencyCode: row.currencyCode,
      productoCanonicoId: row.productoCanonicoId,
      publicarEnTienda: row.publicarEnTienda,
      occurredAt,
    }),
    ocurridoAt: occurredAt,
  }));

  return [
    ...currencyEvents,
    ...exchangeRateEvents,
    ...categoryEvents,
    ...productEvents,
  ];
}

/**
 * PURE. One CATEGORY event per carrier business.
 *
 * `businessId` of each payload is built INSIDE the loop, from that carrier's own
 * id — never from a variable captured once outside. An event sitting in B's
 * outbox that carries A's `businessId` makes QAB answer `403 BUSINESS_MISMATCH`
 * and REJECT B'S WHOLE BATCH, stopping the sync of a business that did nothing.
 * That is the reason this function takes the ids and does the loop itself instead
 * of taking a prebuilt payload.
 */
export function planQabCategoryCascade(args: {
  occurredAt: Date;
  categoria: IQabCategoryEmissionRow;
  operacion: IQabOutboxOperation;
  carrierNegocioIds: string[];
}): IOutboxEventoCreate[] {
  return args.carrierNegocioIds.map((carrierNegocioId) => ({
    negocioId: carrierNegocioId,
    entidad: QAB_CATEGORY_ENTITY,
    entidadId: args.categoria.categoriaId,
    operacion: args.operacion,
    payload: buildQabCategoryPayload({
      // The carrier's OWN id, read from the loop variable on every iteration.
      negocioId: carrierNegocioId,
      categoriaId: args.categoria.categoriaId,
      nombre: args.categoria.nombre,
      color: args.categoria.color,
      occurredAt: args.occurredAt,
    }),
    ocurridoAt: args.occurredAt,
  }));
}

/**
 * PURE. One CURRENCY event per carrier business. The PAYLOAD is identical for all
 * of them — CURRENCY carries no `businessId` — and only `OutboxEvento.negocioId`
 * varies: which business's token happens to carry it is not observable from the
 * payload, and no carrier gains anything by carrying it. See ADR 0044.
 * `operacion` is always "UPDATE": `DELETE` is ignored by the receiver and the way
 * to retire a currency is `active: false`.
 */
export function planQabCurrencyFanout(args: {
  occurredAt: Date;
  moneda: IQabCurrencyEmissionRow;
  carrierNegocioIds: string[];
}): IOutboxEventoCreate[] {
  const payload = buildQabCurrencyPayload({
    code: args.moneda.code,
    nombre: args.moneda.nombre,
    simbolo: args.moneda.simbolo,
    activo: args.moneda.activo,
    occurredAt: args.occurredAt,
  });

  return args.carrierNegocioIds.map((carrierNegocioId) => ({
    negocioId: carrierNegocioId,
    entidad: QAB_CURRENCY_ENTITY,
    entidadId: args.moneda.code,
    operacion: CURRENCY_OPERATION,
    payload,
    ocurridoAt: args.occurredAt,
  }));
}
