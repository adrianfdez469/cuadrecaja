import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { applyGastosSchema } from "@/schemas/gastos";
import { calcularGananciaFinal } from "@/lib/gastos";
import { buildTasaSnapshot, convertToBase } from "@/lib/currency";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> },
) {
  try {
    const { cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.cierre.cerrar",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tienda: { negocioId: user.negocio.id } },
      include: {
        tienda: { select: { negocio: { select: { id: true, monedaBase: true } } } },
      },
    });
    if (!cierre) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 },
      );
    }
    if (cierre.fechaFin) {
      return NextResponse.json(
        { error: "El período ya está cerrado" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = applyGastosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Idempotencia: si ya hay gastos recurrentes aplicados, no duplicar
    const yaAplicados = await prisma.gastoCierre.count({
      where: { cierreId, esAdHoc: false },
    });
    if (yaAplicados > 0) {
      return NextResponse.json(
        { error: "Los gastos recurrentes ya fueron aplicados a este cierre" },
        { status: 409 },
      );
    }

    const { gastosToApply } = parsed.data;

    const monedaBase = cierre.tienda.negocio.monedaBase ?? "CUP";
    const tasas = buildTasaSnapshot(
      await loadTasaHistory(cierre.tienda.negocio.id),
    );

    /**
     * The currency of a recurring expense is read back from `GastoTienda`, not
     * taken from the request: the body reaches us straight from the browser, and
     * a currency decides how much the amount is worth once converted. Restricted
     * to this store's rows so an id from another store cannot be smuggled in.
     */
    const gastoTiendaIds = gastosToApply
      .map((g) => g.gastoTiendaId)
      .filter((id): id is string => Boolean(id));
    const monedaPorGastoTienda = new Map(
      (
        await prisma.gastoTienda.findMany({
          where: { id: { in: gastoTiendaIds }, tiendaId: cierre.tiendaId },
          select: { id: true, monedaCode: true },
        })
      ).map((g) => [g.id, g.monedaCode]),
    );
    /** Percentage-based amounts come from base-currency totals: always base. */
    const monedaDe = (g: (typeof gastosToApply)[number]): string | null =>
      g.tipoCalculo === "MONTO_FIJO" && g.gastoTiendaId
        ? (monedaPorGastoTienda.get(g.gastoTiendaId) ?? null)
        : null;

    // Obtener los gastos ad-hoc ya registrados para sumarlos al total
    const gastosAdHocExistentes = await prisma.gastoCierre.findMany({
      where: { cierreId, esAdHoc: true },
    });

    await prisma.$transaction(async (tx) => {
      if (gastosToApply.length > 0) {
        await tx.gastoCierre.createMany({
          data: gastosToApply.map((g) => ({
            cierreId,
            gastoTiendaId: g.gastoTiendaId ?? null,
            nombre: g.nombre,
            categoria: g.categoria,
            tipoCalculo: g.tipoCalculo,
            naturaleza: g.naturaleza,
            montoCalculado: g.montoCalculado,
            monto: g.monto ?? null,
            porcentaje: g.porcentaje ?? null,
            esAdHoc: false,
            monedaCode: monedaDe(g),
          })),
        });
      }

      // Solo naturaleza OPERATIVO resta de ganancia (pre-cálculo de referencia; close/route.ts recalcula definitivamente)
      // Amounts in a foreign currency are converted before summing — mixing
      // 20 USD into a CUP total as a bare 20 understates the expense.
      const enBase = (montoCalculado: number, monedaCode: string | null) =>
        convertToBase(montoCalculado, monedaCode ?? monedaBase, tasas, monedaBase);
      const totalGastosRecurrentes = gastosToApply
        .filter((g) => g.naturaleza === "OPERATIVO")
        .reduce((s, g) => s + enBase(g.montoCalculado, monedaDe(g)), 0);
      const totalGastosAdHoc = gastosAdHocExistentes
        .filter((g) => g.naturaleza === "OPERATIVO")
        .reduce((s, g) => s + enBase(g.montoCalculado, g.monedaCode), 0);
      const totalGastos = totalGastosRecurrentes + totalGastosAdHoc;

      await tx.cierrePeriodo.update({
        where: { id: cierreId },
        data: {
          totalGastos,
          // totalGananciaFinal se recalcula definitivamente en close/route.ts
          // (ahí sí se restan merma/devoluciones); aquí es solo un pre-cálculo
          // de referencia mientras el período sigue abierto.
          totalGananciaFinal: calcularGananciaFinal(
            cierre.totalGanancia,
            totalGastos,
          ),
        },
      });
    });

    const gastosAplicados = await prisma.gastoCierre.findMany({
      where: { cierreId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(gastosAplicados, { status: 201 });
  } catch (error) {
    console.error("Error al aplicar gastos al cierre:", error);
    return NextResponse.json(
      { error: "Error al aplicar gastos" },
      { status: 500 },
    );
  }
}
