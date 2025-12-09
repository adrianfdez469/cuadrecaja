import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/types/ICierre";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

type Params = { cierreId: string };

type ProductoVentaAcumulado = {
  nombre: string;
  costo: number;
  precio: number;
  cantidad: number;
  total: number;
  ganancia: number;
  // Descuento acumulado aplicado específicamente a este producto (no prorrateado)
  descuento?: number;
  id: string;
  productoId: string;
  proveedor?: { id: string; nombre: string };
  enConsignacion?: boolean;
};


export async function GET(req: NextRequest, { params }: { params: Promise<Params> }): Promise<NextResponse<ICierreData | { error: string }>> {
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
            appliedDiscounts: {
              include: {
                discountRule: {
                  select: { id: true, name: true, appliesTo: true, type: true }
                }
              }
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

    const productosVendidos: Record<string, ProductoVentaAcumulado> = {};
  
    cierre.ventas.forEach((venta) => {
      totalVentas += venta.total;
      totalTransferencia += venta.totaltransfer;
      // Acumular descuentos del período
      totalDescuentos += Number(venta.discountTotal ?? 0);

      // Mapa auxiliar de líneas por productoTiendaId en ESTA venta
      const lineasPorPt: Record<string, { productoKey: string; subtotal: number }[]> = {};

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
            descuento: 0,
            id: productoKey,
            productoId,
            ...(proveedor && { proveedor, enConsignacion: true })
          };
        }

        productosVendidos[productoKey].cantidad += cantidad;
        productosVendidos[productoKey].total += totalProducto;
        productosVendidos[productoKey].ganancia += gananciaProducto;

        // Registrar línea para futura distribución de descuentos por producto
        if (!lineasPorPt[id]) lineasPorPt[id] = [];
        lineasPorPt[id].push({ productoKey, subtotal: totalProducto });
      });

      // Distribuir descuentos aplicados en esta venta entre productos afectados
      const applied = venta.appliedDiscounts || [];
      for (const ad of applied) {
        const amount = Number(ad.amount || 0);
        if (amount <= 0) continue;

        // Determinar los items afectados
        let afectados: { productoTiendaId: string; cantidad?: number }[] = [];
        if (Array.isArray(ad.productsAffected) && (ad.productsAffected as unknown[]).length > 0) {
          afectados = (ad.productsAffected as unknown[]).map((x) => {
            const obj = x as { productoTiendaId?: string; cantidad?: number };
            return { productoTiendaId: String(obj.productoTiendaId || ""), cantidad: typeof obj.cantidad === 'number' ? obj.cantidad : undefined };
          }).filter(a => a.productoTiendaId);
        } else {
          // Si no hay listado de afectados (debería venir), usar todos los productos de la venta
          afectados = Object.keys(lineasPorPt).map(ptId => ({ productoTiendaId: ptId }));
        }

        // Calcular subtotal afectado
        const contribuciones: { productoKey: string; subtotal: number }[] = [];
        for (const a of afectados) {
          const arr = lineasPorPt[a.productoTiendaId] || [];
          for (const ln of arr) {
            contribuciones.push({ productoKey: ln.productoKey, subtotal: ln.subtotal });
          }
        }
        const subtotalAfectado = contribuciones.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
        if (subtotalAfectado <= 0) continue;

        // Repartir el descuento proporcional al subtotal de línea
        let acumulado = 0;
        contribuciones.forEach((it, idx) => {
          const isLast = idx === contribuciones.length - 1;
          const share = isLast ? (amount - acumulado) : (amount * (it.subtotal / subtotalAfectado));
          acumulado += share;
          if (!productosVendidos[it.productoKey]) return;
          productosVendidos[it.productoKey].descuento = (productosVendidos[it.productoKey].descuento || 0) + share;
        });
      }
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
      productosVendidos: Object.values(productosVendidos)
        .map((p) => ({
          ...p,
          // Asegurar números finitos
          descuento: Number(p.descuento || 0)
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
    return NextResponse.json(cierreData);
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
