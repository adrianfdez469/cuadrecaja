import { Prisma } from "@prisma/client";

import {
  QAB_PRODUCT_BULK_MAX,
  QAB_PRODUCT_PAGE_SIZE_DEFAULT,
  QAB_PRODUCT_PAGE_SIZE_MAX,
  QAB_PRODUCT_PUBLISH_AUDIT_LOG,
} from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import type { PrismaClientLike } from "@/lib/prisma";
import { enqueueOutboxEvents } from "@/lib/qab/outboxEnqueue";
import { planQabProductPublishEvents } from "@/lib/qab/qabCatalogEmission";
import type {
  IQabCategoryEmissionRow,
  IQabCurrencyEmissionRow,
  IQabExchangeRateEmissionRow,
  IQabProductEmissionRow,
} from "@/lib/qab/qabCatalogEmission";
import {
  readSyncedCategoriaIds,
  readSyncedCurrencyCodes,
  readSyncedExchangeRateCodes,
} from "@/lib/qab/qabCatalogOutboxFilters";
import {
  mergeQabProductSyncState,
  readQabProductoTiendaSyncStates,
} from "@/lib/qab/qabProductSyncState";
import { TipoLocal } from "@/schemas/tienda";
import type {
  IQabStoreSyncState,
  ITiendaOnlineBulkResult,
  ITiendaOnlineProducto,
  ITiendaOnlineProductoUpdateResult,
  ITiendaOnlineProductosPage,
} from "@/schemas/tiendaOnline";

/**
 * The listing and the two writes of the publishing tab.
 *
 * `negocioId` is in the `where` of EVERY query, and for the bulk action it goes
 * on `Producto` — in the SAME query that decides what is touched — and NEVER on
 * `Categoria`: a global category has `negocioId: null` legitimately, so its
 * ownership authorises USING it and says nothing about WHICH products may be
 * written.
 */

/** Explicit select, never the whole row (ADR 0019). Names NO forbidden column. */
export const TIENDA_ONLINE_PRODUCTO_SELECT = {
  id: true,
  nombre: true,
  categoriaId: true,
  publicarEnTienda: true,
  productoCanonicoId: true,
  categoria: { select: { id: true, nombre: true, color: true } },
  codigosProducto: { select: { codigo: true } },
  productosTienda: {
    where: { deletedAt: null, tienda: { tipo: TipoLocal.TIENDA } },
    select: {
      id: true,
      tiendaId: true,
      precio: true,
      monedaPrecioCode: true,
      tienda: { select: { nombre: true, publicarEnTienda: true } },
    },
  },
} satisfies Prisma.ProductoSelect;

export type ITiendaOnlineProductoRow = Prisma.ProductoGetPayload<{
  select: typeof TIENDA_ONLINE_PRODUCTO_SELECT;
}>;

export class TiendaOnlineProductoNotFoundError extends Error {
  constructor() {
    super("Product not found in this business");
    this.name = "TiendaOnlineProductoNotFoundError";
  }
}

export class TiendaOnlineCategoriaNotFoundError extends Error {
  constructor() {
    super("Category not visible to this business");
    this.name = "TiendaOnlineCategoriaNotFoundError";
  }
}

/** The bulk action would touch more than QAB_PRODUCT_BULK_MAX products. Nothing was written. */
export class TiendaOnlineBulkTooLargeError extends Error {
  readonly productos: number;
  readonly max: number;

  constructor(productos: number, max: number) {
    super("The bulk action would touch too many products");
    this.name = "TiendaOnlineBulkTooLargeError";
    this.productos = productos;
    this.max = max;
  }
}

const SYNCED_STATE: IQabStoreSyncState = {
  state: "SYNCED",
  code: null,
  attempts: 0,
  since: null,
};

/**
 * One line per applied write: WHO wrote WHAT, in WHICH business, and how many
 * rows it moved. No payload is a parameter, so this cannot leak a price.
 */
function recordProductoPublicacion(args: {
  usuarioId: string | null;
  negocioId: string;
  scope: string;
  scopeId: string;
  productos: number;
  eventos: number;
}): void {
  console.info(
    `${QAB_PRODUCT_PUBLISH_AUDIT_LOG} usuarioId=${args.usuarioId ?? "unknown"} negocioId=${args.negocioId} ${args.scope}=${args.scopeId} productos=${args.productos} eventos=${args.eventos}`,
  );
}

/**
 * PURE. Row projection + merged sync state + the business's base currency ->
 * what the screen receives. `monedaCode` is resolved HERE:
 * `monedaPrecioCode ?? monedaBase`, never the raw nullable column.
 */
export function toTiendaOnlineProducto(
  row: ITiendaOnlineProductoRow,
  args: { monedaBase: string; syncStates: Map<string, IQabStoreSyncState> },
): ITiendaOnlineProducto {
  const tiendas = row.productosTienda.map((productoTienda) => ({
    productoTiendaId: productoTienda.id,
    tiendaId: productoTienda.tiendaId,
    tiendaNombre: productoTienda.tienda.nombre,
    precio: productoTienda.precio,
    // "null means use the business's base currency" — resolved once, here.
    monedaCode: productoTienda.monedaPrecioCode ?? args.monedaBase,
    tiendaPublicada: productoTienda.tienda.publicarEnTienda,
  }));

  const syncState = mergeQabProductSyncState(
    tiendas.map(
      (tienda) => args.syncStates.get(tienda.productoTiendaId) ?? SYNCED_STATE,
    ),
  );

  return {
    id: row.id,
    nombre: row.nombre,
    categoriaId: row.categoriaId,
    categoriaNombre: row.categoria.nombre,
    publicarEnTienda: row.publicarEnTienda,
    barcodes: row.codigosProducto.map((codigo) => codigo.codigo),
    tiendas,
    syncState,
  };
}

/** The emission rows of one product, one per live ProductoTienda of a TIENDA. */
function toEmissionRows(
  row: ITiendaOnlineProductoRow,
  monedaBase: string,
): IQabProductEmissionRow[] {
  const barcodes = row.codigosProducto.map((codigo) => codigo.codigo);

  return row.productosTienda.map((productoTienda) => ({
    productoTiendaId: productoTienda.id,
    tiendaId: productoTienda.tiendaId,
    productoId: row.id,
    nombre: row.nombre,
    barcodes,
    categoriaId: row.categoriaId,
    precio: productoTienda.precio,
    currencyCode: productoTienda.monedaPrecioCode ?? monedaBase,
    productoCanonicoId: row.productoCanonicoId,
    publicarEnTienda: row.publicarEnTienda,
  }));
}

/** The category rows the lazy bootstrap may need, deduplicated by id. */
function toCategoryEmissionRows(
  rows: ITiendaOnlineProductoRow[],
): IQabCategoryEmissionRow[] {
  const byId = new Map<string, IQabCategoryEmissionRow>();
  for (const row of rows) {
    if (byId.has(row.categoria.id)) continue;
    byId.set(row.categoria.id, {
      categoriaId: row.categoria.id,
      nombre: row.categoria.nombre,
      color: row.categoria.color,
    });
  }
  return [...byId.values()];
}

/** The most recent `TasaCambio` of each of `codes` for this business. */
async function readLatestTasas(
  tx: PrismaClientLike,
  args: { negocioId: string; codes: string[] },
): Promise<IQabExchangeRateEmissionRow[]> {
  if (args.codes.length === 0) return [];

  const rows = await tx.tasaCambio.findMany({
    where: { negocioId: args.negocioId, monedaCode: { in: args.codes } },
    select: { monedaCode: true, tasa: true },
    // Append-only table: the current rate is the most recently created row.
    orderBy: { createdAt: "desc" },
  });

  const latest = new Map<string, IQabExchangeRateEmissionRow>();
  for (const row of rows) {
    if (latest.has(row.monedaCode)) continue;
    latest.set(row.monedaCode, { code: row.monedaCode, tasa: row.tasa });
  }
  return [...latest.values()];
}

/** The `Moneda` rows of `codes`, for the lazy bootstrap of CURRENCY. */
async function readMonedas(
  tx: PrismaClientLike,
  codes: string[],
): Promise<IQabCurrencyEmissionRow[]> {
  if (codes.length === 0) return [];

  const rows = await tx.moneda.findMany({
    where: { code: { in: codes } },
    select: { code: true, nombre: true, simbolo: true, activo: true },
  });
  return rows;
}

/**
 * Plans and enqueues everything one write of `publicarEnTienda` owes, in the
 * caller's transaction, in ONE `enqueueOutboxEvents` call so the outbox ids come
 * out in dependency order (ADR 0043).
 */
async function enqueueProductPublishEvents(
  tx: PrismaClientLike,
  args: {
    negocioId: string;
    monedaBase: string;
    occurredAt: Date;
    rows: ITiendaOnlineProductoRow[];
  },
): Promise<number> {
  const productos = args.rows.flatMap((row) =>
    toEmissionRows(row, args.monedaBase),
  );
  if (productos.length === 0) return 0;

  const categoriaIds = [...new Set(productos.map((row) => row.categoriaId))];
  const currencyCodes = [...new Set(productos.map((row) => row.currencyCode))];

  const [syncedCategoriaIds, syncedCurrencyCodes, syncedExchangeRateCodes] =
    await Promise.all([
      readSyncedCategoriaIds(tx, { negocioId: args.negocioId, categoriaIds }),
      readSyncedCurrencyCodes(tx, {
        negocioId: args.negocioId,
        codes: currencyCodes,
      }),
      readSyncedExchangeRateCodes(tx, {
        negocioId: args.negocioId,
        codes: currencyCodes,
      }),
    ]);

  // Only the codes that still need a bootstrap are looked up: an already synced
  // currency costs nothing here.
  const pendingCodes = currencyCodes.filter(
    (code) => !syncedCurrencyCodes.has(code),
  );
  const [monedas, tasas] = await Promise.all([
    readMonedas(tx, pendingCodes),
    readLatestTasas(tx, { negocioId: args.negocioId, codes: pendingCodes }),
  ]);

  const events = planQabProductPublishEvents({
    negocioId: args.negocioId,
    occurredAt: args.occurredAt,
    productos,
    categorias: toCategoryEmissionRows(args.rows),
    monedas,
    tasas,
    bootstrap: {
      syncedCategoriaIds,
      syncedCurrencyCodes,
      syncedExchangeRateCodes,
    },
  });

  // ONE statement. The insertion order is what sustains the guarantee.
  await enqueueOutboxEvents(tx, events);
  return events.length;
}

/** The states the screen shows right after a write: everything just enqueued is PENDING. */
function pendingSyncStates(
  rows: ITiendaOnlineProductoRow[],
  occurredAt: Date,
  emitted: boolean,
): Map<string, IQabStoreSyncState> {
  const states = new Map<string, IQabStoreSyncState>();
  if (!emitted) return states;

  for (const row of rows) {
    for (const productoTienda of row.productosTienda) {
      states.set(productoTienda.id, {
        state: "PENDING",
        code: null,
        attempts: 0,
        since: occurredAt.toISOString(),
      });
    }
  }
  return states;
}

/** The business's base currency. Fails closed on a business that does not exist. */
async function readMonedaBase(
  tx: PrismaClientLike,
  negocioId: string,
): Promise<string> {
  const negocio = await tx.negocio.findUnique({
    where: { id: negocioId },
    select: { monedaBase: true },
  });
  if (negocio === null) throw new TiendaOnlineProductoNotFoundError();
  return negocio.monedaBase;
}

/**
 * One page of the business's products. Cursor pagination on
 * `orderBy: [{ nombre: "asc" }, { id: "asc" }]` with `cursor: { id }` and
 * `skip: 1`: the catalog grows without bound and an offset scan would degrade.
 *
 * `negocioId` is in the `where` of EVERY query. `deletedAt: null` on both
 * `Producto` and `ProductoTienda`.
 */
export async function listTiendaOnlineProductos(params: {
  negocioId: string;
  categoriaId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
  puedePublicar: boolean;
}): Promise<ITiendaOnlineProductosPage> {
  const { negocioId } = params;
  const limit = Math.min(
    params.limit ?? QAB_PRODUCT_PAGE_SIZE_DEFAULT,
    QAB_PRODUCT_PAGE_SIZE_MAX,
  );

  const where: Prisma.ProductoWhereInput = {
    negocioId,
    deletedAt: null,
    ...(params.categoriaId ? { categoriaId: params.categoriaId } : {}),
    ...(params.search
      ? { nombre: { contains: params.search, mode: "insensitive" as const } }
      : {}),
  };

  const [negocio, rows, total] = await Promise.all([
    prisma.negocio.findUnique({
      where: { id: negocioId },
      select: { monedaBase: true },
    }),
    prisma.producto.findMany({
      where,
      select: TIENDA_ONLINE_PRODUCTO_SELECT,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
      // One more than the page, so `nextCursor` is a fact and not a guess.
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    // Counting the whole catalog on every page would be a query nobody asked
    // for: `total` is what the bulk-action confirmation announces, and there is
    // no bulk action without a category.
    params.categoriaId ? prisma.producto.count({ where }) : Promise.resolve(null),
  ]);

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null;

  const productoTiendaIds = page.flatMap((row) =>
    row.productosTienda.map((productoTienda) => productoTienda.id),
  );
  const syncStates = await readQabProductoTiendaSyncStates(
    negocioId,
    productoTiendaIds,
  );

  const monedaBase = negocio?.monedaBase ?? "";

  return {
    negocioId,
    tiendaOnlineHabilitada: true,
    productos: page.map((row) =>
      toTiendaOnlineProducto(row, { monedaBase, syncStates }),
    ),
    nextCursor,
    total,
    puedePublicar: params.puedePublicar,
  };
}

/**
 * Flips `Producto.publicarEnTienda` of ONE product and enqueues everything it
 * owes, in ONE transaction.
 *
 * Emits ONE PRODUCT event per live ProductoTienda row of the product in a local
 * of `tipo: "TIENDA"`, plus the bootstrap events its category and currencies
 * need. A product with no such row flips the column and emits ZERO PRODUCT
 * events — there is no `storeProductId` to name.
 *
 * Throws TiendaOnlineProductoNotFoundError when the product is not this
 * business's.
 */
export async function setProductoPublicacion(params: {
  negocioId: string;
  productoId: string;
  publicarEnTienda: boolean;
  usuarioId?: string;
  now?: () => Date;
}): Promise<ITiendaOnlineProductoUpdateResult> {
  const { negocioId, productoId } = params;
  const occurredAt = (params.now ?? (() => new Date()))();

  const result = await prisma.$transaction(async (tx) => {
    // The business filter goes in the `where`, never in a later `if`.
    const existing = await tx.producto.findFirst({
      where: { id: productoId, negocioId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new TiendaOnlineProductoNotFoundError();

    const monedaBase = await readMonedaBase(tx, negocioId);

    const updated = await tx.producto.update({
      // `negocioId` in the `where` of the WRITE too, not just the read.
      where: { id: productoId, negocioId },
      data: { publicarEnTienda: params.publicarEnTienda },
      select: TIENDA_ONLINE_PRODUCTO_SELECT,
    });

    const eventos = await enqueueProductPublishEvents(tx, {
      negocioId,
      monedaBase,
      occurredAt,
      rows: [updated],
    });

    return {
      producto: toTiendaOnlineProducto(updated, {
        monedaBase,
        syncStates: pendingSyncStates([updated], occurredAt, eventos > 0),
      }),
      eventos,
    };
  });

  recordProductoPublicacion({
    usuarioId: params.usuarioId ?? null,
    negocioId,
    scope: "productoId",
    scopeId: productoId,
    productos: 1,
    eventos: result.eventos,
  });

  return result;
}

/**
 * Same, for every product of ONE category, in ONE transaction: all or nothing
 * (criterion 6).
 *
 * THE TENANT FILTER GOES ON `Producto`, IN THE SAME QUERY THAT DECIDES WHAT IS
 * TOUCHED: `where: { categoriaId, negocioId, deletedAt: null }`. NEVER on
 * `Categoria` — a global category has `negocioId: null` legitimately, so its
 * ownership authorises USING it and says nothing about WHICH products may be
 * touched. Getting this wrong publishes another business's products, which is
 * the worst failure this system has.
 *
 * Throws TiendaOnlineBulkTooLargeError, BEFORE writing anything, when the count
 * exceeds QAB_PRODUCT_BULK_MAX.
 */
export async function setCategoriaPublicacionMasiva(params: {
  negocioId: string;
  categoriaId: string;
  publicarEnTienda: boolean;
  usuarioId?: string;
  now?: () => Date;
}): Promise<ITiendaOnlineBulkResult> {
  const { negocioId, categoriaId } = params;
  const occurredAt = (params.now ?? (() => new Date()))();

  const result = await prisma.$transaction(async (tx) => {
    // VISIBILITY ONLY. This says the merchant may use the category; it says
    // nothing about which products may be written, and it is never the tenant
    // filter of the write below.
    const categoria = await tx.categoria.findFirst({
      where: { id: categoriaId, OR: [{ negocioId }, { esGlobal: true }] },
      select: { id: true },
    });
    if (!categoria) throw new TiendaOnlineCategoriaNotFoundError();

    // THE tenant filter, in the same `where` that decides what is touched.
    const productoWhere: Prisma.ProductoWhereInput = {
      categoriaId,
      negocioId,
      deletedAt: null,
    };

    const productos = await tx.producto.count({ where: productoWhere });
    if (productos > QAB_PRODUCT_BULK_MAX) {
      // BEFORE writing anything: half a category published is worse than none.
      throw new TiendaOnlineBulkTooLargeError(productos, QAB_PRODUCT_BULK_MAX);
    }

    const monedaBase = await readMonedaBase(tx, negocioId);

    const written = await tx.producto.updateMany({
      where: productoWhere,
      data: { publicarEnTienda: params.publicarEnTienda },
    });

    const rows = await tx.producto.findMany({
      where: productoWhere,
      select: TIENDA_ONLINE_PRODUCTO_SELECT,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    });

    const eventos = await enqueueProductPublishEvents(tx, {
      negocioId,
      monedaBase,
      occurredAt,
      rows,
    });

    return { productos: written.count, eventos };
  });

  recordProductoPublicacion({
    usuarioId: params.usuarioId ?? null,
    negocioId,
    scope: "categoriaId",
    scopeId: categoriaId,
    productos: result.productos,
    eventos: result.eventos,
  });

  return result;
}
