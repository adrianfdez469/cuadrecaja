import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { roles } from "@/utils/roles";
import {
  computeCierreTotals,
  hasTotalsDrift,
} from "@/lib/cierre/computeCierreTotals";
import { loadCierreComputationInput } from "@/lib/cierre/loadCierreInput";
import { persistCierreComputation } from "@/lib/cierre/persistCierreTotals";
import type { IRecalculateCierreResult } from "@/schemas/cierre";

type Params = { tiendaId: string; cierreId: string };

/**
 * POST /api/cierre/[tiendaId]/[cierreId]/recalculate?dryRun=1
 *
 * Re-derives the stored figures of a CLOSED period from its current sales,
 * expenses and movements (ADR 0036). It is the only sanctioned way to change
 * them after the close — the follow-up to any manual correction of the sales
 * of a period. Superadmin only; `dryRun` returns what would be written
 * without touching the database.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse<IRecalculateCierreResult | { error: string }>> {
  try {
    const { tiendaId, cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (user.rol !== roles.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Solo un superadministrador puede recalcular un cierre" },
        { status: 403 },
      );
    }

    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

    const loaded = await loadCierreComputationInput(cierreId, user.negocio.id);
    if (!loaded || loaded.cierre.tiendaId !== tiendaId) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 },
      );
    }
    if (!loaded.cierre.fechaFin) {
      return NextResponse.json(
        { error: "El período sigue abierto: sus cifras se calculan en vivo" },
        { status: 400 },
      );
    }

    const before = await prisma.cierrePeriodo.findFirstOrThrow({
      where: { id: cierreId, tienda: { negocioId: user.negocio.id } },
      select: {
        totalVentas: true,
        totalVentasBrutas: true,
        totalDescuentos: true,
        totalInversion: true,
        totalGanancia: true,
        totalTransferencia: true,
        totalVentasPropias: true,
        totalVentasConsignacion: true,
        totalGananciasPropias: true,
        totalGananciasConsignacion: true,
        totalGastos: true,
        totalGananciaFinal: true,
        totalComprasCaja: true,
        totalMerma: true,
        totalDevoluciones: true,
        totalTips: true,
        totalsComputedAt: true,
        resumenMonedas: {
          select: {
            monedaCode: true,
            totalEfectivo: true,
            totalTransfer: true,
            equivalenteBase: true,
          },
        },
      },
    });

    const computation = computeCierreTotals(loaded.input);
    const { totalsComputedAt, resumenMonedas, ...totalsBefore } = before;

    let liquidacionesConservadas = 0;
    if (!dryRun) {
      const result = await prisma.$transaction(async (tx) => {
        // Same row lock the close takes: two concurrent recalculations, or a
        // recalculation racing a reopen, serialize here instead of interleaving
        // their delete/create of the per-currency rows.
        const [locked] = await tx.$queryRaw<Array<{ fechaFin: Date | null }>>`
          SELECT "fechaFin" FROM "CierrePeriodo"
          WHERE "id" = ${cierreId}
          FOR UPDATE
        `;
        if (!locked?.fechaFin) throw new Error("PERIOD_NOT_CLOSED");
        return persistCierreComputation(tx, cierreId, computation);
      });
      liquidacionesConservadas = result.liquidacionesConservadas;
    }

    return NextResponse.json({
      applied: !dryRun,
      drifted: hasTotalsDrift(
        before.totalVentas,
        computation.totals.totalVentas,
      ),
      totalsComputedAt: totalsComputedAt?.toISOString() ?? null,
      before: totalsBefore,
      after: computation.totals,
      resumenBefore: resumenMonedas,
      resumenAfter: computation.resumenMonedas.map((r) => ({
        monedaCode: r.monedaCode,
        totalEfectivo: r.totalEfectivo,
        totalTransfer: r.totalTransfer,
        equivalenteBase: r.equivalenteBase,
      })),
      liquidacionesConservadas,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PERIOD_NOT_CLOSED") {
      return NextResponse.json(
        { error: "El período sigue abierto: sus cifras se calculan en vivo" },
        { status: 400 },
      );
    }
    console.error("❌ [POST /api/cierre/recalculate] Error:", error);
    return NextResponse.json(
      { error: "Error al recalcular el cierre" },
      { status: 500 },
    );
  }
}
