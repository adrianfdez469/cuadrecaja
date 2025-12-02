import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/types/ICierre";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";


export async function GET(req: NextRequest, { params }: { params: Promise<{ cierreId }> }): Promise<NextResponse<ICierreData|{error: string}>> {
  try {
    
    const { cierreId } = await params;

    const session = await getSession();
    const user = session.user;
  
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
    let totalVentas = 0; // Neto (venta.total)
    let totalGanancia = 0;
    let totalTransferencia = 0;
    let totalVentasBrutas = 0; // Suma de precio * cantidad
    let totalDescuentos = 0;   // Suma de venta.discountTotal
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
      // Acumular descuentos del período
      // @ts-ignore: campo agregado en Prisma (discountTotal)
      totalDescuentos += Number((venta as any).discountTotal || 0);

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

        // Acumular total bruto del período
        totalVentasBrutas += totalProducto;
  
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
        if(verificarPermisoUsuario(user.permisos, "operaciones.cierre.gananciascostos", user.rol)){
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
  
    // Ajuste de ganancias por descuentos
    // Los descuentos reducen la ganancia en la misma magnitud (se descuentan de la venta, no del costo)
    // Para desglosar por tipo (propias vs consignación), prorrateamos el descuento total
    const ventasBrutasTotales = totalVentasBrutas || 0;
    let descuentoPropias = 0;
    let descuentoConsignacion = 0;
    if (ventasBrutasTotales > 0 && totalDescuentos > 0) {
      const ratioPropias = (totalVentasPropias || 0) / ventasBrutasTotales;
      const ratioConsig = (totalVentasConsignacion || 0) / ventasBrutasTotales;
      descuentoPropias = totalDescuentos * ratioPropias;
      descuentoConsignacion = totalDescuentos * ratioConsig;
    }

    // Ganancias netas por tipo tras descuentos (no permitir negativos)
    const totalGananciasPropiasNet = Math.max(0, (totalGananciasPropias || 0) - (descuentoPropias || 0));
    const totalGananciasConsignacionNet = Math.max(0, (totalGananciasConsignacion || 0) - (descuentoConsignacion || 0));
    // Ganancia total neta
    const totalGananciaNeta = Math.max(0, totalGananciasPropiasNet + totalGananciasConsignacionNet);

    const cierreData = {
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin,
      tienda: cierre.tienda,
      totalVentas,
      totalVentasBrutas,
      totalDescuentos,
      // Reportar ganancia neta (ya considerando descuentos)
      totalGanancia: totalGananciaNeta,
      totalTransferencia,
      totalVentasPropias,
      totalVentasConsignacion,
      // También devolver desglose de ganancias netas por tipo
      totalGananciasPropias: totalGananciasPropiasNet,
      totalGananciasConsignacion: totalGananciasConsignacionNet,
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
