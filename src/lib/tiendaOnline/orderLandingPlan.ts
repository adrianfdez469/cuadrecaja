import {
  TIENDA_ONLINE_ORDER_LANDING_EFFECTS,
  TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS,
  TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX,
} from "@/constants/tiendaOnline";
import { convertToBase } from "@/lib/currency";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import type { IMovimientoCreate } from "@/schemas/movimiento";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IPedidoEntrantePago } from "@/schemas/tiendaOnline";

/**
 * Every decision of landing an online order in this POS that does not need the
 * database, and the file the suite imports.
 *
 * A plain `.ts`: it pulls in `zod`-derived TYPES, constants and
 * `@/lib/currency`, and NOTHING from Prisma or React — no symbol living behind
 * either of those is importable from a test (E-015). The orchestration and the
 * SQL live in `tiendaOnlineOrderLanding.ts`, which is not importable and holds
 * no decision this file could have taken.
 *
 * See ADR 0071 (the two moments), ADR 0072 (identity and idempotency) and
 * ADR 0073 (the money).
 */

export type IOrderLandingEffect =
  (typeof TIENDA_ONLINE_ORDER_LANDING_EFFECTS)[number];
export type IOrderLandingSkipReason =
  (typeof TIENDA_ONLINE_ORDER_LANDING_SKIP_REASONS)[number];

/** Locale-independent ascending order of two ids. Never `localeCompare`. */
function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/* -------------------------------------------------------------------------- */
/* 1. What a reported destination does                                         */
/* -------------------------------------------------------------------------- */

/**
 * TOTAL over the six reportable values, as a lookup and not as a `switch`: a
 * seventh value added to the vocabulary tomorrow fails to compile here instead
 * of being swallowed by a `default` (ADR 0004).
 */
const EFFECT_BY_STATUS: Record<IQabOrderStatusReportable, IOrderLandingEffect> =
  {
    CONFIRMED: "RESERVE",
    READY: "NONE",
    IN_TRANSIT: "NONE",
    DELIVERED: "SELL",
    CANCELLED: "RELEASE",
    REJECTED_BY_STORE: "RELEASE",
  };

/**
 * PURE. What a reported destination does to inventory and to the books.
 *
 * CONFIRMED -> RESERVE. DELIVERED -> SELL. CANCELLED and REJECTED_BY_STORE ->
 * RELEASE. READY and IN_TRANSIT -> NONE.
 */
export function planOrderLandingEffect(
  status: IQabOrderStatusReportable,
): IOrderLandingEffect {
  return EFFECT_BY_STATUS[status];
}

/* -------------------------------------------------------------------------- */
/* 2. Which lines can be reserved                                              */
/* -------------------------------------------------------------------------- */

export interface IOrderLineForReservation {
  lineaId: string;
  /** PedidoEntranteLinea.storeProductExternalId, verbatim. */
  storeProductExternalId: string | null;
  /** PedidoEntranteLinea.quantity as a number. Always > 0. */
  cantidad: number;
}

/** One live ProductoTienda of the order's store, already read and locked. */
export interface IReservationCandidate {
  productoTiendaId: string;
  productoId: string;
  proveedorId: string | null;
  existencia: number;
}

export interface IReservationTarget {
  productoTiendaId: string;
  productoId: string;
  proveedorId: string | null;
  /** Sum of the quantities of every line of this order on this product. */
  cantidad: number;
  /** The lines this target covers, ascending. Never empty. */
  lineaIds: string[];
}

export interface ISkippedOrderLine {
  lineaId: string;
  reason: IOrderLandingSkipReason;
}

/** The three reasons, typed against the constant so a typo does not compile. */
const SKIP_NO_PRODUCT_REFERENCE =
  "NO_PRODUCT_REFERENCE" satisfies IOrderLandingSkipReason;
const SKIP_PRODUCT_NOT_RESOLVED =
  "PRODUCT_NOT_RESOLVED" satisfies IOrderLandingSkipReason;
const SKIP_INSUFFICIENT_STOCK =
  "INSUFFICIENT_STOCK" satisfies IOrderLandingSkipReason;

/**
 * PURE. Splits the order's lines into what can be reserved and what cannot.
 *
 * ALL OR NONE PER PRODUCT. Lines are grouped by `storeProductExternalId` and the
 * availability is checked against the group's TOTAL demand, so two lines on the
 * same product are either both reserved or both skipped. That is what makes the
 * set of reserved `productoTiendaId` an exact answer to «was this line sold»
 * later, at DELIVERED (ADR 0072).
 *
 * Deterministic: groups are visited in ascending `productoTiendaId`, lines
 * inside a group in ascending `lineaId`, and `skipped` comes back in ascending
 * `lineaId`. `targets` comes back in ascending `productoTiendaId` — the same
 * order the caller must take its row locks in.
 *
 * - `storeProductExternalId === null`      -> NO_PRODUCT_REFERENCE
 * - not a key of `catalog`                 -> PRODUCT_NOT_RESOLVED
 * - group demand > candidate.existencia    -> INSUFFICIENT_STOCK
 *
 * It never reads existencia from anywhere but `catalog`.
 */
export function selectReservableLines(args: {
  lineas: readonly IOrderLineForReservation[];
  /** Keyed by ProductoTienda.id. Only live rows of the order's store belong here. */
  catalog: ReadonlyMap<string, IReservationCandidate>;
}): { targets: IReservationTarget[]; skipped: ISkippedOrderLine[] } {
  const skipped: ISkippedOrderLine[] = [];
  const groups = new Map<string, { lineaIds: string[]; cantidad: number }>();

  for (const linea of args.lineas) {
    const storeProductId = linea.storeProductExternalId;
    if (storeProductId === null) {
      skipped.push({
        lineaId: linea.lineaId,
        reason: SKIP_NO_PRODUCT_REFERENCE,
      });
      continue;
    }
    const group = groups.get(storeProductId) ?? { lineaIds: [], cantidad: 0 };
    group.lineaIds.push(linea.lineaId);
    group.cantidad += linea.cantidad;
    groups.set(storeProductId, group);
  }

  const targets: IReservationTarget[] = [];
  const keys = [...groups.keys()].sort(compareIds);

  for (const storeProductId of keys) {
    const group = groups.get(storeProductId);
    const lineaIds = [...group.lineaIds].sort(compareIds);
    const candidate = args.catalog.get(storeProductId);

    if (candidate === undefined) {
      for (const lineaId of lineaIds) {
        skipped.push({ lineaId, reason: SKIP_PRODUCT_NOT_RESOLVED });
      }
      continue;
    }
    if (group.cantidad > candidate.existencia) {
      for (const lineaId of lineaIds) {
        skipped.push({ lineaId, reason: SKIP_INSUFFICIENT_STOCK });
      }
      continue;
    }

    targets.push({
      productoTiendaId: candidate.productoTiendaId,
      productoId: candidate.productoId,
      proveedorId: candidate.proveedorId,
      cantidad: group.cantidad,
      lineaIds,
    });
  }

  targets.sort((a, b) => compareIds(a.productoTiendaId, b.productoTiendaId));
  skipped.sort((a, b) => compareIds(a.lineaId, b.lineaId));
  return { targets, skipped };
}

/* -------------------------------------------------------------------------- */
/* 3. The items of the two CreateMoviento calls                                */
/* -------------------------------------------------------------------------- */

/**
 * PURE. The `items` of the CreateMoviento call that reserves. One entry per
 * target, in the order the targets came, each carrying its own `proveedorId` so
 * CreateMoviento resolves the SAME ProductoTienda row that was checked here —
 * a product with and without supplier has two rows in the same store.
 */
export function planReservationItems(
  targets: readonly IReservationTarget[],
): IMovimientoCreate[] {
  return targets.map((target) => ({
    productoId: target.productoId,
    cantidad: target.cantidad,
    ...(target.proveedorId !== null && { proveedorId: target.proveedorId }),
  }));
}

/** One live reservation movement of an order, as the release needs to read it. */
export interface IReservationMovement {
  productoTiendaId: string;
  productoId: string;
  proveedorId: string | null;
  cantidad: number;
}

/**
 * PURE. The `items` of the CreateMoviento call that gives the stock back.
 *
 * Mirrors the movements that were REALLY WRITTEN, never the order's lines: a
 * line skipped at CONFIRMED took nothing and must give nothing back (ADR 0072).
 * Ascending `productoTiendaId`, same lock order as the reservation.
 */
export function planReservationRelease(
  movements: readonly IReservationMovement[],
): IMovimientoCreate[] {
  return [...movements]
    .sort((a, b) => compareIds(a.productoTiendaId, b.productoTiendaId))
    .map((movement) => ({
      productoId: movement.productoId,
      cantidad: movement.cantidad,
      ...(movement.proveedorId !== null && {
        proveedorId: movement.proveedorId,
      }),
    }));
}

/* -------------------------------------------------------------------------- */
/* 4. The money of the sale                                                    */
/* -------------------------------------------------------------------------- */

export interface IOnlineSaleAmounts {
  /** In the business's monedaBase. This is `Venta.total`. */
  total: number;
  totalcash: number;
  totaltransfer: number;
  /**
   * The part of `total` handed over on credit. `total` for CREDITO, 0 for the
   * other two. This is `Venta.creditoBase`, and it is a COLUMN and never a line
   * of `pagosDetalle` (ADR 0104).
   */
  creditoBase: number;
  /** The order's own currency: what the buyer agreed to pay in. */
  monedaCobro: string;
  /** Exactly one line, or NONE for CREDITO and for a zero-total order. */
  pagosDetalle: IPagoLinea[];
  /** Only for TRANSFERENCIA. `Venta.transferDestinationId`. */
  transferDestinationId?: string;
  /**
   * Informative only, and present ONLY for CREDITO: the order's own denomination
   * of the debt, so the customer can be told "you owe 20 USD". NO arithmetic
   * reads these — the debt is denominated in base currency. They are the two
   * columns `CuentaPorCobrar` reserved and that F-029 left for this feature to
   * be the first to write.
   */
  monedaDeudaCode?: string;
  montoDeudaMonedaOriginal?: number;
}

/** The declared method that moves the amount to the transfer column. */
const PAYMENT_TRANSFER = "TRANSFERENCIA";

/** The declared method whose amount is a debt and not money in the drawer. */
const PAYMENT_CREDIT = "CREDITO";

/**
 * PURE. The money of the sale an online order becomes.
 *
 *   total = convertToBase(pedidoTotal, pedidoCurrencyCode, tasas, monedaBase)
 *
 * When the order is already in the business's base currency — the ordinary case
 * — `convertToBase` divides a rate by itself and the result is `pedidoTotal` to
 * the cent. That is how criterion 5 is read: `Venta.total` IS the order's total,
 * expressed in monedaBase.
 *
 * The rates are cuadrecaja's own (`TasaCambio`), NEVER the order's opaque
 * `rateSnapshot` (ADR 0060, ADR 0073). Nothing here rounds: `convertToBase` is
 * the only arithmetic.
 *
 * EFECTIVO puts the whole `total` in `totalcash` and 0 in `totaltransfer`;
 * TRANSFERENCIA does the mirror. `pagosDetalle` carries ONE line, with the
 * ORDER's amount and currency and its `equivalenteBase`, so the closing reads
 * it exactly like a POS sale. A `pedidoTotal` of 0 yields `pagosDetalle: []`,
 * because `pagoLineaSchema.monto` is `positive()` and a zero line would not
 * validate.
 *
 * CREDITO is the third branch (ADR 0130) and it invents NO arithmetic: `total`
 * is the same `convertToBase` as the other two, and everything else is a zero
 * or an absence — `totalcash: 0`, `totaltransfer: 0`, `pagosDetalle: []` and
 * the whole `total` in `creditoBase`. No line of payment is what keeps the
 * period's cash untouched without the closing engine knowing anything about
 * credit: `buildResumenMonedas` walks `pagosDetalle` and there is nothing to
 * walk.
 */
export function buildOnlineSaleAmounts(args: {
  pedidoTotal: number;
  pedidoCurrencyCode: string;
  monedaBase: string;
  tasas: ITasaSnapshot;
  pago: IPedidoEntrantePago;
}): IOnlineSaleAmounts {
  const { pedidoTotal, pedidoCurrencyCode, monedaBase, tasas, pago } = args;

  const total = convertToBase(
    pedidoTotal,
    pedidoCurrencyCode,
    tasas,
    monedaBase,
  );
  const isTransfer = pago.metodo === PAYMENT_TRANSFER;
  const isCredit = pago.metodo === PAYMENT_CREDIT;
  const transferDestinationId = isTransfer
    ? pago.transferDestinationId
    : undefined;

  const pagosDetalle: IPagoLinea[] =
    pedidoTotal > 0 && !isCredit
      ? [
          {
            tipo: isTransfer ? "transfer" : "cash",
            moneda: pedidoCurrencyCode,
            monto: pedidoTotal,
            equivalenteBase: total,
            ...(transferDestinationId !== undefined && {
              transferDestinationId,
            }),
          },
        ]
      : [];

  return {
    total,
    totalcash: isTransfer || isCredit ? 0 : total,
    totaltransfer: isTransfer ? total : 0,
    creditoBase: isCredit ? total : 0,
    monedaCobro: pedidoCurrencyCode,
    pagosDetalle,
    ...(transferDestinationId !== undefined && { transferDestinationId }),
    ...(isCredit && {
      monedaDeudaCode: pedidoCurrencyCode,
      montoDeudaMonedaOriginal: pedidoTotal,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* 5. The lines of the sale                                                    */
/* -------------------------------------------------------------------------- */

export interface IOnlineSaleLineSource {
  lineaId: string;
  storeProductExternalId: string | null;
  cantidad: number;
  /** PedidoEntranteLinea.unitPrice as a number, in the ORDER's currency. */
  unitPrice: number;
}

/** Cost snapshot of one ProductoTienda, read at DELIVERED. */
export interface IOnlineSaleLineCost {
  costo: number;
  monedaCostoCode: string | null;
}

export interface IOnlineSaleLine {
  productoTiendaId: string;
  cantidad: number;
  precio: number;
  monedaPrecioCode: string;
  costo: number;
  monedaCostoCode: string | null;
}

/**
 * PURE. The `VentaProducto` rows of an online order's sale.
 *
 * ONE row per order line whose product was reserved. Price and currency are
 * copied VERBATIM from the line (ADR 0062): `precio = unitPrice`,
 * `monedaPrecioCode = pedidoCurrencyCode`. Cost comes from `costs`, read at
 * DELIVERED (ADR 0071 names the imprecision that accepts).
 *
 * A line whose product is NOT in `reservedProductoTiendaIds` produces NO row:
 * `VentaProducto.productoTiendaId` is a required FK and there is nothing to
 * point at. It IS still inside `Venta.total`, which comes from the order — the
 * same thing `deliveryFee` already does, since it is no product either.
 *
 * A reserved product missing from `costs` gets `costo: 0` and
 * `monedaCostoCode: null`. It must not throw: the row can be soft-deleted
 * between CONFIRMED and DELIVERED, and the sale still happened.
 *
 * Ascending `lineaId`.
 */
export function buildOnlineSaleLines(args: {
  lineas: readonly IOnlineSaleLineSource[];
  reservedProductoTiendaIds: ReadonlySet<string>;
  costs: ReadonlyMap<string, IOnlineSaleLineCost>;
  pedidoCurrencyCode: string;
}): IOnlineSaleLine[] {
  const lines: IOnlineSaleLine[] = [];
  const ordered = [...args.lineas].sort((a, b) =>
    compareIds(a.lineaId, b.lineaId),
  );

  for (const linea of ordered) {
    const productoTiendaId = linea.storeProductExternalId;
    if (productoTiendaId === null) continue;
    if (!args.reservedProductoTiendaIds.has(productoTiendaId)) continue;

    const cost = args.costs.get(productoTiendaId);
    lines.push({
      productoTiendaId,
      cantidad: linea.cantidad,
      precio: linea.unitPrice,
      monedaPrecioCode: args.pedidoCurrencyCode,
      costo: cost === undefined ? 0 : cost.costo,
      monedaCostoCode: cost === undefined ? null : cost.monedaCostoCode,
    });
  }

  return lines;
}

/* -------------------------------------------------------------------------- */
/* 6. The reason line of both movements                                        */
/* -------------------------------------------------------------------------- */

/**
 * PURE. `MovimientoStock.motivo` for both landing movements: the prefix and the
 * ORDER ID. NEVER `PedidoEntrante.code`, which is the buyer page's public
 * credential (ADR 0061) and this string is shown in the movements list.
 * `formatMovimientoMotivo` already shortens the UUID to `#xxxxxxxx` when that
 * list renders it.
 */
export function orderMovementMotivo(pedidoId: string): string {
  return `${TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX} ${pedidoId}`;
}
