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
  CUENTAS_POR_COBRAR_PERMISO_REVERTIR,
} from "@/constants/cuentasPorCobrar";
import {
  revertirAbonoSchema,
  type IMovimientoAplicadoResponse,
} from "@/schemas/cuentasPorCobrarPanel";
import {
  applyMovimientoCuentaPorCobrar,
  lockCuentaPorCobrar,
  MovimientoCuentaPorCobrarError,
  MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS,
} from "@/lib/cuentasPorCobrar/applyMovimiento";

/**
 * POST /api/cuentas-por-cobrar/[cuentaId]/reversion — undoes an ABONO by APPENDING a row.
 *
 * The original entry keeps its `id`, its `tipo` and its `monto` untouched: there is no UPDATE and
 * no DELETE over the ledger anywhere in this feature (criterion 11). The new row is a
 * REVERSION_ABONO whose `revierteId` points at it, written with `pagosDetalle: null` and
 * `tasaSnapshot: null` (ADR 0127) — the composition of the money is read through `revierteId`,
 * and the SIGN is applied when reading, by `netCollectionRows` (ADR 0128).
 *
 * The reversal is TOTAL: the amount is the origin's own `monto`, never one the client sends.
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
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO_REVERTIR,
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

    const parsed = revertirAbonoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: CUENTAS_POR_COBRAR_API_ERRORS.cuerpoInvalido,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { movimientoId, motivo } = parsed.data;

    const cuenta = await prisma.cuentaPorCobrar.findFirst({
      where: withTenantScope("cuentaPorCobrar", { id: cuentaId }, negocioId),
      select: { id: true, saldoPendiente: true },
    });
    if (!cuenta) return tenantNotFoundResponse();

    claim = {
      key: idempotencyKey,
      scopeId: negocioId,
      endpoint: `POST /api/cuentas-por-cobrar/${cuentaId}/reversion`,
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

      const bajoBloqueo = await lockCuentaPorCobrar(tx, cuentaId);
      const saldoBajoBloqueo = bajoBloqueo?.saldoPendiente ?? 0;

      // Read AFTER the lock, scoped to this account. A movement of another account, or one that
      // does not exist, are INDISTINGUISHABLE: both end in the same 404, so the route is not an
      // oracle for ids of another account and therefore of another business (ADR 0077). The
      // belonging check is repeated inside the write door, which is what actually guarantees it.
      const origen = await tx.movimientoCuentaPorCobrar.findFirst({
        where: { id: movimientoId, cuentaPorCobrarId: cuentaId },
        select: { id: true, monto: true },
      });
      if (!origen) {
        throw new MovimientoCuentaPorCobrarError(
          "REVERSION_ORIGEN_INALCANZABLE",
          saldoBajoBloqueo,
        );
      }

      const applied = await applyMovimientoCuentaPorCobrar(tx, cuentaId, {
        tipo: "REVERSION_ABONO",
        monto: origen.monto,
        fecha: at,
        pagosDetalle: null,
        tasaSnapshot: null,
        motivo: motivo ?? null,
        usuarioId: session?.user?.id ?? null,
        revierteId: origen.id,
      });

      const body: IMovimientoAplicadoResponse = {
        movimientoId: applied.movimientoId,
        cuentaId,
        tipo: "REVERSION_ABONO",
        monto: origen.monto,
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

    console.error("[POST /api/cuentas-por-cobrar/[cuentaId]/reversion]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
