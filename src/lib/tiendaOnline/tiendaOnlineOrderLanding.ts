import type { Prisma } from "@prisma/client";

import { PEDIDO_ONLINE_MOVEMENT_TYPES } from "@/constants/movimientos";
import {
  TIENDA_ONLINE_CREDIT_TENANT_ERROR,
  TIENDA_ONLINE_ORDER_LANDING_BLOCKERS,
} from "@/constants/tiendaOnline";
import { buildTasaSnapshot, missingRateCodes } from "@/lib/currency";
import { lockActiveRow } from "@/lib/dbLocks";
import { CreateMoviento, MOVIMIENTO_TX_OPTIONS } from "@/lib/movimiento";
import { prisma } from "@/lib/prisma";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import { withTenantScope } from "@/lib/tenantScope";
import {
  buildOnlineSaleAmounts,
  buildOnlineSaleLines,
  orderMovementMotivo,
  planOrderLandingEffect,
  planReservationItems,
  planReservationRelease,
  selectReservableLines,
} from "@/lib/tiendaOnline/orderLandingPlan";
import type {
  IOrderLandingEffect,
  IReservationCandidate,
  ISkippedOrderLine,
} from "@/lib/tiendaOnline/orderLandingPlan";
import { writeTiendaOnlineOrderStatus } from "@/lib/tiendaOnline/tiendaOnlineOrders";
import type { IPedidoEntrantePago } from "@/schemas/tiendaOnline";

/**
 * The impure half of the online-order landing: the transaction, the SQL and
 * nothing else.
 *
 * It touches Prisma, so it is NOT importable from a test (E-015). Every decision
 * that fits in the pure layer lives in `orderLandingPlan.ts`; what is left here
 * is orchestration.
 *
 * See ADR 0071, ADR 0072 and its amendment, and ADR 0073.
 */

export type IOrderLandingBlocker =
  (typeof TIENDA_ONLINE_ORDER_LANDING_BLOCKERS)[number];

/** Typed against the constant so a typo does not compile. */
const BLOCKER_NO_OPEN_PERIOD = "NO_OPEN_PERIOD" satisfies IOrderLandingBlocker;
const BLOCKER_UNKNOWN_TRANSFER_DESTINATION =
  "UNKNOWN_TRANSFER_DESTINATION" satisfies IOrderLandingBlocker;
const BLOCKER_MISSING_EXCHANGE_RATE =
  "MISSING_EXCHANGE_RATE" satisfies IOrderLandingBlocker;
const BLOCKER_UNKNOWN_CLIENTE = "UNKNOWN_CLIENTE" satisfies IOrderLandingBlocker;

/** The one destination whose landing needs the three local conditions. */
const SELL_EFFECT = "SELL" satisfies IOrderLandingEffect;
const NONE_EFFECT = "NONE" satisfies IOrderLandingEffect;
const RESERVE_EFFECT = "RESERVE" satisfies IOrderLandingEffect;
const RELEASE_EFFECT = "RELEASE" satisfies IOrderLandingEffect;

/** One row changed: anything else is a write that did not land (E-024). */
const WRITTEN_ROW_COUNT = 1;

/** Prisma's unique-constraint violation. Caught around the sale's insert. */
const UNIQUE_VIOLATION_CODE = "P2002";

/**
 * The local reasons a DELIVERED cannot land, checked BEFORE QAB is called
 * (ADR 0073). Returns `null` for any status other than DELIVERED — READY and
 * IN_TRANSIT are NOT checked here even though QAB refuses them on an unquoted
 * order: that guard belongs to the contract and repeating it would be a second
 * paraphrased copy of someone else's rule (E-014).
 *
 * - NO_OPEN_PERIOD               no CierrePeriodo with `fechaFin: null` on this store
 * - UNKNOWN_TRANSFER_DESTINATION `pago.transferDestinationId` is not of THIS store
 * - UNKNOWN_CLIENTE              `pago.clienteId` is not of THIS BUSINESS. The
 *                                only one of the four scoped to the business and
 *                                not to the store, because that is where
 *                                `Cliente` hangs from (ADR 0130)
 * - MISSING_EXCHANGE_RATE        the order's currency cannot be converted to the
 *                                business's monedaBase without inventing a rate.
 *                                It defers to `missingRateCodes`, which is THE
 *                                definition of «the rates a sale needs» in this
 *                                codebase (E-014) — an order already denominated
 *                                in the base currency needs none, and the CUP
 *                                anchor is never required to have a row.
 *
 * Reads only. Writes nothing, calls nothing.
 */
export async function findOrderLandingBlocker(params: {
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  status: IQabOrderStatusReportable;
  pago?: IPedidoEntrantePago;
}): Promise<IOrderLandingBlocker | null> {
  const { negocioId, tiendaId, pedidoId, status, pago } = params;
  if (planOrderLandingEffect(status) !== SELL_EFFECT) return null;

  const [periodo, pedido, negocio, tasasCambio] = await Promise.all([
    prisma.cierrePeriodo.findFirst({
      where: { tiendaId, fechaFin: null },
      select: { id: true },
    }),
    prisma.pedidoEntrante.findUnique({
      where: { id_negocioId: { id: pedidoId, negocioId } },
      select: { currencyCode: true },
    }),
    prisma.negocio.findUnique({
      where: { id: negocioId },
      select: { monedaBase: true },
    }),
    prisma.tasaCambio.findMany({
      where: { negocioId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (periodo === null) return BLOCKER_NO_OPEN_PERIOD;

  if (pago !== undefined && pago.transferDestinationId !== undefined) {
    // By store and NOT by business: a destination of another store of the same
    // business is refused just the same.
    const destination = await prisma.transferDestinations.findFirst({
      where: { id: pago.transferDestinationId, tiendaId },
      select: { id: true },
    });
    if (destination === null) return BLOCKER_UNKNOWN_TRANSFER_DESTINATION;
  }

  if (pago !== undefined && pago.clienteId !== undefined) {
    // By BUSINESS and never by store. This is the ONE place in this file where
    // the scope is negocioId: `Cliente` hangs from Negocio
    // (@@unique([nombre, negocioId])), while `TransferDestinations` above hangs
    // from Tienda (@@unique([nombre, tiendaId])). Copying the neighbour's
    // `tiendaId` filter here would refuse every legitimate customer AND stop
    // discriminating the case this guard exists for.
    //
    // `negocioId` is the parameter this function received, which the PATCH took
    // from `session.user.negocio.id`. NEVER from the body: `pago` carries no
    // business of its own and could not be trusted with one.
    //
    // NO `deletedAt` filter, on purpose and matching the POS: a soft deleted
    // customer still answers for a debt, and losing the debt is worse than
    // showing a deleted name (see `resolveCreditCustomer` in
    // `src/lib/cuentasPorCobrar/creditCustomer.ts`, branch 2).
    const cliente = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { id: pago.clienteId }, negocioId),
      select: { id: true },
    });
    if (cliente === null) return BLOCKER_UNKNOWN_CLIENTE;
  }

  // The order is gone: there is nothing to convert and nothing to land. It is
  // not this guard's business to answer for it — the status write reports 0
  // rows and the outcome says so.
  if (pedido === null || negocio === null) return null;

  const missing = missingRateCodes(
    buildTasaSnapshot(tasasCambio),
    negocio.monedaBase,
    [pedido.currencyCode],
  );
  if (missing.length > 0) return BLOCKER_MISSING_EXCHANGE_RATE;

  return null;
}

export interface IOrderLandingOutcome {
  /** Rows changed by the status write: 1, or 0 when the row is gone (E-024). */
  written: number;
  effect: IOrderLandingEffect;
  /** Distinct ProductoTienda rows whose existencia changed. */
  reservedProducts: number;
  skipped: ISkippedOrderLine[];
  /** The sale of this order, whether this call created it or found it existing. */
  ventaId: string | null;
  /**
   * FALSE when THIS call produced the effect, TRUE when it found it already
   * done. Set by the three places that discover it and by no other:
   * the reservation claim matching 0 rows, the release matching 0 rows, and the
   * sale that was already there. Always FALSE for NONE.
   * See the amendment to ADR 0072.
   */
  alreadyLanded: boolean;
}

/** The outcome of a status write that changed no row. Nothing else runs. */
function nothingWritten(): IOrderLandingOutcome {
  return {
    written: 0,
    effect: NONE_EFFECT,
    reservedProducts: 0,
    skipped: [],
    ventaId: null,
    alreadyLanded: false,
  };
}

function landedNothing(
  effect: IOrderLandingEffect,
  alreadyLanded: boolean,
): IOrderLandingOutcome {
  return {
    written: WRITTEN_ROW_COUNT,
    effect,
    reservedProducts: 0,
    skipped: [],
    ventaId: null,
    alreadyLanded,
  };
}

function creditTenantError(): Error & { code: string } {
  const error = new Error(TIENDA_ONLINE_CREDIT_TENANT_ERROR) as Error & {
    code: string;
  };
  // `orderStatusWriteFailureCause` reads `code` and NEVER `message` (E-031). The
  // literal is fixed and carries nothing of the request.
  error.code = TIENDA_ONLINE_CREDIT_TENANT_ERROR;
  return error;
}

/** True when the thrown value is a unique-constraint violation. Never its message. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}

/**
 * Writes the new status AND its business effect, in ONE transaction, so
 * «status says CONFIRMED» and «the reservation exists» can never diverge.
 *
 * The steps, in this order:
 *
 *  1. `writeTiendaOnlineOrderStatus({ ..., tx })`. `count !== 1` returns an
 *     outcome that lands nothing — the order is gone.
 *  2. `planOrderLandingEffect(status)`. `NONE` returns right there.
 *  3. RESERVE: claim `stockReservedAt` with the conditional `updateMany` of ADR
 *     0072. `count === 0` means it was already reserved — return with
 *     `reservedProducts: 0`, `alreadyLanded: true` and no error: that IS
 *     criterion 9.
 *  4. RELEASE: release `stockReservedAt` with the mirror `updateMany`.
 *     `count === 0` means there was never a live reservation — that IS
 *     criterion 10, and no movement is written.
 *  5. SELL: resolve the open `CierrePeriodo`, build the amounts and the lines,
 *     and create the `Venta` with `pedidoEntranteId`. The stock is NOT touched
 *     and no `VENTA` movement is written (ADR 0071).
 *
 * `usuarioId` always comes from the authenticated session of the PATCH, never
 * from the body — the same rule `CreateMoviento` already enforces.
 *
 * Runs with MOVIMIENTO_TX_OPTIONS: `CreateMoviento` receives this `tx` as its
 * `externalTx`, so its movements commit or roll back with the status write.
 */
export async function landTiendaOnlineOrderStatus(params: {
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  usuarioId: string;
  status: IQabOrderStatusReportable;
  pago?: IPedidoEntrantePago;
}): Promise<IOrderLandingOutcome> {
  try {
    return await runLanding(params);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another delivery of this order won the race for `Venta.pedidoEntranteId`
    // and its sale is the one that stands. A constraint violation poisons the
    // transaction it happened in, so this whole attempt rolled back: run it
    // once more, and this time the sale is already there to be found. Bounded
    // to ONE retry, because the second pass can no longer reach the insert.
    return runLanding(params);
  }
}

async function runLanding(params: {
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  usuarioId: string;
  status: IQabOrderStatusReportable;
  pago?: IPedidoEntrantePago;
}): Promise<IOrderLandingOutcome> {
  const { negocioId, tiendaId, pedidoId, usuarioId, status, pago } = params;

  return prisma.$transaction(async (tx) => {
    const written = await writeTiendaOnlineOrderStatus({
      negocioId,
      pedidoId,
      status,
      tx,
    });
    if (written !== WRITTEN_ROW_COUNT) return nothingWritten();

    const effect = planOrderLandingEffect(status);
    if (effect === NONE_EFFECT) return landedNothing(effect, false);
    if (effect === RESERVE_EFFECT) {
      return reserveStock({ tx, negocioId, tiendaId, pedidoId, usuarioId });
    }
    if (effect === RELEASE_EFFECT) {
      return releaseStock({ tx, negocioId, tiendaId, pedidoId, usuarioId });
    }
    return sellOrder({ tx, negocioId, tiendaId, pedidoId, usuarioId, pago });
  }, MOVIMIENTO_TX_OPTIONS);
}

/* -------------------------------------------------------------------------- */
/* RESERVE — the stock leaves the store                                        */
/* -------------------------------------------------------------------------- */

async function reserveStock(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  usuarioId: string;
}): Promise<IOrderLandingOutcome> {
  const { tx, negocioId, tiendaId, pedidoId, usuarioId } = args;

  // ONE conditional UPDATE, never a read-then-write: two concurrent landings
  // serialise on the row lock and the second one matches zero rows (ADR 0072).
  const claimed = await tx.pedidoEntrante.updateMany({
    where: { id: pedidoId, negocioId, stockReservedAt: null },
    data: { stockReservedAt: new Date() },
  });
  if (claimed.count === 0) return landedNothing(RESERVE_EFFECT, true);

  const lineas = await tx.pedidoEntranteLinea.findMany({
    where: { pedidoId, negocioId },
    select: { id: true, storeProductExternalId: true, quantity: true },
    orderBy: { id: "asc" },
  });

  const candidateIds = [
    ...new Set(
      lineas
        .map((linea) => linea.storeProductExternalId)
        .filter((value): value is string => value !== null),
    ),
  ].sort();

  // Locks first, in ascending id, so two landings sharing a product cannot
  // deadlock. Locking an id that does not resolve is a no-op.
  for (const id of candidateIds) {
    await lockActiveRow(tx, "ProductoTienda", id);
  }

  // ONE findMany for the whole order, never one per line. `tiendaId` is the
  // store that OWNS the order, already validated against `negocioId` by the
  // gate: a row of another business simply is not here, and its line leaves as
  // PRODUCT_NOT_RESOLVED.
  const rows =
    candidateIds.length === 0
      ? []
      : await tx.productoTienda.findMany({
          where: { id: { in: candidateIds }, tiendaId, deletedAt: null },
          select: {
            id: true,
            productoId: true,
            proveedorId: true,
            existencia: true,
          },
        });

  const catalog = new Map<string, IReservationCandidate>(
    rows.map((row) => [
      row.id,
      {
        productoTiendaId: row.id,
        productoId: row.productoId,
        proveedorId: row.proveedorId,
        existencia: row.existencia,
      },
    ]),
  );

  const { targets, skipped } = selectReservableLines({
    lineas: lineas.map((linea) => ({
      lineaId: linea.id,
      storeProductExternalId: linea.storeProductExternalId,
      cantidad: Number(linea.quantity),
    })),
    catalog,
  });

  if (targets.length > 0) {
    await CreateMoviento(
      {
        tipo: PEDIDO_ONLINE_MOVEMENT_TYPES.reserve,
        tiendaId,
        usuarioId,
        referenciaId: pedidoId,
        motivo: orderMovementMotivo(pedidoId),
      },
      planReservationItems(targets),
      tx,
    );
  }

  return {
    written: WRITTEN_ROW_COUNT,
    effect: RESERVE_EFFECT,
    reservedProducts: targets.length,
    skipped,
    ventaId: null,
    alreadyLanded: false,
  };
}

/* -------------------------------------------------------------------------- */
/* RELEASE — the stock comes back                                              */
/* -------------------------------------------------------------------------- */

/** The live reservation movements of one order, with what they took. */
async function readLiveReservations(
  tx: Prisma.TransactionClient,
  tiendaId: string,
  pedidoId: string,
) {
  return tx.movimientoStock.findMany({
    where: {
      tiendaId,
      tipo: PEDIDO_ONLINE_MOVEMENT_TYPES.reserve,
      referenciaId: pedidoId,
    },
    select: {
      cantidad: true,
      productoTiendaId: true,
      productoTienda: { select: { productoId: true, proveedorId: true } },
    },
  });
}

async function releaseStock(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  usuarioId: string;
}): Promise<IOrderLandingOutcome> {
  const { tx, negocioId, tiendaId, pedidoId, usuarioId } = args;

  const released = await tx.pedidoEntrante.updateMany({
    where: { id: pedidoId, negocioId, stockReservedAt: { not: null } },
    data: { stockReservedAt: null },
  });
  // Zero rows means there is no live reservation, and the two causes of that —
  // already released, or never reserved (criterion 10) — are indistinguishable
  // from here. Nothing is written and nothing is claimed about which it was.
  if (released.count === 0) return landedNothing(RELEASE_EFFECT, true);

  const movimientos = await readLiveReservations(tx, tiendaId, pedidoId);

  // The reverse mirrors the movements that were REALLY WRITTEN, never the
  // order's lines: a line skipped at CONFIRMED took nothing back then and must
  // give nothing back now (ADR 0072).
  const items = planReservationRelease(
    movimientos.map((movimiento) => ({
      productoTiendaId: movimiento.productoTiendaId,
      productoId: movimiento.productoTienda.productoId,
      proveedorId: movimiento.productoTienda.proveedorId,
      cantidad: movimiento.cantidad,
    })),
  );

  if (items.length > 0) {
    await CreateMoviento(
      {
        tipo: PEDIDO_ONLINE_MOVEMENT_TYPES.release,
        tiendaId,
        usuarioId,
        referenciaId: pedidoId,
        motivo: orderMovementMotivo(pedidoId),
      },
      items,
      tx,
    );
  }

  return {
    written: WRITTEN_ROW_COUNT,
    effect: RELEASE_EFFECT,
    reservedProducts: new Set(
      movimientos.map((movimiento) => movimiento.productoTiendaId),
    ).size,
    skipped: [],
    ventaId: null,
    alreadyLanded: false,
  };
}

/* -------------------------------------------------------------------------- */
/* SELL — the money, and no stock at all                                       */
/* -------------------------------------------------------------------------- */

async function sellOrder(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  tiendaId: string;
  pedidoId: string;
  usuarioId: string;
  pago?: IPedidoEntrantePago;
}): Promise<IOrderLandingOutcome> {
  const { tx, negocioId, tiendaId, pedidoId, usuarioId, pago } = args;

  // The sale of this order, if somebody already made it. Reading it first is
  // what turns the ordinary repeat of criterion 9 into an answer instead of a
  // constraint violation; the `@unique` behind it is still what makes a second
  // sale impossible under a real race (ADR 0072).
  const existing = await tx.venta.findFirst({
    where: { pedidoEntranteId: pedidoId },
    select: { id: true },
  });
  if (existing !== null) {
    return {
      written: WRITTEN_ROW_COUNT,
      effect: SELL_EFFECT,
      reservedProducts: 0,
      skipped: [],
      ventaId: existing.id,
      alreadyLanded: true,
    };
  }

  // `pago` is guaranteed by the body schema for this destination; without it
  // there is no declaration to record and nothing legitimate to write.
  if (pago === undefined) return landedNothing(SELL_EFFECT, false);

  // `clienteRow` is the seventh read and the ONLY one scoped to the business:
  // every other row here hangs off the store.
  const [periodo, pedido, negocio, tasasCambio, lineas, movimientos, clienteRow] =
    await Promise.all([
      tx.cierrePeriodo.findFirst({
        where: { tiendaId, fechaFin: null },
        orderBy: { fechaInicio: "desc" },
        select: { id: true },
      }),
      tx.pedidoEntrante.findUnique({
        where: { id_negocioId: { id: pedidoId, negocioId } },
        select: { total: true, currencyCode: true },
      }),
      tx.negocio.findUnique({
        where: { id: negocioId },
        select: { monedaBase: true },
      }),
      tx.tasaCambio.findMany({
        where: { negocioId },
        orderBy: { createdAt: "desc" },
      }),
      tx.pedidoEntranteLinea.findMany({
        where: { pedidoId, negocioId },
        select: {
          id: true,
          storeProductExternalId: true,
          quantity: true,
          unitPrice: true,
        },
        orderBy: { id: "asc" },
      }),
      readLiveReservations(tx, tiendaId, pedidoId),
      pago?.clienteId === undefined
        ? Promise.resolve(null)
        : tx.cliente.findFirst({
            where: withTenantScope("cliente", { id: pago.clienteId }, negocioId),
            select: { id: true },
          }),
    ]);

  if (pedido === null || negocio === null) return landedNothing(SELL_EFFECT, false);

  const tasas = buildTasaSnapshot(tasasCambio);
  const amounts = buildOnlineSaleAmounts({
    pedidoTotal: Number(pedido.total),
    pedidoCurrencyCode: pedido.currencyCode,
    monedaBase: negocio.monedaBase,
    tasas,
    pago,
  });

  // The debt is written against the row the TENANT-SCOPED query returned, never
  // against the id the body sent. Unreachable through the PATCH — step 6 already
  // refused a customer of another business before QAB was called — and it is here
  // so a future second caller of `landTiendaOnlineOrderStatus` cannot open a debt
  // across tenants. It throws instead of landing a sale without its debt: the
  // caller's catch rolls the whole transaction back, writes ONE divergence line
  // and answers `persisted: false`, which is the recoverable state ADR 0063
  // designed for exactly this.
  if (amounts.creditoBase > 0 && clienteRow === null) {
    throw creditTenantError();
  }

  const reservedProductoTiendaIds = new Set(
    movimientos.map((movimiento) => movimiento.productoTiendaId),
  );
  const costRows =
    reservedProductoTiendaIds.size === 0
      ? []
      : await tx.productoTienda.findMany({
          // No `deletedAt` filter: a row soft-deleted between CONFIRMED and
          // DELIVERED still carries the cost the sale happened at.
          where: { id: { in: [...reservedProductoTiendaIds] }, tiendaId },
          select: { id: true, costo: true, monedaCostoCode: true },
        });

  const saleLines = buildOnlineSaleLines({
    lineas: lineas.map((linea) => ({
      lineaId: linea.id,
      storeProductExternalId: linea.storeProductExternalId,
      cantidad: Number(linea.quantity),
      unitPrice: Number(linea.unitPrice),
    })),
    reservedProductoTiendaIds,
    costs: new Map(
      costRows.map((row) => [
        row.id,
        { costo: row.costo, monedaCostoCode: row.monedaCostoCode },
      ]),
    ),
    pedidoCurrencyCode: pedido.currencyCode,
  });

  // The lines are written with a nested `create` and NOT with a `createMany`:
  // a `skipDuplicates` over derived rows neither fails nor writes, and the sale
  // would carry new totals with an old breakdown (E-024).
  const venta = await tx.venta.create({
    data: {
      tiendaId,
      usuarioId,
      pedidoEntranteId: pedidoId,
      total: amounts.total,
      totalcash: amounts.totalcash,
      totaltransfer: amounts.totaltransfer,
      monedaCobro: amounts.monedaCobro,
      pagosDetalle: amounts.pagosDetalle,
      creditoBase: amounts.creditoBase,
      ...(amounts.creditoBase > 0 &&
        clienteRow !== null && { clienteId: clienteRow.id }),
      ...(amounts.transferDestinationId !== undefined && {
        transferDestinationId: amounts.transferDestinationId,
      }),
      ...(periodo !== null && { cierrePeriodoId: periodo.id }),
      ...(Object.keys(tasas).length > 0 && { tasaSnapshot: tasas }),
      productos: { create: saleLines },
    },
    select: { id: true, createdAt: true },
  });

  // The debt, in the SAME transaction as the sale and immediately after it —
  // the pattern F-032 fixed for the POS sale route and this one replicates
  // without redesigning it. If anything later in this transaction fails, the
  // debt is undone with the sale.
  //
  // ZERO rows in MovimientoCuentaPorCobrar: opening a debt is not a movement of
  // the ledger, and `applyMovimientoCuentaPorCobrar` is the writer of that
  // ledger, not of this row.
  if (amounts.creditoBase > 0 && clienteRow !== null) {
    await tx.cuentaPorCobrar.create({
      data: {
        ventaId: venta.id,
        clienteId: clienteRow.id,
        // The SAME variable already persisted as Venta.tiendaId. Never re-read
        // from the body or from a route param: TENANT_RELATION_PATH reaches
        // negocioId through this column alone.
        tiendaId,
        // Venta.createdAt itself, which is what the column's own comment says
        // it holds. There is no offline queue on this route: the sale is being
        // created now and the two timestamps are the same instant.
        fechaVenta: venta.createdAt,
        // Both from the SAME figure and unrounded: rounding here and not in
        // Venta.creditoBase would drift the two apart by a cent.
        montoOriginal: amounts.creditoBase,
        saldoPendiente: amounts.creditoBase,
        settledAt: null,
        // Informative only. This is the first feature that has a second
        // currency to note, which is what the column's comment anticipated.
        monedaDeudaCode: amounts.monedaDeudaCode ?? null,
        montoDeudaMonedaOriginal: amounts.montoDeudaMonedaOriginal ?? null,
      },
    });
  }

  // The stock is NOT touched here and no VENTA movement is written: the goods
  // left the store at CONFIRMED and this only formalises the collection
  // (ADR 0071). That is what makes criterion 8 hold by construction.
  return {
    written: WRITTEN_ROW_COUNT,
    effect: SELL_EFFECT,
    reservedProducts: 0,
    skipped: [],
    ventaId: venta.id,
    alreadyLanded: false,
  };
}
