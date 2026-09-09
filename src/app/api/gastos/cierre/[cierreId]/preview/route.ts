import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { gastoAplicaEnFecha } from "@/utils/gastos";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import {
  calcularGananciaFinal,
  computePercentageBaseTotals,
  type PercentageBaseSale,
} from "@/lib/gastos";
import { partitionSalesByCutoff } from "@/lib/cierre/salesCutoff";
import { calcularTotalesMovimientosPeriodo } from "@/lib/movimiento/caja";

export async function POST(
  _req: NextRequest,
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
        ventas: {
          include: {
            productos: { include: { producto: true } },
          },
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

    const tienda = await prisma.tienda.findUnique({
      where: { id: cierre.tiendaId },
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    const monedaBase = tienda?.negocio?.monedaBase ?? "CUP";
    const negocioId = tienda?.negocio?.id;

    const historialTasas = await loadTasaHistory(negocioId);
    const tasasActuales = buildTasaSnapshot(historialTasas);

    // A percentage expense is a percentage of the sales the close TAKES, not of
    // every sale the period holds. The cut only applies while the period is
    // open; once closed, the relation is the truth.
    const cutoffAt = cierre.fechaFin === null ? cierre.salesCutoffAt : null;
    const ventasPeriodo: PercentageBaseSale[] = cierre.ventas.map((v) => ({
      createdAt: v.createdAt,
      frontendCreatedAt: v.frontendCreatedAt,
      discountTotal: v.discountTotal,
      tasaSnapshot: (v.tasaSnapshot as ITasaSnapshot | null) ?? null,
      productos: v.productos.map((vp) => ({
        cantidad: vp.cantidad,
        precio: vp.precio,
        costo: vp.costo,
        monedaPrecioCode: vp.monedaPrecioCode,
        monedaCostoCode: vp.monedaCostoCode,
      })),
    }));
    const { included } = partitionSalesByCutoff(ventasPeriodo, cutoffAt);

    const { totalVentas, totalGanancia } = computePercentageBaseTotals(
      included,
      monedaBase,
      historialTasas,
    );

    // Obtener gastos configurados para la tienda
    const gastosTienda = await prisma.gastoTienda.findMany({
      where: { tiendaId: cierre.tiendaId, activo: true },
    });

    const ahora = new Date();
    const gastosRecurrentes = [];
    const gastosNoAplican = [];

    for (const g of gastosTienda) {
      const { aplica, motivo } = gastoAplicaEnFecha(g, ahora);

      let montoCalculado = 0;
      if (g.tipoCalculo === "MONTO_FIJO") {
        montoCalculado = g.monto ?? 0;
      } else if (g.tipoCalculo === "PORCENTAJE_VENTAS") {
        montoCalculado = ((g.porcentaje ?? 0) / 100) * totalVentas;
      } else if (g.tipoCalculo === "PORCENTAJE_GANANCIAS") {
        montoCalculado = ((g.porcentaje ?? 0) / 100) * totalGanancia;
      }

      const item = {
        gastoTiendaId: g.id,
        nombre: g.nombre,
        categoria: g.categoria,
        tipoCalculo: g.tipoCalculo,
        naturaleza: g.naturaleza,
        montoCalculado,
        monto: g.monto,
        porcentaje: g.porcentaje,
        recurrencia: g.recurrencia,
        esAdHoc: false,
        // Percentage-based amounts derive from base-currency totals, so they
        // are already in base no matter what the row says.
        monedaCode: g.tipoCalculo === "MONTO_FIJO" ? g.monedaCode : null,
        motivoAplica: motivo,
      };

      if (aplica) {
        gastosRecurrentes.push(item);
      } else {
        gastosNoAplican.push(item);
      }
    }

    // Gastos ad-hoc ya registrados en este período abierto
    const gastosAdHoc = await prisma.gastoCierre.findMany({
      where: { cierreId, esAdHoc: true },
      orderBy: { createdAt: "asc" },
    });

    // Solo naturaleza OPERATIVO resta de ganancia (INVERSION resta solo de caja).
    // Recurring expenses may carry their own currency too — convert before
    // summing, or a 20 USD rent would be added as if it were 20 CUP.
    const totalGastosRecurrentes = gastosRecurrentes
      .filter((g) => g.naturaleza === "OPERATIVO")
      .reduce(
        (s, g) =>
          s +
          convertToBase(
            g.montoCalculado,
            g.monedaCode ?? monedaBase,
            tasasActuales,
            monedaBase,
          ),
        0,
      );
    // Ad-hoc gastos may be in a foreign currency — convert to base before summing
    const totalGastosAdHoc = gastosAdHoc
      .filter((g) => g.naturaleza === "OPERATIVO")
      .reduce(
        (s, g) =>
          s +
          convertToBase(
            g.montoCalculado,
            g.monedaCode ?? monedaBase,
            tasasActuales,
            monedaBase,
          ),
        0,
      );
    const totalGastos = totalGastosRecurrentes + totalGastosAdHoc;

    // Compras (efectivo de caja), merma y devoluciones de venta registradas en
    // el período abierto — deben restar de la ganancia igual que en close/route.ts,
    // si no el preview muestra una ganancia final distinta de la que quedará
    // persistida al cerrar.
    const movimientosPeriodo = await prisma.movimientoStock.findMany({
      where: {
        tiendaId: cierre.tiendaId,
        tipo: { in: ["COMPRA", "MERMA", "DEVOLUCION_VENTA"] },
        // Same upper bound the cut gives the close. Without it the preview shows
        // a final profit the close is not going to store.
        fecha: { gte: cierre.fechaInicio, ...(cutoffAt && { lte: cutoffAt }) },
      },
    });
    const { totalMerma, totalDevoluciones } = calcularTotalesMovimientosPeriodo(
      movimientosPeriodo,
      monedaBase,
      tasasActuales,
    );

    const totalGananciaFinal = calcularGananciaFinal(
      totalGanancia,
      totalGastos,
      totalMerma,
      totalDevoluciones,
    );

    return NextResponse.json({
      gastosRecurrentes,
      gastosNoAplican,
      gastosAdHoc,
      totalGastos,
      totalVentas,
      totalGanancia,
      totalGananciaFinal,
    });
  } catch (error) {
    console.error("Error al calcular preview de gastos:", error);
    return NextResponse.json(
      { error: "Error al calcular preview" },
      { status: 500 },
    );
  }
}
