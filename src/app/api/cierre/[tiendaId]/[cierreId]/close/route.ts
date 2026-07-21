import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getSession } from "@/utils/auth";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { applyGastosToResumenMap, calcularGananciaFinal } from "@/lib/gastos";
import {
  applyComprasYDevolucionesToResumenMap,
  calcularTotalesMovimientosPeriodo,
} from "@/lib/movimiento/caja";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  try {
    const { tiendaId, cierreId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 },
      );
    }

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

    // Get monedaBase for currency conversions — findFirst con negocioId para
    // no permitir cerrar el período de una tienda de otro negocio.
    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }
    const monedaBase = tienda?.negocio?.monedaBase ?? "CUP";
    const negocioId = tienda?.negocio?.id;

    // Buscar el último período abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
      include: {
        ventas: {
          include: {
            productos: {
              include: {
                producto: true,
              },
            },
          },
        },
      },
    });

    if (!ultimoPeriodo) {
      return NextResponse.json(
        { error: "No hay períodos para esta tienda" },
        { status: 404 },
      );
    }

    if (ultimoPeriodo.fechaFin) {
      return NextResponse.json(
        { error: "El último período ya está cerrado" },
        { status: 400 },
      );
    }

    if (ultimoPeriodo.id !== cierreId) {
      return NextResponse.json(
        { error: "Período no coincide con el cierre solicitado" },
        { status: 400 },
      );
    }

    // Historial completo de tasas — usado como fallback cuando el
    // tasaSnapshot de una venta quedó incompleto (p. ej. el cliente no tenía
    // todavía cargada la tasa de una moneda usada en esa venta). Sin este
    // fallback, convertToBase asume 1 para la moneda faltante y el cierre
    // guarda montos completamente distintos a los que se veían en la
    // pantalla previa al cierre. Se calcula antes de abrir la transacción de
    // cierre para no alargar el tiempo que mantiene el lock/la conexión.
    //
    // Importante: el fallback debe reconstruir la tasa que estaba VIGENTE EN
    // EL MOMENTO de cada venta, no la más reciente en términos absolutos —
    // usar "la de ahora" podría sustituir un valor histórico real (con el
    // que de hecho se le cobró al cliente) por uno distinto si la tasa
    // cambió entre la venta y el cierre. Solo se usa la tasa "más reciente
    // en general" como último recurso, para una moneda que ni siquiera
    // tuviera tasa registrada todavía en el momento de esa venta.
    const historialTasas = negocioId
      ? await prisma.tasaCambio.findMany({
          where: { negocioId },
          orderBy: { createdAt: "asc" },
          select: { monedaCode: true, tasa: true, createdAt: true },
        })
      : [];
    const tasasGastos = buildTasaSnapshot(historialTasas);

    const tasasEnMomento = (momento: Date): ITasaSnapshot => {
      const resultado: ITasaSnapshot = {};
      for (const t of historialTasas) {
        if (t.monedaCode === "CUP" || t.createdAt > momento) continue;
        resultado[t.monedaCode] = t.tasa; // historial ascendente: la última asignación es la vigente en ese momento
      }
      return resultado;
    };

    // CALCULOS
    let totalVentas = 0;
    let totalInversion = 0;
    let totalTransferencia = 0;
    let totalVentasPropias = 0;
    let totalVentasConsignacion = 0;
    let totalGananciasPropias = 0;
    let totalGananciasConsignacion = 0;

    for (const venta of ultimoPeriodo.ventas) {
      totalTransferencia += venta.totaltransfer;
      const tasas = {
        ...tasasGastos,
        ...tasasEnMomento(venta.createdAt),
        ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
      };
      let ventaBruta = 0;

      for (const vp of venta.productos) {
        const costoBase = convertToBase(
          vp.costo,
          vp.monedaCostoCode ?? monedaBase,
          tasas,
          monedaBase,
        );
        const precioBase = convertToBase(
          vp.precio,
          vp.monedaPrecioCode ?? monedaBase,
          tasas,
          monedaBase,
        );
        ventaBruta += precioBase * vp.cantidad;

        if (vp.producto.proveedorId) {
          const costoConsignacion = costoBase * vp.cantidad;
          const ventaConsignacion = precioBase * vp.cantidad;
          const gananciaConsignacion = ventaConsignacion - costoConsignacion;
          totalVentasConsignacion += ventaConsignacion;
          totalGananciasConsignacion += gananciaConsignacion;
        } else {
          const costoTotal = costoBase * vp.cantidad;
          const ventaTotal = precioBase * vp.cantidad;
          const ganancia = ventaTotal - costoTotal;

          totalInversion += costoTotal;
          totalVentasPropias += ventaTotal;
          totalGananciasPropias += ganancia;
        }
      }

      const descuento = Number(venta.discountTotal ?? 0);
      totalVentas += Math.max(0, ventaBruta - descuento);
    }

    const totalGanancia = totalGananciasPropias + totalGananciasConsignacion;

    // Movimientos (compras en efectivo de caja, merma, devoluciones) no
    // dependen de nada escrito dentro de la transacción de cierre — se
    // calculan antes de abrirla para no alargar el tiempo que mantiene el
    // lock/la conexión.
    const movimientosPeriodo = await prisma.movimientoStock.findMany({
      where: {
        tiendaId,
        tipo: { in: ["COMPRA", "MERMA", "DEVOLUCION_VENTA"] },
        fecha: { gte: ultimoPeriodo.fechaInicio },
      },
    });
    const { totalComprasCaja, totalMerma, totalDevoluciones } =
      calcularTotalesMovimientosPeriodo(
        movimientosPeriodo,
        monedaBase,
        tasasGastos,
      );

    const [periodoCerrado] = await prisma.$transaction(async (tx) => {
      // Eliminar desgloses de billetes temporales antes de cerrar
      await tx.cashBreakdownCierre.deleteMany({
        where: { cierrePeriodoId: ultimoPeriodo.id },
      });
      await tx.cashBreakdownMoneda.deleteMany({
        where: { cierrePeriodoId: ultimoPeriodo.id },
      });

      // Reconciliar gastos aplicados (pueden haber sido aplicados antes del close via /apply)
      const gastosCierre = await tx.gastoCierre.findMany({
        where: { cierreId: ultimoPeriodo.id },
      });

      let totalGastos = 0;
      for (const g of gastosCierre) {
        if (g.naturaleza !== "OPERATIVO") continue; // INVERSION resta de caja, no de ganancia
        const moneda = g.monedaCode ?? monedaBase;
        totalGastos += convertToBase(
          g.montoCalculado,
          moneda,
          tasasGastos,
          monedaBase,
        );
      }

      const totalGananciaFinal = calcularGananciaFinal(
        totalGanancia,
        totalGastos,
        totalMerma,
        totalDevoluciones,
      );

      // Cerrar el período con resumen
      const periodoCerrado = await tx.cierrePeriodo.update({
        where: { id: ultimoPeriodo.id },
        data: {
          fechaFin: new Date(),
          totalVentas,
          totalInversion,
          totalGanancia,
          totalTransferencia,
          totalVentasPropias,
          totalVentasConsignacion,
          totalGananciasPropias,
          totalGananciasConsignacion,
          totalGastos,
          totalGananciaFinal,
          totalComprasCaja,
          totalMerma,
          totalDevoluciones,
        },
      });

      // Calcular ResumenMonedaCierre agrupando pagosDetalle de todas las ventas
      const resumenMonedaMap: Record<
        string,
        {
          totalEfectivo: number;
          totalTransfer: number;
          equivalenteBase: number;
        }
      > = {};

      for (const venta of ultimoPeriodo.ventas) {
        if (!venta.pagosDetalle) continue;
        const pagos = venta.pagosDetalle as unknown as IPagoLinea[];
        const tasas = {
          ...tasasGastos,
          ...tasasEnMomento(venta.createdAt),
          ...((venta.tasaSnapshot as unknown as ITasaSnapshot) ?? {}),
        };

        for (const pago of pagos) {
          if (!resumenMonedaMap[pago.moneda]) {
            resumenMonedaMap[pago.moneda] = {
              totalEfectivo: 0,
              totalTransfer: 0,
              equivalenteBase: 0,
            };
          }
          const enBase = convertToBase(
            pago.monto,
            pago.moneda,
            tasas,
            monedaBase,
          );
          if (pago.tipo === "cash") {
            resumenMonedaMap[pago.moneda].totalEfectivo += pago.monto;
          } else {
            resumenMonedaMap[pago.moneda].totalTransfer += pago.monto;
          }
          resumenMonedaMap[pago.moneda].equivalenteBase += enBase;
        }

        // Subtract change given — vuelto reduces cash on hand per currency
        if (venta.vueltoDetalle) {
          const vueltos = venta.vueltoDetalle as unknown as IVueltoLinea[];
          for (const vuelto of vueltos) {
            if (!resumenMonedaMap[vuelto.moneda]) {
              resumenMonedaMap[vuelto.moneda] = {
                totalEfectivo: 0,
                totalTransfer: 0,
                equivalenteBase: 0,
              };
            }
            const enBase = convertToBase(
              vuelto.monto,
              vuelto.moneda,
              tasas,
              monedaBase,
            );
            resumenMonedaMap[vuelto.moneda].totalEfectivo -= vuelto.monto;
            resumenMonedaMap[vuelto.moneda].equivalenteBase -= enBase;
          }
        }
      }

      // Deduct ad-hoc/recurring expenses from the per-currency cash summary
      // (todos los gastos, sin importar naturaleza — la caja siempre refleja el efectivo real que salió)
      applyGastosToResumenMap(
        resumenMonedaMap,
        gastosCierre,
        monedaBase,
        tasasGastos,
      );

      // Deduct compras pagadas con efectivo de caja y reembolsos por devolución de venta
      applyComprasYDevolucionesToResumenMap(
        resumenMonedaMap,
        movimientosPeriodo,
        monedaBase,
        tasasGastos,
      );

      if (Object.keys(resumenMonedaMap).length > 0) {
        await tx.resumenMonedaCierre.createMany({
          data: Object.entries(resumenMonedaMap).map(([monedaCode, vals]) => ({
            cierrePeriodoId: periodoCerrado.id,
            monedaCode,
            totalEfectivo: vals.totalEfectivo,
            totalTransfer: vals.totalTransfer,
            equivalenteBase: vals.equivalenteBase,
          })),
          skipDuplicates: true,
        });
      }

      const liquidaciones = {};
      for (const venta of ultimoPeriodo.ventas) {
        const tasasLiq = {
          ...tasasGastos,
          ...tasasEnMomento(venta.createdAt),
          ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
        };
        for (const vp of venta.productos) {
          if (vp.producto?.proveedorId) {
            const key = `${vp.producto.proveedorId}_${vp.producto.productoId}`;
            const costoBase = convertToBase(
              vp.costo,
              vp.monedaCostoCode ?? monedaBase,
              tasasLiq,
              monedaBase,
            );
            const precioBase = convertToBase(
              vp.precio,
              vp.monedaPrecioCode ?? monedaBase,
              tasasLiq,
              monedaBase,
            );

            if (liquidaciones[key]) {
              liquidaciones[key].vendidos += vp.cantidad;
              liquidaciones[key].monto += vp.cantidad * costoBase;
              liquidaciones[key].costo =
                liquidaciones[key].monto / liquidaciones[key].vendidos;
              liquidaciones[key].precio = precioBase;
              liquidaciones[key].existencia = vp.producto.existencia;
            } else {
              liquidaciones[key] = {
                vendidos: vp.cantidad,
                monto: vp.cantidad * costoBase,
                costo: costoBase,
                precio: precioBase,
                existencia: vp.producto.existencia,
                cierreId: periodoCerrado.id,
                proveedorId: vp.producto.proveedorId,
                productoId: vp.producto.productoId,
                liquidatedAt: null,
              };
            }
          }
        }
      }

      if (Object.keys(liquidaciones).length > 0) {
        await tx.productoProveedorLiquidacion.createMany({
          data: Object.values(liquidaciones) as {
            vendidos: number;
            monto: number;
            costo: number;
            precio: number;
            existencia: number;
            cierreId: string;
            proveedorId: string;
            productoId: string;
            liquidatedAt: Date | null;
          }[],
        });
      }

      return [periodoCerrado];
    });

    return NextResponse.json(periodoCerrado, { status: 201 });
  } catch (error) {
    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 },
    );
  }
}
