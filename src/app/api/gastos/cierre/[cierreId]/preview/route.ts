import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { gastoAplicaEnFecha } from "@/utils/gastos";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.cierre.cerrar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
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
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }
    if (cierre.fechaFin) {
      return NextResponse.json({ error: "El período ya está cerrado" }, { status: 400 });
    }

    // Calcular totales actuales del período (igual que close/route.ts)
    let totalVentas = 0;
    let totalGanancia = 0;

    for (const venta of cierre.ventas) {
      totalVentas += venta.total;
      for (const vp of venta.productos) {
        const ganancia = (vp.precio - vp.costo) * vp.cantidad;
        totalGanancia += ganancia;
      }
    }

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
        montoCalculado,
        monto: g.monto,
        porcentaje: g.porcentaje,
        recurrencia: g.recurrencia,
        esAdHoc: false,
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

    const totalGastosRecurrentes = gastosRecurrentes.reduce((s, g) => s + g.montoCalculado, 0);
    const totalGastosAdHoc = gastosAdHoc.reduce((s, g) => s + g.montoCalculado, 0);
    const totalGastos = totalGastosRecurrentes + totalGastosAdHoc;
    const totalGananciaFinal = totalGanancia - totalGastos;

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
    return NextResponse.json({ error: "Error al calcular preview" }, { status: 500 });
  }
}
