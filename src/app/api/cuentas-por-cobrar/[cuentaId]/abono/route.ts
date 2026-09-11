import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  storeIdempotentResponse,
  DuplicateRequestError,
} from "@/lib/idempotency";
import {
  CUENTAS_POR_COBRAR_API_ERRORS,
  CUENTAS_POR_COBRAR_PERMISO_COBRAR,
} from "@/constants/cuentasPorCobrar";
import {
  registrarAbonoSchema,
  type IMovimientoAplicadoResponse,
} from "@/schemas/cuentasPorCobrarPanel";
import {
  applyMovimientoCuentaPorCobrar,
  MovimientoCuentaPorCobrarError,
  MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS,
  valueAbonoPagos,
} from "@/lib/cuentasPorCobrar/applyMovimiento";
import { buildMonedaOptions } from "@/utils/monedas";
import { resolveSaleTasaSnapshot } from "@/lib/tasaSnapshotResolver";
import { missingExchangeRateMessage } from "@/lib/tasaSnapshotResolver";

/** Thrown inside the transaction when the store has no open till (criterion 7). */
class SinPeriodoAbiertoError extends Error {}

/**
 * POST /api/cuentas-por-cobrar/[cuentaId]/abono — a collection against ONE account.
 *
 * The order of the steps is the contract (§ 5.2, ADR 0124) and it is not interchangeable:
 * the idempotency key is claimed as the FIRST operation of the transaction and the row lock
 * comes after it, inside the write door. `findIdempotentResponse` runs OUTSIDE the transaction —
 * a P2002 cannot be recovered from inside one (E-038).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  // Declared outside the try so the duplicate-request handler can look the stored response up.
  let claim: { key: string; scopeId: string; endpoint: string } | undefined;

  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO_COBRAR,
    });
    if (response) return response;

    const { cuentaId } = await params;

    const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: CUENTAS_POR_COBRAR_API_ERRORS.cabeceraIdempotenciaAusente },
        { status: 400 },
      );
    }

    const parsed = registrarAbonoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: CUENTAS_POR_COBRAR_API_ERRORS.cuerpoInvalido,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { pagos, motivo } = parsed.data;

    const cuenta = await prisma.cuentaPorCobrar.findFirst({
      where: withTenantScope("cuentaPorCobrar", { id: cuentaId }, negocioId),
      select: { id: true, tiendaId: true, saldoPendiente: true },
    });
    // The SAME 404 for "it does not exist" and for "it belongs to another business"
    // (criterion 13). Never a 403, which would confirm the row exists.
    if (!cuenta) return tenantNotFoundResponse();

    const [negocio, negocioMonedas] = await Promise.all([
      prisma.negocio.findUnique({
        where: { id: negocioId },
        select: { monedaBase: true },
      }),
      prisma.negocioMoneda.findMany({
        where: { negocioId },
        select: { monedaCode: true, activo: true },
      }),
    ]);
    const monedaBase = negocio?.monedaBase ?? "CUP";

    // The `filter` goes at the INPUT of buildMonedaOptions, so that function stays the only
    // place that prepends the base currency (§ 8.4). The base currency is admitted ALWAYS: it
    // has no NegocioMoneda row and therefore no `activo` to look at (criterion 6, E-059).
    const monedasAdmitidas = new Set(
      buildMonedaOptions(
        negocioMonedas.filter((m) => m.activo),
        monedaBase,
      ).map((m) => m.monedaCode),
    );

    for (const linea of pagos) {
      if (!monedasAdmitidas.has(linea.moneda)) {
        return NextResponse.json(
          { error: CUENTAS_POR_COBRAR_API_ERRORS.monedaNoAdmitida },
          { status: 400 },
        );
      }
    }

    const at = new Date();

    // The rate is the SERVER's, never the client's (ADR 0125): the request schema omits
    // `equivalenteBase` altogether.
    const { snapshot, missing } = await resolveSaleTasaSnapshot({
      negocioId,
      monedaBase,
      clientSnapshot: null,
      momento: at,
      monedas: pagos.map((linea) => linea.moneda),
    });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: missingExchangeRateMessage(missing) },
        { status: 400 },
      );
    }

    const destinos = [
      ...new Set(
        pagos
          .filter((linea) => linea.transferDestinationId)
          .map((linea) => linea.transferDestinationId as string),
      ),
    ];
    if (destinos.length > 0) {
      const validos = await prisma.transferDestinations.findMany({
        where: withTenantScope(
          "transferDestinations",
          { id: { in: destinos }, tiendaId: cuenta.tiendaId },
          negocioId,
        ),
        select: { id: true },
      });
      if (validos.length !== destinos.length) {
        return NextResponse.json(
          { error: CUENTAS_POR_COBRAR_API_ERRORS.destinoTransferenciaInvalido },
          { status: 400 },
        );
      }
    }

    // The `endpoint` carries the cuentaId, a deliberate deviation from the module constant of
    // `api/movimiento`: here the account IS the axis of the answer, and a key reused across two
    // accounts of the same business would otherwise replay the balance of the wrong one (M2).
    claim = {
      key: idempotencyKey,
      scopeId: negocioId,
      endpoint: `POST /api/cuentas-por-cobrar/${cuentaId}/abono`,
    };

    // Fast path, OUTSIDE the transaction: this collection was already applied, so replay its
    // response instead of doing the work again (criterion 8).
    const replayed =
      await findIdempotentResponse<IMovimientoAplicadoResponse>(claim);
    if (replayed) {
      return NextResponse.json(
        { ...replayed, duplicado: true },
        { status: 200 },
      );
    }

    const payload = await prisma.$transaction(async (tx) => {
      await claimIdempotencyKey(tx, claim);

      // THE authority on "is there an open till". The `cierrePeriodoAbiertoId` the GETs expose
      // is what the screen used to decide whether to mount the button; this is what decides
      // whether the collection applies. Criterion 7 demands both halves.
      const periodoAbierto = await tx.cierrePeriodo.findFirst({
        where: { tiendaId: cuenta.tiendaId, fechaFin: null },
        select: { id: true },
      });
      if (!periodoAbierto) throw new SinPeriodoAbiertoError();

      const { pagosDetalle, montoBase } = valueAbonoPagos({
        pagos,
        tasas: snapshot,
        monedaBase,
      });

      const applied = await applyMovimientoCuentaPorCobrar(tx, cuentaId, {
        tipo: "ABONO",
        monto: montoBase,
        fecha: at,
        pagosDetalle,
        tasaSnapshot: snapshot,
        motivo: motivo ?? null,
        // usuarioId is NEVER taken from the client: always the authenticated user.
        usuarioId: session?.user?.id ?? null,
      });

      const body: IMovimientoAplicadoResponse = {
        movimientoId: applied.movimientoId,
        cuentaId,
        tipo: "ABONO",
        monto: montoBase,
        saldoPendiente: applied.saldoPendiente,
        settledAt: applied.settledAt,
      };

      await storeIdempotentResponse(tx, idempotencyKey, body);
      return body;
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    // A concurrent request with the same key got there first. It only reaches this point after
    // that request committed, so its response is already stored (E-038: the P2002 is NOT
    // recovered inside the transaction).
    if (error instanceof DuplicateRequestError && claim) {
      const stored =
        await findIdempotentResponse<IMovimientoAplicadoResponse>(claim);
      return stored
        ? NextResponse.json({ ...stored, duplicado: true }, { status: 200 })
        : NextResponse.json(
            { error: CUENTAS_POR_COBRAR_API_ERRORS.operacionEnCurso },
            { status: 409 },
          );
    }

    if (error instanceof SinPeriodoAbiertoError) {
      return NextResponse.json(
        { error: CUENTAS_POR_COBRAR_API_ERRORS.sinPeriodoAbierto },
        { status: 409 },
      );
    }

    if (error instanceof MovimientoCuentaPorCobrarError) {
      const status = MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS[error.violation];
      // Only SALDO_INSUFICIENTE repeats the figure INSIDE the text (criterion 9, E-016); every
      // refusal carries it as a number, so no caller needs a second query.
      const mensaje =
        error.violation === "SALDO_INSUFICIENTE"
          ? CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente(error.saldoPendiente)
          : error.violation;
      return NextResponse.json(
        { error: mensaje, saldoPendiente: error.saldoPendiente },
        { status },
      );
    }

    console.error("[POST /api/cuentas-por-cobrar/[cuentaId]/abono]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
