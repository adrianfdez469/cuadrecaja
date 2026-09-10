import { Prisma } from "@prisma/client";
import { MIN_OPEN_BALANCE_BASE } from "@/lib/cuentasPorCobrar/aging";
import { MOVIMIENTO_CUENTA_POR_COBRAR_SIGN } from "@/lib/cuentasPorCobrar/saldo";
import { convertToBase } from "@/lib/currency";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ---------------------------------------------------------- the vocabulary */

/**
 * Every way a movement can be refused, in the order they are evaluated. THE ORDER IS THE
 * CONTRACT and the first one to fire wins — same shape as CREDIT_INVARIANT_VIOLATIONS.
 */
export const MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS = [
  "MONTO_NO_POSITIVO",
  "REVIERTE_ID_INESPERADO",
  "REVERSION_SIN_REVIERTE_ID",
  "REVERSION_ORIGEN_INALCANZABLE",
  "REVERSION_ORIGEN_NO_ES_ABONO",
  "REVERSION_DUPLICADA",
  "REVERSION_MONTO_DISTINTO",
  "SALDO_INSUFICIENTE",
] as const;

export type IMovimientoCuentaPorCobrarViolation =
  (typeof MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS)[number];

/**
 * The HTTP status each violation gets, declared once so the three routes do not restate it.
 *
 * REVERSION_ORIGEN_INALCANZABLE is a 404 and covers BOTH "the movement does not exist" and
 * "it belongs to another account": the two answer identically so the route is not an oracle
 * for ids of another account, and therefore of another business (ADR 0077).
 */
export const MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS: Record<
  IMovimientoCuentaPorCobrarViolation,
  400 | 404 | 409
> = {
  MONTO_NO_POSITIVO: 400,
  REVIERTE_ID_INESPERADO: 400,
  REVERSION_SIN_REVIERTE_ID: 400,
  REVERSION_ORIGEN_INALCANZABLE: 404,
  REVERSION_ORIGEN_NO_ES_ABONO: 400,
  REVERSION_DUPLICADA: 409,
  REVERSION_MONTO_DISTINTO: 400,
  SALDO_INSUFICIENTE: 400,
};

/* ------------------------------------------------------------ the pure core */

/** The minimum the decision needs to read from the movement being reversed. */
export interface IMovimientoOrigenRow {
  id: string;
  cuentaPorCobrarId: string;
  tipo: ITipoMovimientoCuentaPorCobrar;
  monto: number;
}

export interface IMovimientoDecisionInput {
  cuentaId: string;
  tipo: ITipoMovimientoCuentaPorCobrar;
  /** Positive, in base currency. */
  monto: number;
  /** The balance of the account read UNDER THE ROW LOCK, never one read earlier. */
  saldoPendiente: number;
  /** The instant the movement is dated. It is what `settledAt` gets when the debt closes. */
  fecha: Date;
  revierteId?: string | null;
  /**
   * The row `revierteId` resolved to INSIDE this account, or null. Passing null for a lookup
   * that was not performed is how "not found" and "not asked" say the same thing here — same
   * figure as resolveCreditCustomer.
   */
  origen: IMovimientoOrigenRow | null;
  /** Whether `origen` already carries a REVERSION_ABONO. */
  origenYaRevertido: boolean;
}

/**
 * A FLAT shape rather than a discriminated union, for the same reason ICreditInvariantResult is
 * flat: `strict` is off in this project, so a boolean discriminant does not narrow (E-036).
 * Callers read `result.violation === null`.
 */
export interface IMovimientoDecision {
  ok: boolean;
  violation: IMovimientoCuentaPorCobrarViolation | null;
  /** The balance AFTER applying, rounded to two decimals. When refused, the balance unchanged. */
  saldoPendiente: number;
  /** `fecha` when the resulting balance is at or below MIN_OPEN_BALANCE_BASE, else null. */
  settledAt: Date | null;
}

/**
 * PURE: no Prisma, no clock, no network (E-015). Decides whether a movement can be applied and
 * what the account looks like afterwards. It never throws.
 *
 * The new balance is `saldoPendiente + MOVIMIENTO_CUENTA_POR_COBRAR_SIGN[tipo] * monto`, rounded
 * to two decimals. It applies the sign map of `src/lib/cuentasPorCobrar/saldo.ts`, which is the
 * only definition of that sign, to the DENORMALIZED column — it does not recompute the balance
 * from the ledger, which is what `computeSaldoAlCierre` is for and what the closing engine uses
 * against a cutoff.
 *
 * `settledAt` is RECOMPUTED on every application, never only set: a REVERSION_ABONO that lifts a
 * settled account back above MIN_OPEN_BALANCE_BASE returns null and the account goes live again.
 *
 * SALDO_INSUFICIENTE fires only for the types whose sign is -1, and with a tolerance of
 * MIN_OPEN_BALANCE_BASE, so an amount EQUAL to the balance is accepted and only an amount above
 * it is refused. Worked: with saldoPendiente 500, monto 500 is accepted (500 > 500.01 is false)
 * and monto 700 is refused.
 */
export function decideMovimientoCuentaPorCobrar(
  input: IMovimientoDecisionInput,
): IMovimientoDecision {
  const saldoActual = round2(Number(input.saldoPendiente) || 0);
  const monto = Number(input.monto);
  const origen = input.origen ?? null;
  const revierteId = input.revierteId ?? null;

  const refuse = (
    violation: IMovimientoCuentaPorCobrarViolation,
  ): IMovimientoDecision => ({
    ok: false,
    violation,
    saldoPendiente: saldoActual,
    settledAt: null,
  });

  // The order below is § 3.1 of the contract, guard by guard. The first one to fire wins.
  if (!Number.isFinite(monto) || !(monto > 0)) return refuse("MONTO_NO_POSITIVO");

  if (revierteId && input.tipo !== "REVERSION_ABONO") {
    return refuse("REVIERTE_ID_INESPERADO");
  }

  if (input.tipo === "REVERSION_ABONO" && !revierteId) {
    return refuse("REVERSION_SIN_REVIERTE_ID");
  }

  if (
    input.tipo === "REVERSION_ABONO" &&
    (origen === null || origen.cuentaPorCobrarId !== input.cuentaId)
  ) {
    return refuse("REVERSION_ORIGEN_INALCANZABLE");
  }

  if (origen !== null && origen.tipo !== "ABONO") {
    return refuse("REVERSION_ORIGEN_NO_ES_ABONO");
  }

  if (origen !== null && input.origenYaRevertido === true) {
    return refuse("REVERSION_DUPLICADA");
  }

  if (origen !== null && round2(Number(origen.monto) || 0) !== round2(monto)) {
    return refuse("REVERSION_MONTO_DISTINTO");
  }

  const sign = MOVIMIENTO_CUENTA_POR_COBRAR_SIGN[input.tipo];
  if (sign === -1 && monto > saldoActual + MIN_OPEN_BALANCE_BASE) {
    return refuse("SALDO_INSUFICIENTE");
  }

  const nuevoSaldo = round2(saldoActual + sign * monto);

  return {
    ok: true,
    violation: null,
    saldoPendiente: nuevoSaldo,
    settledAt: nuevoSaldo <= MIN_OPEN_BALANCE_BASE ? input.fecha : null,
  };
}

/* ----------------------------------------------------- the valuation helper */

export interface IAbonoValuationInput {
  /** Lines as they arrive, without equivalenteBase. */
  pagos: Array<{
    tipo: "cash" | "transfer";
    moneda: string;
    monto: number;
    transferDestinationId?: string;
  }>;
  tasas: ITasaSnapshot;
  monedaBase: string;
}

export interface IAbonoValuation {
  /** The lines completed with the equivalenteBase the SERVER computed. Persisted verbatim. */
  pagosDetalle: IPagoLinea[];
  /** Sum of equivalenteBase, rounded to two decimals. This is the movement's `monto`. */
  montoBase: number;
}

/**
 * PURE. Values a collection in base currency with `convertToBase`, line by line, and returns the
 * lines with their `equivalenteBase` filled in.
 *
 * The shape of `pagosDetalle` is IPagoLinea[] VERBATIM — the same one Venta.pagosDetalle carries —
 * so `buildResumenMonedas` consumes sales and collections through one function and there is no
 * second definition of what "money in the drawer" means (dosier § 5).
 *
 * It does NOT read the client's `equivalenteBase`: the request schema omits the field, and the
 * rate comes from the business's own TasaCambio rows (ADR 0118). The caller is what rejects a
 * missing rate with `missingRateCodes` BEFORE calling this: `convertToBase` converts at 1 in
 * silence when a rate is absent.
 *
 * Worked, with monedaBase "CUP" and tasas { USD: 120 }:
 *   [{ tipo: "cash", moneda: "USD", monto: 100 }] -> montoBase 12000
 *   [{ tipo: "cash", moneda: "USD", monto: 50 }]  -> montoBase 6000
 */
export function valueAbonoPagos(input: IAbonoValuationInput): IAbonoValuation {
  const lineas = Array.isArray(input?.pagos) ? input.pagos : [];
  const tasas = input?.tasas ?? {};
  const monedaBase = input?.monedaBase ?? "CUP";

  const pagosDetalle: IPagoLinea[] = lineas.map((linea) => {
    const monto = Number(linea?.monto) || 0;
    const equivalenteBase = convertToBase(
      monto,
      linea?.moneda,
      tasas,
      monedaBase,
    );

    return {
      tipo: linea.tipo,
      moneda: linea.moneda,
      monto,
      equivalenteBase,
      ...(linea.transferDestinationId
        ? { transferDestinationId: linea.transferDestinationId }
        : {}),
    };
  });

  const montoBase = round2(
    pagosDetalle.reduce((sum, linea) => sum + linea.equivalenteBase, 0),
  );

  return { pagosDetalle, montoBase };
}

/* ---------------------------------------------------------------- the door */

export interface INuevoMovimientoCuentaPorCobrar {
  tipo: ITipoMovimientoCuentaPorCobrar;
  /** Positive, in base currency. */
  monto: number;
  /** Defaults to now. */
  fecha?: Date;
  pagosDetalle?: IPagoLinea[] | null;
  tasaSnapshot?: ITasaSnapshot | null;
  motivo?: string | null;
  usuarioId?: string | null;
  /** Only for REVERSION_ABONO: the ABONO being undone. */
  revierteId?: string | null;
}

export interface IMovimientoCuentaPorCobrarApplied {
  movimientoId: string;
  /** The recomputed CuentaPorCobrar.saldoPendiente after the insert. */
  saldoPendiente: number;
  /** Set when the balance reached zero, null while the account is still live. */
  settledAt: Date | null;
}

/** Thrown by the door when the decision refuses. Carries what the route needs for its body. */
export class MovimientoCuentaPorCobrarError extends Error {
  readonly violation: IMovimientoCuentaPorCobrarViolation;
  /** The account balance at the moment of the refusal. */
  readonly saldoPendiente: number;

  constructor(
    violation: IMovimientoCuentaPorCobrarViolation,
    saldoPendiente: number,
  ) {
    super(`MovimientoCuentaPorCobrar refused: ${violation}`);
    this.name = "MovimientoCuentaPorCobrarError";
    this.violation = violation;
    this.saldoPendiente = saldoPendiente;
  }
}

/** The account row this helper locks before deciding anything. */
type LockedCuentaRow = {
  id: string;
  saldoPendiente: number;
  settledAt: Date | null;
};

/**
 * A nullable Json column is written with `Prisma.JsonNull`, never with a bare `null`: the
 * generated input type does not accept the literal, and `DbNull` would mean "SQL NULL" for a
 * column whose readers already treat absence as "this movement moved no physical money".
 */
function jsonOrNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

/**
 * Locks the account row inside the caller's transaction and returns its balance, or null when
 * the row is gone.
 *
 * THE ONLY declaration of that SELECT in the project (E-014), with the table name literal in the
 * template and the id parameterised. It is exported because two of the three routes need the
 * balance UNDER the lock before they can even name the amount they are about to apply — the
 * forgiveness amount IS that balance — and taking the lock twice inside one transaction is a
 * no-op, so calling it first and then the door is safe.
 */
export async function lockCuentaPorCobrar(
  tx: Prisma.TransactionClient,
  cuentaId: string,
): Promise<LockedCuentaRow | null> {
  const rows = await tx.$queryRaw<LockedCuentaRow[]>`
    SELECT "id", "saldoPendiente", "settledAt"
    FROM "CuentaPorCobrar"
    WHERE "id" = ${cuentaId}
    FOR UPDATE
  `;
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * The ONLY way to insert into MovimientoCuentaPorCobrar. Appends the row and recomputes the
 * denormalized CuentaPorCobrar.saldoPendiente and settledAt inside the caller's transaction, so
 * the ledger and its cache cannot diverge.
 *
 * `cuentaId` is the CuentaPorCobrar.id (the column is cuentaPorCobrarId).
 *
 * ITS FIRST OPERATION is `SELECT ... FOR UPDATE` over `CuentaPorCobrar`, with the table name
 * literal in the template and the id parameterised. That is what serialises two concurrent
 * movements against the SAME account: the second one decides against the balance the first one
 * left (ADR 0117). The lock lives here and not in the routes so that a fourth caller does not
 * have to remember it.
 *
 * When `movimiento.revierteId` is present, the implementation verifies, BEFORE inserting, that
 * the referenced row's cuentaPorCobrarId equals `cuentaId` — the same account, and therefore the
 * same tenant. The self-referencing FK only guarantees that the target row exists. A
 * REVERSION_ABONO pointing at another account's ABONO would move a balance that is not its own,
 * and across negocios if the two accounts belong to different ones. That is why the lookup here
 * is BY ID ALONE: the belonging check is the guard, not the `where`.
 *
 * This guard is half of why this helper is the only write door: the other half is keeping
 * saldoPendiente in step with the ledger.
 *
 * A refused decision becomes a thrown MovimientoCuentaPorCobrarError, so the caller's transaction
 * rolls back — which also releases the idempotency key it claimed, as `src/lib/idempotency.ts`
 * documents.
 *
 * A REVERSION_ABONO is written with `pagosDetalle: null` and `tasaSnapshot: null` (ADR 0120): the
 * cash effect of a reversal is a SUBTRACTION, and IPagoLinea cannot express one — `monto` is
 * `.positive()`. The sign is applied when READING, by `netCollectionRows` in
 * `src/lib/cuentasPorCobrar/cobrosNetos.ts` (ADR 0121). Nothing negative is ever persisted.
 *
 * @throws {MovimientoCuentaPorCobrarError} when the decision refuses. It always carries the
 *         account balance at the moment of the refusal, whatever the violation.
 */
export async function applyMovimientoCuentaPorCobrar(
  tx: Prisma.TransactionClient,
  cuentaId: string,
  movimiento: INuevoMovimientoCuentaPorCobrar,
): Promise<IMovimientoCuentaPorCobrarApplied> {
  // FIRST operation, always: the row lock is what serialises two concurrent movements.
  const locked = await lockCuentaPorCobrar(tx, cuentaId);

  if (!locked) {
    // The route resolved the account before opening the transaction, so this only happens if it
    // disappeared in between. A fixed message: never echo the id back (E-031).
    throw new Error("CuentaPorCobrar not found while applying a movement");
  }

  const saldoPendiente = Number(locked.saldoPendiente) || 0;
  const fecha = movimiento.fecha ?? new Date();
  const revierteId = movimiento.revierteId ?? null;

  let origen: IMovimientoOrigenRow | null = null;
  let origenYaRevertido = false;

  if (revierteId) {
    // BY ID ALONE on purpose: the belonging check is guard 4 of the decision, so the promise the
    // schema cannot keep lives in the function and not in somebody else's `where`.
    const row = await tx.movimientoCuentaPorCobrar.findUnique({
      where: { id: revierteId },
      select: { id: true, cuentaPorCobrarId: true, tipo: true, monto: true },
    });
    origen = row ?? null;

    if (origen) {
      const reversiones = await tx.movimientoCuentaPorCobrar.count({
        where: { revierteId: origen.id },
      });
      origenYaRevertido = reversiones > 0;
    }
  }

  const decision = decideMovimientoCuentaPorCobrar({
    cuentaId,
    tipo: movimiento.tipo,
    monto: movimiento.monto,
    saldoPendiente,
    fecha,
    revierteId,
    origen,
    origenYaRevertido,
  });

  if (decision.violation !== null) {
    throw new MovimientoCuentaPorCobrarError(
      decision.violation,
      decision.saldoPendiente,
    );
  }

  const creado = await tx.movimientoCuentaPorCobrar.create({
    data: {
      cuentaPorCobrarId: cuentaId,
      tipo: movimiento.tipo,
      monto: round2(Number(movimiento.monto) || 0),
      fecha,
      pagosDetalle: jsonOrNull(movimiento.pagosDetalle),
      tasaSnapshot: jsonOrNull(movimiento.tasaSnapshot),
      motivo: movimiento.motivo ?? null,
      usuarioId: movimiento.usuarioId ?? null,
      revierteId,
    },
    select: { id: true },
  });

  await tx.cuentaPorCobrar.update({
    where: { id: cuentaId },
    data: {
      saldoPendiente: decision.saldoPendiente,
      settledAt: decision.settledAt,
    },
  });

  return {
    movimientoId: creado.id,
    saldoPendiente: decision.saldoPendiente,
    settledAt: decision.settledAt,
  };
}
