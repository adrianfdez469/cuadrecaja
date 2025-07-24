import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";

export interface DashboardMetrics {
  ventas: {
    totalPeriodoActual: number;
    totalHoy: number;
    cantidadVentasHoy: number;
    cantidadVentasPeriodo: number;
    promedioVentaDiaria: number;
    crecimientoVentas: number;
  };
  inventario: {
    totalProductos: number;
    productosConStock: number;
    productosSinStock: number;
    valorTotalInventario: number;
    productosStockBajo: number;
  };
  movimientos: {
    totalMovimientos: number;
    movimientosHoy: number;
    entradasHoy: number;
    salidasHoy: number;
  };
  general: {
    diasPeriodoActual: number;
    fechaInicioPeriodo: Date;
    tiendaActual: string;
    ultimaActualizacion: Date;
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
): Promise<NextResponse<DashboardMetrics | { error: string }>> {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { tiendaId } = await params;
    
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") || "periodo";
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    // Verificar acceso a la tienda
    const tienda = await prisma.tienda.findFirst({
      where: user.rol === "SUPER_ADMIN" 
        ? { id: tiendaId } // SUPER_ADMIN puede acceder a cualquier tienda
        : {
            id: tiendaId,
            usuario: {
              some: { id: user.id }
            }
          }
    });
    console.log('tienda', tienda);
    
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada o sin acceso" }, { status: 404 });
    }

    // Obtener período actual
    const periodoActual = await prisma.cierrePeriodo.findFirst({
      where: {
        tiendaId: tiendaId,
        fechaFin: null
      },
      orderBy: {
        fechaInicio: 'desc'
      }
    });

    if (!periodoActual) {
      return NextResponse.json({ error: "No hay período activo" }, { status: 404 });
    }

    // Calcular fechas según el filtro
    const now = new Date();
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    let fechaInicioFiltro: Date;
    let fechaFinFiltro: Date;

    switch (periodo) {
      case 'hoy':
        fechaInicioFiltro = hoy;
        fechaFinFiltro = mañana;
        break;
      case 'semana':
        fechaInicioFiltro = new Date(hoy);
        fechaInicioFiltro.setDate(hoy.getDate() - hoy.getDay());
        fechaFinFiltro = new Date(fechaInicioFiltro);
        fechaFinFiltro.setDate(fechaInicioFiltro.getDate() + 7);
        break;
      case 'mes':
        fechaInicioFiltro = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaFinFiltro = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
        break;
      case 'personalizado':
        if (!fechaInicio || !fechaFin) {
          return NextResponse.json({ error: "Fechas requeridas para período personalizado" }, { status: 400 });
        }
        fechaInicioFiltro = new Date(fechaInicio);
        fechaFinFiltro = new Date(fechaFin);
        fechaFinFiltro.setDate(fechaFinFiltro.getDate() + 1);
        break;
      default: // 'periodo'
        fechaInicioFiltro = periodoActual.fechaInicio;
        fechaFinFiltro = now;
        break;
    }

    // Consultas paralelas para obtener todas las métricas
    const [
      ventasPeriodo,
      ventasHoy,
      productos,
      movimientos,
      movimientosHoy,
      periodoAnterior
    ] = await Promise.all([
      // Ventas del período filtrado
      prisma.venta.findMany({
        where: {
          tiendaId: tiendaId,
          createdAt: {
            gte: fechaInicioFiltro,
            lt: fechaFinFiltro
          }
        },
        select: {
          total: true,
          createdAt: true
        }
      }),

      // Ventas de hoy
      prisma.venta.findMany({
        where: {
          tiendaId: tiendaId,
          createdAt: {
            gte: hoy,
            lt: mañana
          }
        },
        select: {
          total: true
        }
      }),

      // Productos e inventario
      prisma.productoTienda.findMany({
        where: {
          tiendaId: tiendaId,
          precio: { gt: 0 }
        },
        select: {
          existencia: true,
          precio: true,
          costo: true
        }
      }),

      // Movimientos del período
      prisma.movimientoStock.count({
        where: {
          productoTienda: {
            tiendaId: tiendaId
          },
          fecha: {
            gte: fechaInicioFiltro,
            lt: fechaFinFiltro
          }
        }
      }),

      // Movimientos de hoy
      prisma.movimientoStock.findMany({
        where: {
          productoTienda: {
            tiendaId: tiendaId
          },
          fecha: {
            gte: hoy,
            lt: mañana
          }
        },
        select: {
          tipo: true
        }
      }),

      // Período anterior para calcular crecimiento
      prisma.venta.findMany({
        where: {
          tiendaId: tiendaId,
          createdAt: {
            gte: new Date(fechaInicioFiltro.getTime() - (fechaFinFiltro.getTime() - fechaInicioFiltro.getTime())),
            lt: fechaInicioFiltro
          }
        },
        select: {
          total: true
        }
      })
    ]);

    // Calcular métricas de ventas
    const totalVentasPeriodo = ventasPeriodo.reduce((sum, venta) => sum + (venta.total || 0), 0);
    const totalVentasHoy = ventasHoy.reduce((sum, venta) => sum + (venta.total || 0), 0);
    const cantidadVentasPeriodo = ventasPeriodo.length;
    const cantidadVentasHoy = ventasHoy.length;
    
    const diasPeriodo = Math.max(1, Math.ceil((fechaFinFiltro.getTime() - fechaInicioFiltro.getTime()) / (1000 * 60 * 60 * 24)));
    const promedioVentaDiaria = totalVentasPeriodo / diasPeriodo;

    // Calcular crecimiento
    const totalVentasPeriodoAnterior = periodoAnterior.reduce((sum, venta) => sum + (venta.total || 0), 0);
    const crecimientoVentas = totalVentasPeriodoAnterior > 0 
      ? ((totalVentasPeriodo - totalVentasPeriodoAnterior) / totalVentasPeriodoAnterior) * 100 
      : 0;

    // Calcular métricas de inventario
    const totalProductos = productos.length;
    const productosConStock = productos.filter(p => p.existencia > 0).length;
    const productosSinStock = productos.filter(p => p.existencia <= 0).length;
    const productosStockBajo = productos.filter(p => p.existencia > 0 && p.existencia <= 5).length;
    const valorTotalInventario = productos.reduce((sum, p) => sum + (p.existencia * p.precio), 0);

    // Calcular métricas de movimientos
    const totalMovimientos = movimientos;
    const movimientosHoyCount = movimientosHoy.length;
    
    // Función para determinar si es movimiento de entrada o salida
    const isMovimientoBaja = (tipo: string): boolean => {
      return ['VENTA', 'BAJA', 'TRANSFERENCIA_SALIDA'].includes(tipo);
    };

    const entradasHoy = movimientosHoy.filter(m => !isMovimientoBaja(m.tipo)).length;
    const salidasHoy = movimientosHoy.filter(m => isMovimientoBaja(m.tipo)).length;

    const metrics: DashboardMetrics = {
      ventas: {
        totalPeriodoActual: totalVentasPeriodo,
        totalHoy: totalVentasHoy,
        cantidadVentasHoy: cantidadVentasHoy,
        cantidadVentasPeriodo: cantidadVentasPeriodo,
        promedioVentaDiaria: promedioVentaDiaria,
        crecimientoVentas: crecimientoVentas
      },
      inventario: {
        totalProductos: totalProductos,
        productosConStock: productosConStock,
        productosSinStock: productosSinStock,
        valorTotalInventario: valorTotalInventario,
        productosStockBajo: productosStockBajo
      },
      movimientos: {
        totalMovimientos: totalMovimientos,
        movimientosHoy: movimientosHoyCount,
        entradasHoy: entradasHoy,
        salidasHoy: salidasHoy
      },
      general: {
        diasPeriodoActual: diasPeriodo,
        fechaInicioPeriodo: fechaInicioFiltro,
        tiendaActual: tienda.nombre,
        ultimaActualizacion: now
      }
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener métricas del dashboard" },
      { status: 500 }
    );
  }
} 