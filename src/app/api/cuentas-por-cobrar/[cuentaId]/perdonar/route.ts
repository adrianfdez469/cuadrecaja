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
  CUENTAS_POR_COBRAR_PERMISO_PERDONAR,
} from "@/constants/cuentasPorCobrar";
import {
  perdonarDeudaSchema,
  type IMovimientoAplicadoResponse,
} from "@/schemas/cuentasPorCobrarPanel";
import {
  applyMovimientoCuentaPorCobrar,
  lockCuentaPorCobrar,
  MovimientoCuentaPorCobrarError,
  MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS,
} from "@/lib/cuentasPorCobrar/applyMovimiento";
import { MIN_OPEN_BALANCE_BASE } from "@/lib/cuentasPorCobrar/aging";

/**
 * POST /api/cuentas-por-cobrar/[cuentaId]/perdonar — writes off what is left of a debt.
 *
 * It moves NO physical money, so it checks no open period and validates no currency, and the row
 * it writes carries `pagosDetalle: null` and `tasaSnapshot: null`. That is exactly why the cash
 * summary of the period does not move (criterion 11): neither `periodCollectionsWhere` nor the
 * collection load of `construirResumenCajaAbierta` looks at CONDONACION, and a row with a null
 * `pagosDetalle` never enters `buildResumenMonedas`.
 *
 * The AMOUNT is the server's: the balance read under the lock. There is no partial forgiveness
 * and no way to forgive more than what is owed.
 *
 * `CONDONACION` is what the database says; the permission, the route and every visible word say
 * "perdonar". Neither is corrected into the other (ADR 0115).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  let claim: { key: string; scopeId: string; endpoint: string } | undefined;

  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO_PERDONAR,
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

    const parsed = perdonarDeudaSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: CUENTAS_POR_COBRAR_API_ERRORS.cuerpoInvalido,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { motivo } = parsed.data;

    const cuenta = await prisma.cuentaPorCobrar.findFirst({
      where: withTenantScope("cuentaPorCobrar", { id: cuentaId }, negocioId),
      select: { id: true, saldoPendiente: true },
    });
    if (!cuenta) return tenantNotFoundResponse();

    // Forgiving an already settled account is refused HERE, before the transaction opens, with
    // its own reason: the guard order of § 3.1 is not touched, because widening guard 1 would
    // change the behaviour of every other operation that shares it (E-032). Guard 1 stays the
    // net that catches the race — somebody settling the account between this read and the lock —
    // and answers 400 MONTO_NO_POSITIVO, also with `saldoPendiente` in the body.
    if (!(cuenta.saldoPendiente > MIN_OPEN_BALANCE_BASE)) {
      return NextResponse.json(
        {
          error: CUENTAS_POR_COBRAR_API_ERRORS.nadaQuePerdonar,
          saldoPendiente: cuenta.saldoPendiente,
        },
        { status: 400 },
      );
    }

    claim = {
      key: idempotencyKey,
      scopeId: negocioId,
      endpoint: `POST /api/cuentas-por-cobrar/${cuentaId}/perdonar`,
    };

    const replayed =
      await findIdempotentResponse<IMovimientoAplicadoResponse>(claim);
    if (replayed) {
      return NextResponse.json(
        { ...replayed, duplicado: true },
        { status: 200 },
      );
    }

    const at = new Date();

    const payload = await prisma.$transaction(async (tx) => {
      await claimIdempotencyKey(tx, claim);

      // The amount is the balance read UNDER THE LOCK, not the one read above: somebody could
      // have collected in between. Taking the lock here and again inside the door is a no-op —
      // the same transaction already holds it.
      const bajoBloqueo = await lockCuentaPorCobrar(tx, cuentaId);
      const monto = bajoBloqueo?.saldoPendiente ?? 0;

      const applied = await applyMovimientoCuentaPorCobrar(tx, cuentaId, {
        tipo: "CONDONACION",
        monto,
        fecha: at,
        pagosDetalle: null,
        tasaSnapshot: null,
        motivo: motivo ?? null,
        usuarioId: session?.user?.id ?? null,
      });

      const body: IMovimientoAplicadoResponse = {
        movimientoId: applied.movimientoId,
        cuentaId,
        tipo: "CONDONACION",
        monto,
        saldoPendiente: applied.saldoPendiente,
        settledAt: applied.settledAt,
      };

      await storeIdempotentResponse(tx, idempotencyKey, body);
      return body;
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
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

    if (error instanceof MovimientoCuentaPorCobrarError) {
      const status = MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS[error.violation];
      const mensaje =
        error.violation === "SALDO_INSUFICIENTE"
          ? CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente(error.saldoPendiente)
          : error.violation;
      return NextResponse.json(
        { error: mensaje, saldoPendiente: error.saldoPendiente },
        { status },
      );
    }

    console.error("[POST /api/cuentas-por-cobrar/[cuentaId]/perdonar]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
