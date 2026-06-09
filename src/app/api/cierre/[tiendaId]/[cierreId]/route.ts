import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/schemas/cierre";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { applyGastosToResumenMap } from "@/lib/gastos";

type Params = { cierreId: string };

function buildResumenMonedas(
  ventas: {
    pagosDetalle?: unknown;
    vueltoDetalle?: unknown;
    tasaSnapshot?: unknown;
  }[],
  monedaBase: string,
  tasasFallback: ITasaSnapshot = {},
) {
  const map: Record<
    string,
    { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
  > = {};
  for (const venta of ventas) {
    if (!venta.pagosDetalle) continue;
    const pagos = venta.pagosDetalle as IPagoLinea[];
    const tasas = {
      ...tasasFallback,
      ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
    };
    for (const pago of pagos) {
      if (!map[pago.moneda])
        map[pago.moneda] = {
          totalEfectivo: 0,
          totalTransfer: 0,
          equivalenteBase: 0,
        };
      if (pago.tipo === "cash") map[pago.moneda].totalEfectivo += pago.monto;
      else map[pago.moneda].totalTransfer += pago.monto;
      map[pago.moneda].equivalenteBase += convertToBase(
        pago.monto,
        pago.moneda,
        tasas,
        monedaBase,
      );
    }
    // Subtract change given — reduces physical cash on hand per currency
    if (venta.vueltoDetalle) {
      const vueltos = venta.vueltoDetalle as IVueltoLinea[];
      for (const vuelto of vueltos) {
        if (!map[vuelto.moneda])
          map[vuelto.moneda] = {
            totalEfectivo: 0,
            totalTransfer: 0,
            equivalenteBase: 0,
          };
        map[vuelto.moneda].totalEfectivo -= vuelto.monto;
        map[vuelto.moneda].equivalenteBase -= convertToBase(
          vuelto.monto,
          vuelto.moneda,
          tasas,
          monedaBase,
        );
      }
    }
  }
  return Object.entries(map).map(([monedaCode, vals]) => ({
    id: monedaCode,
    monedaCode,
    ...vals,
  }));
}

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse<ICierreData | { error: string }>> {
  try {
    const { cierreId } = await params;

    const session = await getSession();
    const user = session.user;

    const cierre = await prisma.cierrePeriodo.findUnique({
      where: { id: cierreId },
      include: {
        tienda: {
          include: { negocio: { select: { id: true, monedaBase: true } } },
        },
        resumenMonedas: true,
        ventas: {
          include: {
            productos: {
              include: {
                producto: {
                  include: {
                    producto: {
                      select: {
                        nombre: true,
                      },
                    },
                    // Incluir información del proveedor para productos en consignación
                    proveedor: {
                      select: {
                        id: true,
                        nombre: true,
                      },
                    },
                  },
                }, // Datos del producto vendido
              },
            },
            appliedDiscounts: {
              include: {
                discountRule: {
                  select: { id: true, name: true, appliesTo: true, type: true },
                },
              },
            },
            transferDestination: {
              select: {
                id: true,
                nombre: true,
              },
            },
            usuario: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!cierre) {
      throw new Error("Cierre no encontrado");
    }

    const monedaBase = cierre.tienda.negocio?.monedaBase ?? "CUP";

    // Fetch current rates as fallback for sales without a full tasaSnapshot
    const negocioId = cierre.tienda.negocio?.id;
    const tasasCambioActuales = negocioId
      ? await prisma.tasaCambio.findMany({
          where: { negocioId },
          select: { monedaCode: true, tasa: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const tasasFallback = buildTasaSnapshot(tasasCambioActuales);

    // Calcular totales
    let totalVentas = 0; // Neto (venta.total)
    let totalTransferencia = 0;
    let totalVentasBrutas = 0; // Suma de precio * cantidad
    let totalDescuentos = 0; // Suma de venta.discountTotal
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
      totalTransferencia += venta.totaltransfer;
      // Acumular descuentos del período
      totalDescuentos += Number(venta.discountTotal ?? 0);

      // Mapa auxiliar de líneas por productoTiendaId en ESTA venta
      const lineasPorPt: Record<
        string,
        { productoKey: string; subtotal: number }[]
      > = {};

      if (venta.transferDestination) {
        const { id, nombre } = venta.transferDestination;
        if (!totalTransferenciasByDestination.find((t) => t.id === id)) {
          totalTransferenciasByDestination.push({ id, nombre, total: 0 });
        }
        totalTransferenciasByDestination.find((t) => t.id === id).total +=
          venta.totaltransfer;
      }

      if (!totalVentasPorUsuario.find((u) => u.id === venta.usuario.id)) {
        totalVentasPorUsuario.push({
          id: venta.usuario.id,
          nombre: venta.usuario.nombre,
          total: 0,
        });
      }

      const tasasVenta = {
        ...tasasFallback,
        ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
      };
      let ventaBruta = 0;
      venta.productos.forEach((ventaProducto) => {
        const {
          producto: productoTienda,
          cantidad,
          costo,
          precio,
          monedaCostoCode,
          monedaPrecioCode,
        } = ventaProducto;
        const {
          id,
          productoId,
          producto: { nombre },
          proveedor,
        } = productoTienda;

        const precioBase = convertToBase(
          precio,
          monedaPrecioCode ?? monedaBase,
          tasasVenta,
          monedaBase,
        );
        const costoBase = convertToBase(
          costo,
          monedaCostoCode ?? monedaBase,
          tasasVenta,
          monedaBase,
        );
        const totalProducto = cantidad * precioBase;
        const gananciaProducto = cantidad * (precioBase - costoBase);

        // Acumular total bruto del período
        totalVentasBrutas += totalProducto;
        ventaBruta += totalProducto;

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
        if (
          verificarPermisoUsuario(
            user.permisos,
            "operaciones.cierre.gananciascostos",
            user.rol,
          )
        ) {
          productoKey = proveedor
            ? `${id}-${proveedor.id}-${costoBase}-${precioBase}`
            : `${id}-${costoBase}-${precioBase}`;
        } else {
          productoKey = proveedor ? `${id}-${proveedor.id}` : id;
        }

        if (!productosVendidos[productoKey]) {
          productosVendidos[productoKey] = {
            nombre,
            costo: costoBase,
            precio: precioBase,
            cantidad: 0,
            total: 0,
            ganancia: 0,
            descuento: 0,
            id: productoKey,
            productoId,
            ...(proveedor && { proveedor, enConsignacion: true }),
          };
        }

        productosVendidos[productoKey].cantidad += cantidad;
        productosVendidos[productoKey].total += totalProducto;
        productosVendidos[productoKey].ganancia += gananciaProducto;

        // Registrar línea para futura distribución de descuentos por producto
        if (!lineasPorPt[id]) lineasPorPt[id] = [];
        lineasPorPt[id].push({ productoKey, subtotal: totalProducto });
      });

      // Acumular totales netos por venta usando montos calculados desde los productos
      const ventaDescuento = Number(venta.discountTotal ?? 0);
      const ventaNeta = Math.max(0, ventaBruta - ventaDescuento);
      totalVentas += ventaNeta;
      totalVentasPorUsuario.find((u) => u.id === venta.usuario.id).total +=
        ventaNeta;

      // Distribuir descuentos aplicados en esta venta entre productos afectados
      const applied = venta.appliedDiscounts || [];
      for (const ad of applied) {
        const amount = Number(ad.amount || 0);
        if (amount <= 0) continue;

        // Determinar los items afectados
        let afectados: { productoTiendaId: string; cantidad?: number }[] = [];
        if (
          Array.isArray(ad.productsAffected) &&
          (ad.productsAffected as unknown[]).length > 0
        ) {
          afectados = (ad.productsAffected as unknown[])
            .map((x) => {
              const obj = x as { productoTiendaId?: string; cantidad?: number };
              return {
                productoTiendaId: String(obj.productoTiendaId || ""),
                cantidad:
                  typeof obj.cantidad === "number" ? obj.cantidad : undefined,
              };
            })
            .filter((a) => a.productoTiendaId);
        } else {
          // Si no hay listado de afectados (debería venir), usar todos los productos de la venta
          afectados = Object.keys(lineasPorPt).map((ptId) => ({
            productoTiendaId: ptId,
          }));
        }

        // Calcular subtotal afectado
        const contribuciones: { productoKey: string; subtotal: number }[] = [];
        for (const a of afectados) {
          const arr = lineasPorPt[a.productoTiendaId] || [];
          for (const ln of arr) {
            contribuciones.push({
              productoKey: ln.productoKey,
              subtotal: ln.subtotal,
            });
          }
        }
        const subtotalAfectado = contribuciones.reduce(
          (acc, it) => acc + (Number(it.subtotal) || 0),
          0,
        );
        if (subtotalAfectado <= 0) continue;

        // Repartir el descuento proporcional al subtotal de línea
        let acumulado = 0;
        contribuciones.forEach((it, idx) => {
          const isLast = idx === contribuciones.length - 1;
          const share = isLast
            ? amount - acumulado
            : amount * (it.subtotal / subtotalAfectado);
          acumulado += share;
          if (!productosVendidos[it.productoKey]) return;
          productosVendidos[it.productoKey].descuento =
            (productosVendidos[it.productoKey].descuento || 0) + share;
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
    const totalGananciasPropiasNet = Math.max(
      0,
      (totalGananciasPropias || 0) - (descuentoPropias || 0),
    );
    const totalGananciasConsignacionNet = Math.max(
      0,
      (totalGananciasConsignacion || 0) - (descuentoConsignacion || 0),
    );
    // Ganancia total neta
    const totalGananciaNeta = Math.max(
      0,
      totalGananciasPropiasNet + totalGananciasConsignacionNet,
    );

    // Load gastos to deduct from per-currency summary
    const gastosDelPeriodo = await prisma.gastoCierre.findMany({
      where: { cierreId },
      select: { tipoCalculo: true, montoCalculado: true, monedaCode: true },
    });
    const resumenMonedaMap = buildResumenMonedas(
      cierre.ventas,
      monedaBase,
      tasasFallback,
    ).reduce<
      Record<
        string,
        {
          monedaCode: string;
          totalEfectivo: number;
          totalTransfer: number;
          equivalenteBase: number;
        }
      >
    >((acc, r) => {
      acc[r.monedaCode] = r;
      return acc;
    }, {});
    applyGastosToResumenMap(
      resumenMonedaMap,
      gastosDelPeriodo,
      monedaBase,
      tasasFallback,
    );

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
      resumenMonedas: Object.entries(resumenMonedaMap).map(
        ([monedaCode, vals]) => ({ ...vals, id: monedaCode, monedaCode }),
      ),
      productosVendidos: Object.values(productosVendidos)
        .map((p) => ({
          ...p,
          // Asegurar números finitos
          descuento: Number(p.descuento || 0),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
    return NextResponse.json(cierreData);
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al obtener los datos del cierre" },
      { status: 500 },
    );
  }
}
