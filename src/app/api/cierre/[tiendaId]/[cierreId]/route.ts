import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/types/ICierre";
import { hasAdminPrivileges } from "@/utils/auth";


export async function GET(req: NextRequest, { params }: { params: Promise<{ cierreId }> }): Promise<NextResponse<ICierreData|{error: string}>> {
  try {
    
    const { cierreId } = await params;
  
    const cierre = await prisma.cierrePeriodo.findUnique({
      where: { id: cierreId },
      include: {
        tienda: true, // Datos de la tienda
        ventas: {
          include: {
            productos: {
              include: {
                producto: {
                  include: {
                    producto: {
                      select: {
                        nombre: true
                      }
                    },
                    // Incluir información del proveedor para productos en consignación
                    proveedor: {
                      select: {
                        id: true,
                        nombre: true,
                      }
                    }
                  }
                }, // Datos del producto vendido
  
              },
            },
            transferDestination: {
              select: {
                id: true,
                nombre: true,
              }
            },
            usuario: {
              select: {
                id: true,
                nombre: true,
              }
            }
          },
        },
      },
    });
  
    if (!cierre) {
      throw new Error('Cierre no encontrado');
    }
  
    // Calcular totales
    let totalVentas = 0;
    let totalGanancia = 0;
    let totalTransferencia = 0;
    let totalVentasPropias = 0;
    let totalVentasConsignacion = 0;
    let totalGananciasPropias = 0;
    let totalGananciasConsignacion = 0;
    const totalTransferenciasByDestination: {
      id: string;
      nombre: string;
      total: number;
    }[] = [];
    const totalVentasPorUsuario: {
      id: string;
      nombre: string;
      total: number;
    }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productosVendidos: Record<string, any> = {};
  
    cierre.ventas.forEach((venta) => {
      totalVentas += venta.total;
      totalTransferencia += venta.totaltransfer;

      if(venta.transferDestination) {
        const { id, nombre } = venta.transferDestination;
        if(!totalTransferenciasByDestination.find(t => t.id === id)) {
          totalTransferenciasByDestination.push({ id, nombre, total: 0 });
        }
        totalTransferenciasByDestination.find(t => t.id === id).total += venta.totaltransfer;
      }

      if(!totalVentasPorUsuario.find(u => u.id === venta.usuario.id)) {
        totalVentasPorUsuario.push({ id: venta.usuario.id, nombre: venta.usuario.nombre, total: 0 });
      }
      totalVentasPorUsuario.find(u => u.id === venta.usuario.id).total += venta.total;
  
      venta.productos.forEach((ventaProducto) => {
        const { producto: productoTienda, cantidad, costo, precio } = ventaProducto;
        const { id, productoId, producto: {nombre}, proveedor } = productoTienda;
  
        const totalProducto = cantidad * precio;
        const gananciaProducto = cantidad * (precio - costo);
  
        // Separar por tipo de producto
        if (proveedor) {
          totalVentasConsignacion += totalProducto;
          totalGananciasConsignacion += gananciaProducto;
        } else {
          totalVentasPropias += totalProducto;
          totalGananciasPropias += gananciaProducto;
        }

        // Crear clave única que incluya el proveedor para productos en consignación
        let productoKey;
        if(hasAdminPrivileges()){
          productoKey = proveedor ? `${id}-${proveedor.id}-${costo}-${precio}` : `${id}-${costo}-${precio}`;
        } else {
          productoKey = proveedor ? `${id}-${proveedor.id}` : id;
        }
  
        if (!productosVendidos[productoKey]) {
          productosVendidos[productoKey] = {
            nombre,
            costo,
            precio,
            cantidad: 0,
            total: 0,
            ganancia: 0,
            id: productoKey,
            productoId,
            ...(proveedor && { proveedor, enConsignacion: true })
          };
        }
  
        productosVendidos[productoKey].cantidad += cantidad;
        productosVendidos[productoKey].total += totalProducto;
        productosVendidos[productoKey].ganancia += gananciaProducto;
  
        totalGanancia += gananciaProducto;
      });
    });
  
    const cierreData = {
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin,
      tienda: cierre.tienda,
      totalVentas,
      totalGanancia,
      totalTransferencia,
      totalVentasPropias,
      totalVentasConsignacion,
      totalGananciasPropias,
      totalGananciasConsignacion,
      totalTransferenciasByDestination,
      totalVentasPorUsuario,
      productosVendidos: Object.values(productosVendidos).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
    return NextResponse.json(cierreData);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
