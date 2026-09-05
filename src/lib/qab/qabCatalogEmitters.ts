import {
  QAB_CATEGORY_CASCADE_MAX_BUSINESSES,
  QAB_CURRENCY_ENTITY,
  QAB_CURRENCY_FANOUT_MAX_BUSINESSES,
  QAB_EXCHANGE_RATE_ENTITY,
} from "@/constants/qab";
import type { PrismaClientLike } from "@/lib/prisma";
import { enqueueOutboxEvents } from "@/lib/qab/outboxEnqueue";
import {
  planQabCategoryCascade,
  planQabCurrencyFanout,
} from "@/lib/qab/qabCatalogEmission";
import type {
  IQabCategoryEmissionRow,
  IQabCurrencyEmissionRow,
  IQabExchangeRateEmissionRow,
} from "@/lib/qab/qabCatalogEmission";
import {
  readQabCategoryCarriers,
  readQabCurrencyCarriers,
  readSyncedCurrencyCodes,
} from "@/lib/qab/qabCatalogOutboxFilters";
import {
  buildQabCurrencyPayload,
  buildQabExchangeRatePayload,
} from "@/lib/qab/qabCurrencyPayload";
import { isQabAnchorCurrency } from "@/schemas/qabCurrency";
import type { IOutboxEventoCreate, IQabOutboxOperation } from "@/schemas/qabOutbox";

/**
 * The impure orchestrators the already-existing mutation routes call. Each one
 * runs INSIDE the transaction of its own mutation, so a rollback takes the
 * events with it.
 *
 * Every one of them checks `Negocio.tiendaOnlineHabilitada` before enqueueing:
 * none of these routes sits behind the module's gate, and the drain filters a
 * disabled business's rows out of its own claim (ADR 0021), so a row written for
 * a disabled business would stay pending forever and the purge of F-019 would
 * not collect it either.
 */

export interface IQabFanoutResult {
  /** Rows written to OutboxEvento. Zero is a normal outcome, not a failure. */
  emitted: number;
  /** The carrier cap was reached and some businesses were left out. */
  truncated: boolean;
}

const NOTHING_EMITTED: IQabFanoutResult = { emitted: 0, truncated: false };

/** `operacion` of the two entities that ignore it. Never "DELETE" (criterion 15). */
const CURRENCY_OPERATION: IQabOutboxOperation = "UPDATE";

/**
 * The switch, read from the DATABASE through the caller's transaction client.
 * Fails closed: a business that does not exist is not enabled.
 */
async function isNegocioTiendaOnlineEnabled(
  tx: PrismaClientLike,
  negocioId: string,
): Promise<boolean> {
  const negocio = await tx.negocio.findUnique({
    where: { id: negocioId },
    select: { tiendaOnlineHabilitada: true },
  });
  return negocio?.tiendaOnlineHabilitada === true;
}

/**
 * The CATEGORY events one category mutation owes.
 *
 *  - NOT global (`esGlobal: false`): at most ONE event, in the owning business's
 *    outbox, and only when that business has the online store enabled.
 *  - GLOBAL (`esGlobal: true`): the cascade of `readQabCategoryCarriers`.
 *    Creating a global category emits NOTHING (no carrier has synced it yet);
 *    its lazy bootstrap covers it. Criterion 17.
 */
export async function emitQabCategoryEvents(
  tx: PrismaClientLike,
  args: {
    categoria: IQabCategoryEmissionRow;
    esGlobal: boolean;
    /** `Categoria.negocioId`. `null` for a global one. */
    ownerNegocioId: string | null;
    operacion: IQabOutboxOperation;
    occurredAt: Date;
  },
): Promise<IQabFanoutResult> {
  if (!args.esGlobal) {
    if (args.ownerNegocioId === null) return NOTHING_EMITTED;
    const enabled = await isNegocioTiendaOnlineEnabled(tx, args.ownerNegocioId);
    if (!enabled) return NOTHING_EMITTED;

    const events = planQabCategoryCascade({
      occurredAt: args.occurredAt,
      categoria: args.categoria,
      operacion: args.operacion,
      carrierNegocioIds: [args.ownerNegocioId],
    });
    await enqueueOutboxEvents(tx, events);
    return { emitted: events.length, truncated: false };
  }

  const carriers = await readQabCategoryCarriers(tx, {
    categoriaId: args.categoria.categoriaId,
    limit: QAB_CATEGORY_CASCADE_MAX_BUSINESSES,
  });

  const events = planQabCategoryCascade({
    occurredAt: args.occurredAt,
    categoria: args.categoria,
    operacion: args.operacion,
    carrierNegocioIds: carriers.negocioIds,
  });
  await enqueueOutboxEvents(tx, events);

  return { emitted: events.length, truncated: carriers.truncated };
}

/**
 * The CURRENCY events one mutation of the GLOBAL `Moneda` row owes (criterion 18).
 * Fan-out through `readQabCurrencyCarriers`, capped at
 * QAB_CURRENCY_FANOUT_MAX_BUSINESSES.
 */
export async function emitQabCurrencyFanout(
  tx: PrismaClientLike,
  args: { moneda: IQabCurrencyEmissionRow; occurredAt: Date },
): Promise<IQabFanoutResult> {
  const carriers = await readQabCurrencyCarriers(tx, {
    code: args.moneda.code,
    limit: QAB_CURRENCY_FANOUT_MAX_BUSINESSES,
  });

  if (carriers.negocioIds.length === 0) {
    return { emitted: 0, truncated: carriers.truncated };
  }

  const events = planQabCurrencyFanout({
    occurredAt: args.occurredAt,
    moneda: args.moneda,
    carrierNegocioIds: carriers.negocioIds,
  });
  await enqueueOutboxEvents(tx, events);

  return { emitted: events.length, truncated: carriers.truncated };
}

/**
 * ONE CURRENCY event in ONE business's outbox: what enabling a `NegocioMoneda`
 * owes. Emits nothing when the business's online store is disabled.
 */
export async function emitQabCurrencyForNegocio(
  tx: PrismaClientLike,
  args: { negocioId: string; moneda: IQabCurrencyEmissionRow; occurredAt: Date },
): Promise<IQabFanoutResult> {
  const enabled = await isNegocioTiendaOnlineEnabled(tx, args.negocioId);
  if (!enabled) return NOTHING_EMITTED;

  const events = planQabCurrencyFanout({
    occurredAt: args.occurredAt,
    moneda: args.moneda,
    carrierNegocioIds: [args.negocioId],
  });
  await enqueueOutboxEvents(tx, events);

  return { emitted: events.length, truncated: false };
}

/**
 * ONE EXCHANGE_RATE event, plus the CURRENCY that must precede it when this
 * business never synced that code (asymmetry 5b, criterion 13). Both go in ONE
 * `enqueueOutboxEvents` call, CURRENCY first. Emits nothing when the business's
 * online store is disabled, and never for QAB_ANCHOR_CURRENCY_CODE.
 */
export async function emitQabExchangeRateEvent(
  tx: PrismaClientLike,
  args: {
    negocioId: string;
    moneda: IQabCurrencyEmissionRow | null;
    tasa: IQabExchangeRateEmissionRow;
    occurredAt: Date;
  },
): Promise<IQabFanoutResult> {
  if (isQabAnchorCurrency(args.tasa.code)) return NOTHING_EMITTED;

  const enabled = await isNegocioTiendaOnlineEnabled(tx, args.negocioId);
  if (!enabled) return NOTHING_EMITTED;

  const events: IOutboxEventoCreate[] = [];

  if (args.moneda !== null) {
    const synced = await readSyncedCurrencyCodes(tx, {
      negocioId: args.negocioId,
      codes: [args.moneda.code],
    });
    if (!synced.has(args.moneda.code)) {
      // CURRENCY FIRST, in the same statement: without it the other side
      // invents the currency with `name === symbol === code`, provisionally,
      // and nothing goes back to fix it.
      events.push({
        negocioId: args.negocioId,
        entidad: QAB_CURRENCY_ENTITY,
        entidadId: args.moneda.code,
        operacion: CURRENCY_OPERATION,
        payload: buildQabCurrencyPayload({
          code: args.moneda.code,
          nombre: args.moneda.nombre,
          simbolo: args.moneda.simbolo,
          activo: args.moneda.activo,
          occurredAt: args.occurredAt,
        }),
        ocurridoAt: args.occurredAt,
      });
    }
  }

  events.push({
    negocioId: args.negocioId,
    entidad: QAB_EXCHANGE_RATE_ENTITY,
    entidadId: args.tasa.code,
    operacion: CURRENCY_OPERATION,
    payload: buildQabExchangeRatePayload({
      negocioId: args.negocioId,
      monedaCode: args.tasa.code,
      tasa: args.tasa.tasa,
      occurredAt: args.occurredAt,
    }),
    ocurridoAt: args.occurredAt,
  });

  await enqueueOutboxEvents(tx, events);
  return { emitted: events.length, truncated: false };
}
