import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/types/ICierre";


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
                    }
                  }
                }, // Datos del producto vendido
  
              },
            },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productosVendidos: Record<string, any> = {};
  
    cierre.ventas.forEach((venta) => {
      totalVentas += venta.total;
  
      venta.productos.forEach((ventaProducto) => {
        const { producto: productoTienda, cantidad } = ventaProducto;
        const { id, producto: {nombre}, costo, precio } = productoTienda;
  
        const totalProducto = cantidad * precio;
        const gananciaProducto = cantidad * (precio - costo);
  
        if (!productosVendidos[id]) {
          productosVendidos[id] = {
            nombre,
            costo,
            precio,
            cantidad: 0,
            total: 0,
            ganancia: 0,
            id: id
          };
        }
  
        productosVendidos[id].cantidad += cantidad;
        productosVendidos[id].total += totalProducto;
        productosVendidos[id].ganancia += gananciaProducto;
  
        totalGanancia += gananciaProducto;
      });
    });
  
    const cierreData = {
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin,
      tienda: cierre.tienda,
      totalVentas,
      totalGanancia,
      productosVendidos: Object.values(productosVendidos).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
    return NextResponse.json(cierreData);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
