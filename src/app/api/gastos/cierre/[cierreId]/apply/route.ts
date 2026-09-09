import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { applyGastosSchema } from "@/schemas/gastos";
import {
  calcularGananciaFinal,
  computePercentageBaseTotals,
  type PercentageBaseSale,
} from "@/lib/gastos";
import { partitionSalesByCutoff } from "@/lib/cierre/salesCutoff";
import { buildTasaSnapshot, convertToBase } from "@/lib/currency";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

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
        tienda: {
          select: { negocio: { select: { id: true, monedaBase: true } } },
        },
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
    const historialTasas = await loadTasaHistory(cierre.tienda.negocio.id);
    const tasas = buildTasaSnapshot(historialTasas);

    /**
     * The two totals a percentage expense is a percentage OF, recomputed here
     * over the sales the cut includes. This route persists money, and until now
     * it trusted the `montoCalculado` the browser sent: filtering only the
     * preview would leave the figure depending on the client.
     */
    const cutoffAt = cierre.fechaFin === null ? cierre.salesCutoffAt : null;
    const ventasPeriodo = await prisma.venta.findMany({
      where: { cierrePeriodoId: cierreId },
      select: {
        createdAt: true,
        frontendCreatedAt: true,
        discountTotal: true,
        tasaSnapshot: true,
        productos: {
          select: {
            cantidad: true,
            precio: true,
            costo: true,
            monedaPrecioCode: true,
            monedaCostoCode: true,
          },
        },
      },
    });
    const ventas: PercentageBaseSale[] = ventasPeriodo.map((v) => ({
      createdAt: v.createdAt,
      frontendCreatedAt: v.frontendCreatedAt,
      discountTotal: v.discountTotal,
      tasaSnapshot: (v.tasaSnapshot as ITasaSnapshot | null) ?? null,
      productos: v.productos,
    }));
    const { included } = partitionSalesByCutoff(ventas, cutoffAt);
    const base = computePercentageBaseTotals(
      included,
      monedaBase,
      historialTasas,
    );

    /**
     * The currency AND the percentage of a recurring expense are read back from
     * `GastoTienda`, not taken from the request: the body reaches us straight
     * from the browser, and both decide how much money ends up written.
     * Restricted to this store's rows so an id from another store cannot be
     * smuggled in.
     */
    const gastoTiendaIds = gastosToApply
      .map((g) => g.gastoTiendaId)
      .filter((id): id is string => Boolean(id));
    const filaPorGastoTienda = new Map(
      (
        await prisma.gastoTienda.findMany({
          where: { id: { in: gastoTiendaIds }, tiendaId: cierre.tiendaId },
          select: { id: true, monedaCode: true, porcentaje: true },
        })
      ).map((g) => [g.id, g]),
    );

    /**
     * Every non-MONTO_FIJO item MUST resolve to a row of THIS store, or the whole
     * request is rejected before anything is written.
     *
     * `gastoPreviewSchema` declares `gastoTiendaId` as nullable/optional and
     * `porcentaje` as any number, so a hand-made POST with
     * `{ tipoCalculo: "PORCENTAJE_VENTAS", gastoTiendaId: null, porcentaje: 999 }`
     * parses fine; and the map above resolves to `undefined` IN SILENCE when the
     * id belongs to another store. Without this guard that silence becomes an
     * amount. It breaks no legitimate caller: the preview always returns a
     * `gastoTiendaId` for the recurring expenses, which are the only ones this
     * route applies.
     */
    const sinFilaDeLaTienda = gastosToApply.some(
      (g) =>
        g.tipoCalculo !== "MONTO_FIJO" &&
        (!g.gastoTiendaId || !filaPorGastoTienda.has(g.gastoTiendaId)),
    );
    if (sinFilaDeLaTienda) {
      return NextResponse.json(
        { error: "Gasto recurrente no válido para esta tienda" },
        { status: 400 },
      );
    }

    /** Percentage-based amounts come from base-currency totals: always base. */
    const monedaDe = (g: (typeof gastosToApply)[number]): string | null =>
      g.tipoCalculo === "MONTO_FIJO" && g.gastoTiendaId
        ? (filaPorGastoTienda.get(g.gastoTiendaId)?.monedaCode ?? null)
        : null;

    /**
     * The amount that gets persisted. The two percentage kinds are recomputed
     * on the server over the included sales; MONTO_FIJO keeps coming from the
     * body, exactly as today. There is no branch reading the percentage from the
     * body: if there were, the guard above would be worth nothing.
     */
    const montoAPersistir = (g: (typeof gastosToApply)[number]): number => {
      if (g.tipoCalculo === "MONTO_FIJO") return g.montoCalculado;
      const porcentaje =
        filaPorGastoTienda.get(g.gastoTiendaId)?.porcentaje ?? 0;
      if (g.tipoCalculo === "PORCENTAJE_VENTAS")
        return (porcentaje / 100) * base.totalVentas;
      if (g.tipoCalculo === "PORCENTAJE_GANANCIAS")
        return (porcentaje / 100) * base.totalGanancia;
      return g.montoCalculado;
    };

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
            montoCalculado: montoAPersistir(g),
            monto: g.monto ?? null,
            // The rate the amount above was actually computed with, so the row
            // never records a percentage that does not explain its own amount.
            porcentaje:
              g.tipoCalculo === "MONTO_FIJO"
                ? (g.porcentaje ?? null)
                : (filaPorGastoTienda.get(g.gastoTiendaId)?.porcentaje ?? null),
            esAdHoc: false,
            monedaCode: monedaDe(g),
          })),
        });
      }

      // Solo naturaleza OPERATIVO resta de ganancia (pre-cálculo de referencia; close/route.ts recalcula definitivamente)
      // Amounts in a foreign currency are converted before summing — mixing
      // 20 USD into a CUP total as a bare 20 understates the expense.
      const enBase = (montoCalculado: number, monedaCode: string | null) =>
        convertToBase(
          montoCalculado,
          monedaCode ?? monedaBase,
          tasas,
          monedaBase,
        );
      const totalGastosRecurrentes = gastosToApply
        .filter((g) => g.naturaleza === "OPERATIVO")
        .reduce((s, g) => s + enBase(montoAPersistir(g), monedaDe(g)), 0);
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
