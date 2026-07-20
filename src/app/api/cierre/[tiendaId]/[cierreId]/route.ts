import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/schemas/cierre";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import {
  convertToBase,
  convertFromBase,
  buildTasaSnapshot,
} from "@/lib/currency";
import { applyGastosToResumenMap, calcularGananciaFinal } from "@/lib/gastos";
import {
  applyComprasYDevolucionesToResumenMap,
  buildResumenMonedas,
  montoCompraEnCaja,
} from "@/lib/movimiento/caja";

type Params = { tiendaId: string; cierreId: string };

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
    const { tiendaId, cierreId } = await params;

    const session = await getSession();
    const user = session.user;

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: {
        id: cierreId,
        tiendaId,
        tienda: { negocioId: user.negocio.id },
      },
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

    // Load gastos to deduct from per-currency summary, and the period's
    // compras/merma/devoluciones movements — independent queries, fetched
    // together instead of one after another.
    const [gastosDelPeriodo, movimientosPeriodo] = await Promise.all([
      prisma.gastoCierre.findMany({
        where: { cierreId },
        select: {
          id: true,
          nombre: true,
          tipoCalculo: true,
          montoCalculado: true,
          monedaCode: true,
          naturaleza: true,
          esAdHoc: true,
          gastoTiendaId: true,
        },
      }),
      prisma.movimientoStock.findMany({
        where: {
          tiendaId: cierre.tiendaId,
          tipo: { in: ["COMPRA", "MERMA", "DEVOLUCION_VENTA"] },
          fecha: {
            gte: cierre.fechaInicio,
            ...(cierre.fechaFin && { lte: cierre.fechaFin }),
          },
        },
        include: {
          productoTienda: {
            include: { producto: { select: { nombre: true } } },
          },
        },
        orderBy: { fecha: "desc" },
      }),
    ]);

    type DeduccionItem = {
      id: string;
      tipo: "GASTO" | "MERMA" | "DEVOLUCION" | "COMPRA";
      label: string;
      monto: number;
      motivo?: string | null;
      esAdHoc?: boolean;
    };
    // Detalle de todo lo que resta de la GANANCIA final (gastos operativos, merma, devoluciones)
    const gananciaDeducciones: DeduccionItem[] = [];
    // Detalle de todo lo que resta de la CAJA, agrupado por moneda (gastos de cualquier
    // naturaleza, compras pagadas en efectivo, reembolsos de devolución)
    const cajaDeduccionesPorMoneda: Record<string, DeduccionItem[]> = {};
    const pushCaja = (moneda: string, item: DeduccionItem) => {
      if (!cajaDeduccionesPorMoneda[moneda])
        cajaDeduccionesPorMoneda[moneda] = [];
      cajaDeduccionesPorMoneda[moneda].push(item);
    };

    for (const g of gastosDelPeriodo) {
      const moneda = g.monedaCode ?? monedaBase;
      if (g.naturaleza === "OPERATIVO") {
        gananciaDeducciones.push({
          id: g.id,
          tipo: "GASTO",
          label: g.nombre,
          monto: convertToBase(
            g.montoCalculado,
            moneda,
            tasasFallback,
            monedaBase,
          ),
          esAdHoc: g.esAdHoc,
        });
      }
      // Todos los gastos (ambas naturalezas) restan de caja
      pushCaja(moneda, {
        id: g.id,
        tipo: "GASTO",
        label: g.nombre,
        monto: g.montoCalculado,
        esAdHoc: g.esAdHoc,
      });
    }
    // Los gastos recurrentes aún no aplicados (sin GastoCierre persistido) NO se
    // restan aquí: esta ganancia es la "en vivo" del período abierto y solo debe
    // reflejar lo que ya se aplicó de verdad. La proyección de recurrentes se
    // muestra únicamente en el diálogo de confirmación al cerrar caja
    // (ver /api/gastos/cierre/[cierreId]/preview), justo antes de aplicarlos.

    const totalGastos = gananciaDeducciones
      .filter((d) => d.tipo === "GASTO")
      .reduce((s, d) => s + d.monto, 0);

    // Compras (efectivo de caja), merma y devoluciones de venta registradas en este período
    let totalComprasCaja = 0;
    let totalMerma = 0;
    let totalDevoluciones = 0;
    for (const m of movimientosPeriodo) {
      const productoNombre = m.productoTienda?.producto?.nombre ?? "Producto";
      const montoCompraCaja = m.tipo === "COMPRA" ? montoCompraEnCaja(m) : 0;
      if (m.tipo === "COMPRA" && montoCompraCaja > 0) {
        // costoTotal de una COMPRA está en la moneda de la compra, no en monedaBase
        totalComprasCaja += convertToBase(
          montoCompraCaja,
          m.monedaOriginal ?? monedaBase,
          tasasFallback,
          monedaBase,
        );
        const moneda = m.monedaOriginal ?? monedaBase;
        pushCaja(moneda, {
          id: m.id,
          tipo: "COMPRA",
          label:
            m.formaPago === "MIXTO"
              ? `${productoNombre} (mixto: ${(m.montoOriginal ?? 0) - montoCompraCaja} de fondeo externo)`
              : productoNombre,
          monto: montoCompraCaja,
          motivo: m.motivo,
        });
      } else if (m.tipo === "MERMA") {
        totalMerma += m.costoTotal ?? 0;
        gananciaDeducciones.push({
          id: m.id,
          tipo: "MERMA",
          label: productoNombre,
          monto: m.costoTotal ?? 0,
          motivo: m.motivo,
        });
      } else if (m.tipo === "DEVOLUCION_VENTA") {
        const gananciaImpacto = (m.montoReembolso ?? 0) - (m.costoTotal ?? 0);
        totalDevoluciones += gananciaImpacto;
        gananciaDeducciones.push({
          id: m.id,
          tipo: "DEVOLUCION",
          label: productoNombre,
          monto: gananciaImpacto,
          motivo: m.motivo,
        });
        // Este panel muestra el monto en SU PROPIA moneda (no monedaBase);
        // si falta montoOriginal, convertir montoReembolso (que sí está en
        // monedaBase) a esa moneda en vez de asumir que ya coinciden.
        const moneda = m.monedaOriginal ?? monedaBase;
        const montoEnMoneda =
          m.montoOriginal ??
          (m.monedaOriginal
            ? convertFromBase(
                m.montoReembolso ?? 0,
                m.monedaOriginal,
                tasasFallback,
                monedaBase,
              )
            : (m.montoReembolso ?? 0));
        pushCaja(moneda, {
          id: m.id,
          tipo: "DEVOLUCION",
          label: productoNombre,
          monto: montoEnMoneda,
          motivo: m.motivo,
        });
      }
    }

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

    // Snapshot del bruto (antes de restar gastos/compras/devoluciones) para
    // poder mostrar "bruto tachado -> final" en el desglose por moneda
    const resumenMonedaBrutoMap: Record<
      string,
      { totalEfectivo: number; equivalenteBase: number }
    > = {};
    for (const [code, vals] of Object.entries(resumenMonedaMap)) {
      resumenMonedaBrutoMap[code] = {
        totalEfectivo: vals.totalEfectivo,
        equivalenteBase: vals.equivalenteBase,
      };
    }

    applyGastosToResumenMap(
      resumenMonedaMap,
      gastosDelPeriodo,
      monedaBase,
      tasasFallback,
    );
    applyComprasYDevolucionesToResumenMap(
      resumenMonedaMap,
      movimientosPeriodo,
      monedaBase,
      tasasFallback,
    );

    const totalGananciaFinal = calcularGananciaFinal(
      totalGananciaNeta,
      totalGastos,
      totalMerma,
      totalDevoluciones,
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
      // Ventas netas de descuento por tipo (bruto - descuentoPropias/Consignacion)
      totalVentasPropiasNeto: Math.max(
        0,
        totalVentasPropias - descuentoPropias,
      ),
      totalVentasConsignacionNeto: Math.max(
        0,
        totalVentasConsignacion - descuentoConsignacion,
      ),
      // También devolver desglose de ganancias netas por tipo
      totalGananciasPropias: totalGananciasPropiasNet,
      totalGananciasConsignacion: totalGananciasConsignacionNet,
      totalTransferenciasByDestination,
      totalVentasPorUsuario,
      totalGastos,
      totalGananciaFinal,
      totalComprasCaja,
      totalMerma,
      totalDevoluciones,
      gananciaDeducciones,
      cajaDeducciones: cajaDeduccionesPorMoneda,
      resumenMonedas: Object.entries(resumenMonedaMap).map(
        ([monedaCode, vals]) => ({
          ...vals,
          id: monedaCode,
          monedaCode,
          totalEfectivoBruto:
            resumenMonedaBrutoMap[monedaCode]?.totalEfectivo ??
            vals.totalEfectivo,
          equivalenteBaseBruto:
            resumenMonedaBrutoMap[monedaCode]?.equivalenteBase ??
            vals.equivalenteBase,
        }),
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
