import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { startOfNextDay } from "@/utils/date";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";

export interface DashboardResumenMetrics {
  ventas: {
    totalPeriodo: number;
    unidadesVendidas: number;
    gananciaTotal: number;
    totalGastos: number;
    totalMerma: number;
    totalDevoluciones: number;
    gananciaFinal: number;
    productosActivos: number;
  };
  topProductos: {
    nombre: string;
    unidades: number;
  }[];
  topGanancias: {
    nombre: string;
    ganancia: number;
  }[];
  productosMenosVendidos: {
    nombre: string;
    unidades: number;
  }[];
  productosMenosRentables: {
    nombre: string;
    rentabilidad: number;
  }[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
): Promise<NextResponse<DashboardResumenMetrics | { error: string }>> {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !user ||
      !verificarPermisoUsuario(
        user.permisos,
        "recuperaciones.dashboard.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { tiendaId } = await params;

    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") || "mes";
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    // Verificar acceso a la tienda
    const tienda = await prisma.tienda.findFirst({
      where:
        user.rol === "SUPER_ADMIN"
          ? { id: tiendaId } // SUPER_ADMIN puede acceder a cualquier tienda
          : {
              id: tiendaId,
              usuario: {
                some: { id: user.id },
              },
            },
      include: { negocio: { select: { monedaBase: true } } },
    });

    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada o sin acceso" },
        { status: 404 },
      );
    }

    const monedaBase = tienda.negocio?.monedaBase ?? "CUP";

    // Calcular fechas según el filtro
    const now = new Date();
    let fechaInicioFiltro: Date;
    let fechaFinFiltro: Date = new Date(now);

    switch (periodo) {
      case "dia":
        fechaInicioFiltro = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        break;
      case "semana":
        fechaInicioFiltro = new Date(now);
        fechaInicioFiltro.setDate(now.getDate() - 7);
        break;
      case "mes":
        fechaInicioFiltro = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "anio":
        fechaInicioFiltro = new Date(now.getFullYear(), 0, 1);
        break;
      case "personalizado":
        if (!fechaInicio) {
          return NextResponse.json(
            { error: "Fecha de inicio requerida para período personalizado" },
            { status: 400 },
          );
        }
        fechaInicioFiltro = new Date(fechaInicio);
        if (fechaFin) {
          fechaFinFiltro = startOfNextDay(new Date(fechaFin));
        }
        break;
      default:
        fechaInicioFiltro = new Date(now.getFullYear(), now.getMonth(), 1); // Por defecto, mes actual
    }

    // Obtener ventas del período — mismo alcance que el resumen de cierres:
    // solo períodos cerrados cuyo intervalo cae dentro del rango de fechas
    const filtroCierres = {
      tiendaId: tiendaId,
      fechaInicio: { gte: fechaInicioFiltro },
      fechaFin: { lte: fechaFinFiltro },
    };

    const ventas = await prisma.venta.findMany({
      where: {
        tiendaId: tiendaId,
        cierrePeriodo: {
          fechaInicio: { gte: fechaInicioFiltro },
          fechaFin: { lte: fechaFinFiltro },
        },
      },
      include: {
        appliedDiscounts: true,
        productos: {
          include: {
            producto: {
              include: {
                producto: true,
                proveedor: true,
              },
            },
          },
        },
      },
    });

    // Calcular métricas de ventas
    let totalPeriodo = 0;
    let unidadesVendidas = 0;
    let gananciaTotal = 0;

    // Mapas para calcular productos más vendidos y más rentables
    const productosVendidosMap = new Map<
      string,
      { nombre: string; unidades: number }
    >();
    const productosGananciaMap = new Map<
      string,
      { nombre: string; ganancia: number }
    >();
    const productosVentasTotalesMap = new Map<string, number>();

    // Procesar ventas
    ventas.forEach((venta) => {
      const tasas = (venta.tasaSnapshot ?? {}) as ITasaSnapshot;
      const discountTotal = Number(venta.discountTotal ?? 0);

      // Pasada 1: convertir cada línea a moneda base
      const lineas = venta.productos.map((ventaProducto) => {
        const precioBase = convertToBase(
          ventaProducto.precio,
          ventaProducto.monedaPrecioCode ?? monedaBase,
          tasas,
          monedaBase,
        );
        const costoBase = convertToBase(
          ventaProducto.costo,
          ventaProducto.monedaCostoCode ?? monedaBase,
          tasas,
          monedaBase,
        );
        return {
          ventaProducto,
          bruto: precioBase * ventaProducto.cantidad,
          gananciaBruta: (precioBase - costoBase) * ventaProducto.cantidad,
          descuento: 0,
        };
      });

      const ventaBruta = lineas.reduce((acc, l) => acc + l.bruto, 0);
      totalPeriodo += Math.max(0, ventaBruta - discountTotal);

      // Distribuir cada descuento aplicado solo entre sus productos afectados
      const lineasPorPt = new Map<string, typeof lineas>();
      lineas.forEach((linea) => {
        const ptId = linea.ventaProducto.productoTiendaId;
        if (!lineasPorPt.has(ptId)) lineasPorPt.set(ptId, []);
        lineasPorPt.get(ptId)!.push(linea);
      });

      let descuentoAtribuido = 0;
      for (const ad of venta.appliedDiscounts || []) {
        const amount = Number(ad.amount || 0);
        if (amount <= 0) continue;

        const afectadosIds =
          Array.isArray(ad.productsAffected) &&
          (ad.productsAffected as unknown[]).length > 0
            ? (ad.productsAffected as unknown[])
                .map((x) =>
                  String(
                    (x as { productoTiendaId?: string }).productoTiendaId || "",
                  ),
                )
                .filter(Boolean)
            : Array.from(lineasPorPt.keys());

        const lineasAfectadas = afectadosIds.flatMap(
          (ptId) => lineasPorPt.get(ptId) || [],
        );
        const subtotalAfectado = lineasAfectadas.reduce(
          (acc, l) => acc + l.bruto,
          0,
        );
        if (subtotalAfectado <= 0) continue;

        lineasAfectadas.forEach((linea) => {
          linea.descuento += amount * (linea.bruto / subtotalAfectado);
        });
        descuentoAtribuido += amount;
      }

      // Residual: descuentos sin registro AppliedDiscount (datos antiguos) se
      // prorratean entre todas las líneas para que el neto cuadre con discountTotal
      const residual = discountTotal - descuentoAtribuido;
      if (residual > 0.0001 && ventaBruta > 0) {
        lineas.forEach((linea) => {
          linea.descuento += residual * (linea.bruto / ventaBruta);
        });
      }

      // Pasada 2: acumular métricas netas de descuento
      lineas.forEach(({ ventaProducto, bruto, gananciaBruta, descuento }) => {
        unidadesVendidas += ventaProducto.cantidad;
        const gananciaProducto = gananciaBruta - descuento;
        const ventaNeta = bruto - descuento;
        gananciaTotal += gananciaProducto;

        // Actualizar mapas de productos
        const productoId = ventaProducto.productoTiendaId;
        const nombreProducto = ventaProducto.producto.producto.nombre;
        const nombreProveedor = ventaProducto.producto.proveedor
          ? ventaProducto.producto.proveedor.nombre
          : undefined;

        // Actualizar mapa de unidades vendidas
        if (productosVendidosMap.has(productoId)) {
          const actual = productosVendidosMap.get(productoId)!;
          productosVendidosMap.set(productoId, {
            nombre: nombreProveedor
              ? `${nombreProducto} - ${nombreProveedor}`
              : nombreProducto,
            unidades: actual.unidades + ventaProducto.cantidad,
          });
        } else {
          productosVendidosMap.set(productoId, {
            nombre: nombreProveedor
              ? `${nombreProducto} - ${nombreProveedor}`
              : nombreProducto,
            unidades: ventaProducto.cantidad,
          });
        }

        // Actualizar mapa de ganancias
        if (productosGananciaMap.has(productoId)) {
          const actual = productosGananciaMap.get(productoId)!;
          productosGananciaMap.set(productoId, {
            nombre: nombreProveedor
              ? `${nombreProducto} - ${nombreProveedor}`
              : nombreProducto,
            ganancia: actual.ganancia + gananciaProducto,
          });
        } else {
          productosGananciaMap.set(productoId, {
            nombre: nombreProveedor
              ? `${nombreProducto} - ${nombreProveedor}`
              : nombreProducto,
            ganancia: gananciaProducto,
          });
        }

        // Actualizar mapa de ventas totales netas (para rentabilidad)
        if (productosVentasTotalesMap.has(productoId)) {
          productosVentasTotalesMap.set(
            productoId,
            productosVentasTotalesMap.get(productoId)! + ventaNeta,
          );
        } else {
          productosVentasTotalesMap.set(productoId, ventaNeta);
        }
      });
    });

    // Contar productos activos
    const productosActivos = await prisma.productoTienda.count({
      where: {
        tiendaId: tiendaId,
        existencia: {
          gt: 0,
        },
        deletedAt: null,
      },
    });

    // Gastos, merma y devoluciones de los cierres del rango (mismo alcance que las ventas)
    const gastosAgregados = await prisma.cierrePeriodo.aggregate({
      _sum: { totalGastos: true, totalMerma: true, totalDevoluciones: true },
      where: filtroCierres,
    });
    const totalGastos = gastosAgregados._sum.totalGastos ?? 0;
    const totalMerma = gastosAgregados._sum.totalMerma ?? 0;
    const totalDevoluciones = gastosAgregados._sum.totalDevoluciones ?? 0;
    const gananciaFinal =
      gananciaTotal - totalGastos - totalMerma - totalDevoluciones;

    // Ordenar productos por unidades vendidas y ganancia
    const topProductos = Array.from(productosVendidosMap.values())
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    const topGanancias = Array.from(productosGananciaMap.values())
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 10);

    const productosMenosVendidos = Array.from(productosVendidosMap.values())
      .sort((a, b) => a.unidades - b.unidades)
      .slice(0, 5);

    // Calcular rentabilidad (ganancia / ventas totales del producto)
    const productosMenosRentables = Array.from(productosGananciaMap.entries())
      .map(([id, { nombre, ganancia }]) => {
        // Obtener las ventas totales del producto (precio × cantidad)
        const ventasTotales = productosVentasTotalesMap.get(id) || 0;
        // La rentabilidad es la ganancia dividida por las ventas totales (expresada como porcentaje)
        const rentabilidad =
          ventasTotales > 0 ? (ganancia / ventasTotales) * 100 : 0;

        return {
          nombre,
          rentabilidad: parseFloat(rentabilidad.toFixed(2)),
        };
      })
      .sort((a, b) => a.rentabilidad - b.rentabilidad)
      .slice(0, 5);

    // Construir respuesta
    const response: DashboardResumenMetrics = {
      ventas: {
        totalPeriodo,
        unidadesVendidas,
        gananciaTotal,
        totalGastos,
        totalMerma,
        totalDevoluciones,
        gananciaFinal,
        productosActivos,
      },
      topProductos,
      topGanancias,
      productosMenosVendidos,
      productosMenosRentables,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error en dashboard/resumen:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
