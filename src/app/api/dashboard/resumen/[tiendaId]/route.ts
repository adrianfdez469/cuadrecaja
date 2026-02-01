import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import {startOfNextDay} from "@/utils/date";

export interface DashboardResumenMetrics {
  ventas: {
    totalPeriodo: number;
    unidadesVendidas: number;
    gananciaTotal: number;
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
  { params }: { params: Promise<{ tiendaId: string }> }
): Promise<NextResponse<DashboardResumenMetrics | { error: string }>> {
  try {
    const session = await getSession();
    const user = session.user;
    
    if (!user || !verificarPermisoUsuario(user.permisos, "recuperaciones.dashboard.acceder", user.rol)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { tiendaId } = await params;
    
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") || "mes";
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
    
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada o sin acceso" }, { status: 404 });
    }

    // Calcular fechas según el filtro
    const now = new Date();
    let fechaInicioFiltro: Date;
    let fechaFinFiltro: Date = new Date(now);

    switch (periodo) {
      case 'dia':
        fechaInicioFiltro = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'semana':
        fechaInicioFiltro = new Date(now);
        fechaInicioFiltro.setDate(now.getDate() - 7);
        break;
      case 'mes':
        fechaInicioFiltro = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'anio':
        fechaInicioFiltro = new Date(now.getFullYear(), 0, 1);
        break;
      case 'personalizado':
        if (!fechaInicio) {
          return NextResponse.json({ error: "Fecha de inicio requerida para período personalizado" }, { status: 400 });
        }
        fechaInicioFiltro = new Date(fechaInicio);
        if (fechaFin) {
          fechaFinFiltro = startOfNextDay(new Date(fechaFin));
        }
        break;
      default:
        fechaInicioFiltro = new Date(now.getFullYear(), now.getMonth(), 1); // Por defecto, mes actual
    }

    // Obtener ventas del período
    const ventas = await prisma.venta.findMany({
      where: {
        tiendaId: tiendaId,
        createdAt: {
          gte: fechaInicioFiltro,
          lte: fechaFinFiltro
        }
      },
      include: {
        productos: {
          include: {
            producto: {
              include: {
                producto: true,
                proveedor: true
              }
            }
          }
        }
      }
    });

    // Calcular métricas de ventas
    let totalPeriodo = 0;
    let unidadesVendidas = 0;
    let gananciaTotal = 0;
    
    // Mapas para calcular productos más vendidos y más rentables
    const productosVendidosMap = new Map<string, { nombre: string, unidades: number }>();
    const productosGananciaMap = new Map<string, { nombre: string, ganancia: number }>();
    const productosVentasTotalesMap = new Map<string, number>();

    // Procesar ventas
    ventas.forEach(venta => {
      totalPeriodo += venta.total;

      venta.productos.forEach(ventaProducto => {
        unidadesVendidas += ventaProducto.cantidad;
        const gananciaProducto = (ventaProducto.precio - ventaProducto.costo) * ventaProducto.cantidad;
        gananciaTotal += gananciaProducto;

        // Actualizar mapas de productos
        const productoId = ventaProducto.productoTiendaId;
        const nombreProducto = ventaProducto.producto.producto.nombre;
        const nombreProveedor = ventaProducto.producto.proveedor ? ventaProducto.producto.proveedor.nombre : undefined;

        // Actualizar mapa de unidades vendidas
        if (productosVendidosMap.has(productoId)) {
          const actual = productosVendidosMap.get(productoId)!;
          productosVendidosMap.set(productoId, {
            nombre: nombreProveedor ? `${nombreProducto} - ${nombreProveedor}` : nombreProducto,
            unidades: actual.unidades + ventaProducto.cantidad
          });
        } else {
          productosVendidosMap.set(productoId, {
            nombre: nombreProveedor ? `${nombreProducto} - ${nombreProveedor}` : nombreProducto,
            unidades: ventaProducto.cantidad
          });
        }

        // Actualizar mapa de ganancias
        if (productosGananciaMap.has(productoId)) {
          const actual = productosGananciaMap.get(productoId)!;
          productosGananciaMap.set(productoId, {
            nombre: nombreProveedor ? `${nombreProducto} - ${nombreProveedor}` : nombreProducto,
            ganancia: actual.ganancia + gananciaProducto
          });
        } else {
          productosGananciaMap.set(productoId, {
            nombre: nombreProveedor ? `${nombreProducto} - ${nombreProveedor}` : nombreProducto,
            ganancia: gananciaProducto
          });
        }
        
        // Actualizar mapa de ventas totales (precio × cantidad)
        const ventaTotal = ventaProducto.precio * ventaProducto.cantidad;
        if (productosVentasTotalesMap.has(productoId)) {
          productosVentasTotalesMap.set(productoId, productosVentasTotalesMap.get(productoId)! + ventaTotal);
        } else {
          productosVentasTotalesMap.set(productoId, ventaTotal);
        }
      });
    });

    // Contar productos activos
    const productosActivos = await prisma.productoTienda.count({
      where: {
        tiendaId: tiendaId,
        existencia: {
          gt: 0
        }
      }
    });

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
        const rentabilidad = ventasTotales > 0 ? (ganancia / ventasTotales) * 100 : 0;
        
        return {
          nombre,
          rentabilidad: parseFloat(rentabilidad.toFixed(2))
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
        productosActivos
      },
      topProductos,
      topGanancias,
      productosMenosVendidos,
      productosMenosRentables
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error en dashboard/resumen:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
