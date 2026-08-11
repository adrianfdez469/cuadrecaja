import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { IVenta } from "@/schemas/venta";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { applyDiscountsForSale } from "@/lib/discounts";
import { calcularEfectivoDisponiblePorMoneda } from "@/lib/movimiento/caja";
import { packsToOpen, unitsFromPacks } from "@/lib/fractionStock";

// El vuelto solicitado en una venta en tiempo real supera el efectivo
// realmente disponible en esa moneda. Ver la validación dentro de la
// transacción más abajo para el porqué de la excepción con wasOffline.
class InsufficientCashForChangeError extends Error {
  constructor(
    public readonly currency: string,
    public readonly requestedChange: number,
    public readonly available: number,
  ) {
    super("INSUFFICIENT_CASH_FOR_CHANGE");
  }
}

// Tipos auxiliares estrictos para evitar usos de any
interface IncomingProduct {
  productoTiendaId: string;
  cantidad: number;
  name?: string;
  price?: number;
  precio?: number;
  productId?: string;
}

interface ProductoExistenteSelect {
  id: string;
  productoId: string;
  existencia: number;
  costo: number;
  precio: number;
  monedaCostoCode: string | null;
  monedaPrecioCode: string | null;
  proveedorId: string | null;
  producto: { permiteDecimal: boolean };
}

type MergedProduct = ProductoExistenteSelect & IncomingProduct;

// Crear una venta
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  let syncId: string | undefined;

  try {
    const { cierreId, tiendaId } = await params;

    const {
      usuarioId,
      productos,
      total,
      totalcash,
      totaltransfer,
      transferDestinationId,

      syncId: syncIdBody,
      createdAt,
      wasOffline,
      syncAttempts,
      discountCodes,
      // Multimoneda (opcionales — backward-compatible)
      monedaCobro,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot,
    } = await req.json();

    syncId = syncIdBody;

    if (
      !tiendaId ||
      !usuarioId ||
      !cierreId ||
      !productos.length ||
      !syncId ||
      !createdAt
    ) {
      console.error("❌ [POST /api/venta] Datos insuficientes:", {
        tiendaId,
        usuarioId,
        cierreId,
        productosLength: productos.length,
        syncId,
        createdAt,
      });
      return NextResponse.json(
        { error: "Datos insuficientes para crear la venta" },
        { status: 400 },
      );
    }

    // Verificar si ya existe una venta con este syncId (idempotencia)
    const existeVenta = await prisma.venta.findFirst({
      where: {
        syncId: syncId,
      },
      include: {
        productos: true,
      },
    });

    if (existeVenta) {
      return NextResponse.json(existeVenta, { status: 200 });
    }

    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId, fechaFin: null },
      orderBy: { fechaInicio: "desc" },
    });

    if (!ultimoPeriodo) {
      return NextResponse.json(
        { error: "No existe un período abierto en la tienda" },
        { status: 404 },
      );
    }

    // 🆕 VALIDACIÓN: Verificar que la venta pertenece al período actual
    if (ultimoPeriodo.id !== cierreId) {
      // Buscar el período
      const periodoDeLaVenta = await prisma.cierrePeriodo.findUnique({
        where: {
          id: cierreId,
        },
      });

      if (!periodoDeLaVenta) {
        return NextResponse.json(
          { error: "No existe un período con el id proporcionado" },
          { status: 404 },
        );
      }

      const ventaCreatedAt = new Date(createdAt);
      const periodoInicio = new Date(periodoDeLaVenta.fechaInicio);
      const periodoFin =
        periodoDeLaVenta.fechaFin && new Date(periodoDeLaVenta.fechaFin);
      return NextResponse.json(
        {
          error: `La venta fue creada fuera del período actual. Venta: ${ventaCreatedAt.toLocaleString()}, Período: ${periodoInicio.toLocaleString()} - ${periodoFin.toLocaleString()}. No se puede sincronizar ventas de períodos anteriores.`,
          ventaCreatedAt: ventaCreatedAt.toISOString(),
          periodoInicio: periodoInicio.toISOString(),
          periodoFin: periodoFin ? periodoFin.toISOString() : undefined,
        },
        { status: 400 },
      );
    }

    // ----------------------------------------------------------------------
    // Lecturas y cálculos FUERA de la transacción.
    // Con el transaction pooler (pgbouncer, connection_limit=1) cualquier query
    // que corra dentro del $transaction usando el cliente global `prisma` (como
    // applyDiscountsForSale) pide una 2ª conexión inexistente y provoca el error
    // "Transaction already closed". Además, sacar las lecturas reduce el tiempo
    // dentro del tx. Ver PERFORMANCE_ISSUES.md (P0).
    // ----------------------------------------------------------------------

    // 1. Verificar que todos los productos existen
    const productosExistentes = await prisma.productoTienda.findMany({
      where: {
        id: {
          in: productos.map((p) => p.productoTiendaId),
        },
      },
      select: {
        id: true,
        productoId: true,
        existencia: true,
        costo: true,
        precio: true,
        monedaCostoCode: true,
        monedaPrecioCode: true,
        proveedorId: true,
        producto: {
          select: {
            permiteDecimal: true,
          },
        },
      },
    });

    const productosNoEncontrados = productos.filter(
      (p) => !productosExistentes.some((pe) => pe.id === p.productoTiendaId),
    );

    if (productosNoEncontrados.length > 0) {
      console.error(
        "❌ [POST /api/venta] Productos no encontrados:",
        productosNoEncontrados,
      );
      throw new Error(
        `Productos no encontrados: ${productosNoEncontrados.map((p) => p.name).join(", ")}`,
      );
    }

    const productosMegrados = productosExistentes.map((p) => {
      const producto = productos.find((p2) => p2.productoTiendaId === p.id);
      // DB primero, payload después SOLO para llenar huecos (cantidad, name, etc.):
      // costo/precio/monedaCostoCode/monedaPrecioCode deben ganar siempre desde
      // la BD — de lo contrario un monedaPrecioCode obsoleto del carrito puede
      // quedar emparejado con un precio fresco de otra moneda y disparar
      // conversiones erróneas al cerrar el período.
      return {
        ...producto,
        ...p,
      };
    });

    // Validar cantidades decimales según configuración del producto
    const invalidDecimalProducts = productosMegrados.filter(
      (p) =>
        p &&
        typeof p.cantidad === "number" &&
        !Number.isInteger(p.cantidad) &&
        !(p.producto && p.producto.permiteDecimal),
    );
    if (invalidDecimalProducts.length > 0) {
      const ids = invalidDecimalProducts
        .map((p) => p.productoId || p.productoTiendaId)
        .join(", ");
      throw new Error(
        `Cantidad decimal no permitida para los productos: ${ids}`,
      );
    }

    // 2. Calcular descuentos SIEMPRE en base a los productos del payload (códigos opcionales)
    // Solo lee; NO debe correr dentro del tx.
    let discountTotalCalc = 0;
    let discountCalcResult: Awaited<
      ReturnType<typeof applyDiscountsForSale>
    > | null = null;
    try {
      // Construir la lista de productos para el motor de descuentos con datos confiables
      // Preferimos los valores de la DB (productosMegrados.precio) y hacemos fallback al payload (price | precio)
      const discountProducts = (productosMegrados as MergedProduct[]).map(
        (p) => ({
          productoTiendaId: String(p.productoTiendaId),
          cantidad: Number(p.cantidad) || 0,
          precio: Number(p.precio ?? p.price) || 0,
        }),
      );

      discountCalcResult = await applyDiscountsForSale({
        tiendaId,
        discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
        products: discountProducts,
      });
      discountTotalCalc = discountCalcResult.discountTotal;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ [POST /api/venta] Error calculando descuentos:", msg);
      // En caso de error, continuar sin aplicar descuentos
      discountTotalCalc = 0;
      discountCalcResult = null;
    }

    // Solo hace falta para validar el vuelto contra la caja real (ver más
    // abajo) — si la venta no da vuelto en efectivo, esta query es innecesaria,
    // pero es barata y mantiene el código simple.
    const tiendaConNegocio = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { negocio: { select: { monedaBase: true } } },
    });
    const monedaBase = tiendaConNegocio?.negocio?.monedaBase ?? "CUP";

    // **TRANSACCIÓN ATÓMICA: Todo o nada (SOLO escrituras)**
    const result = await prisma.$transaction(
      async (tx) => {
        // 0. Validar que el vuelto solicitado esté cubierto por el efectivo
        // realmente disponible en caja (fondo inicial + ventas - vueltos -
        // gastos - compras, ver calcularEfectivoDisponiblePorMoneda). Mismo
        // lock por tienda que usa COMPRA (src/lib/movimiento/index.ts) —
        // compras y ventas compiten por el mismo efectivo físico y deben
        // serializarse entre sí para no leer un "disponible" que la otra ya
        // comprometió.
        const vueltos = (vueltoDetalle as IVueltoLinea[] | undefined) ?? [];
        const pagos = (pagosDetalle as IPagoLinea[] | undefined) ?? [];
        const tieneVueltoEnEfectivo = vueltos.some((v) => v.monto > 0);

        if (tieneVueltoEnEfectivo) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tiendaId})::bigint)`;
          const disponible = await calcularEfectivoDisponiblePorMoneda(
            tiendaId,
            monedaBase,
            tx,
          );
          const pagoCashPorMoneda: Record<string, number> = {};
          for (const p of pagos) {
            if (p.tipo === "cash") {
              pagoCashPorMoneda[p.moneda] =
                (pagoCashPorMoneda[p.moneda] ?? 0) + p.monto;
            }
          }
          for (const v of vueltos) {
            if (v.monto <= 0) continue;
            const disponibleMoneda =
              (disponible[v.moneda] ?? 0) + (pagoCashPorMoneda[v.moneda] ?? 0);
            if (v.monto > disponibleMoneda + 0.01) {
              // Una venta offline ya ocurrió físicamente antes de que el
              // servidor tuviera visibilidad — el cajero ya entregó ese
              // cambio. Rechazarla no deshace lo ya sucedido y solo dejaría
              // la venta atascada reintentando en el dispositivo offline.
              // Se registra para visibilidad, sin bloquear la sincronización.
              if (!wasOffline) {
                throw new InsufficientCashForChangeError(
                  v.moneda,
                  v.monto,
                  disponibleMoneda,
                );
              }
              console.warn(
                `⚠️ [POST /api/venta] Venta offline con vuelto no cubierto por caja: moneda=${v.moneda} vuelto=${v.monto} disponible=${disponibleMoneda.toFixed(2)} syncId=${syncId}`,
              );
            }
          }
        }

        // 3. Crear la venta
        const venta = await tx.venta.create({
          data: {
            tiendaId,
            usuarioId,
            // El frontend envía `total` ya convertido a moneda base (useCartTotal + descuento aplicado).
            // NO usar discountCalcResult.finalTotal: suma precios crudos en monedas mezcladas → incorrecto.
            total: Math.max(0, Number(total) || 0),
            totalcash,
            totaltransfer,
            cierrePeriodoId: ultimoPeriodo.id,
            syncId,
            // 🆕 NUEVOS CAMPOS
            frontendCreatedAt: createdAt ? new Date(createdAt) : null,
            wasOffline: wasOffline || false,
            syncAttempts: syncAttempts || 0, // 🆕 Usar syncAttempts enviado desde frontend
            discountTotal: discountTotalCalc || 0,
            productos: {
              create: productosMegrados.map((p) => ({
                productoTiendaId: p.productoTiendaId,
                cantidad: p.cantidad,
                costo: p.costo,
                precio: p.precio,
                monedaCostoCode: p.monedaCostoCode ?? null,
                monedaPrecioCode: p.monedaPrecioCode ?? null,
              })),
            },
            ...(transferDestinationId &&
              totaltransfer > 0 && { transferDestinationId }),
            // Multimoneda
            ...(monedaCobro && { monedaCobro }),
            ...(pagosDetalle && { pagosDetalle }),
            ...(vueltoDetalle && { vueltoDetalle }),
            ...(tasaSnapshot && { tasaSnapshot }),
          },
          include: {
            productos: true,
          },
        });

        // 3.1 Persistir AppliedDiscount si corresponde (batch, un solo round-trip)
        try {
          const applied = discountCalcResult?.applied || [];
          if ((discountTotalCalc || 0) > 0 && applied.length > 0) {
            await tx.appliedDiscount.createMany({
              data: applied.map((a) => ({
                ventaId: venta.id,
                discountRuleId: a.discountRuleId,
                amount: a.amount,
                productsAffected: a.productsAffected ?? null,
              })),
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "❌ [POST /api/venta] Error guardando AppliedDiscount:",
            msg,
          );
        }

        // 3. Manejar productos fraccionables (si aplica) - PRIMERO
        const productosFraccionables = await tx.productoTienda.findMany({
          where: {
            id: {
              in: productos.map((p) => p.productoTiendaId),
            },
            producto: {
              fraccionDeId: {
                not: null,
              },
            },
          },
          include: {
            producto: {
              select: {
                fraccionDeId: true,
                unidadesPorFraccion: true,
              },
            },
          },
        });

        if (productosFraccionables.length > 0) {
          const productosFraccionablesData = productosFraccionables.filter(
            (pf) => pf.producto.fraccionDeId,
          );

          const itemsDesagregaciónBaja = [];
          const itemsDesagregaciónAlta = [];

          // Cuántos padres hay que abrir por producto fracción. Se calcula
          // sobre la existencia ORIGINAL (antes de tocar nada) y ya no hay
          // tope de una caja por venta: vender 25 sueltas teniendo 3 abre
          // las tres cajas que hagan falta.
          for (const prodFracc of productosFraccionablesData) {
            const prod = productos.find(
              (p) => p.productoTiendaId === prodFracc.id,
            );
            if (!prod) continue;

            const paquetes = packsToOpen(
              prod.cantidad,
              prodFracc.existencia,
              prodFracc.producto.unidadesPorFraccion,
            );
            if (paquetes === 0) continue;

            itemsDesagregaciónAlta.push({
              cantidad: unitsFromPacks(
                paquetes,
                prodFracc.producto.unidadesPorFraccion,
              ),
              productoId: prodFracc.productoId,
            });
            itemsDesagregaciónBaja.push({
              cantidad: paquetes,
              productoId: prodFracc.producto.fraccionDeId,
            });
          }

          // Crear movimientos de desagregación dentro de la misma transacción
          if (itemsDesagregaciónBaja.length > 0) {
            for (const item of itemsDesagregaciónBaja) {
              const productoTiendaDesagregar =
                await tx.productoTienda.findFirst({
                  where: {
                    tiendaId,
                    productoId: item.productoId,
                    proveedorId: null, // Solo productos propios para desagregación
                  },
                });

              if (productoTiendaDesagregar) {
                const existenciaAnterior = productoTiendaDesagregar.existencia;

                if (existenciaAnterior < item.cantidad) {
                  throw new Error(
                    `Existencia insuficiente, no hay suficiente existencia para desagregar. Existencia: ${existenciaAnterior}, Cantidad a desagregar: ${item.cantidad}`,
                  );
                }

                await tx.productoTienda.update({
                  where: { id: productoTiendaDesagregar.id },
                  data: {
                    existencia: {
                      decrement: item.cantidad,
                    },
                  },
                });

                await tx.movimientoStock.create({
                  data: {
                    tipo: "DESAGREGACION_BAJA",
                    cantidad: item.cantidad,
                    productoTiendaId: productoTiendaDesagregar.id,
                    tiendaId,
                    usuarioId,
                    existenciaAnterior,
                    referenciaId: venta.id,
                    motivo: `Desagregación para venta ${venta.id}`,
                  },
                });
              }
            }
          }

          if (itemsDesagregaciónAlta.length > 0) {
            for (const item of itemsDesagregaciónAlta) {
              const productoTiendaAgregar = await tx.productoTienda.findFirst({
                where: {
                  tiendaId,
                  productoId: item.productoId,
                  proveedorId: null, // Solo productos propios para desagregación
                },
              });

              if (productoTiendaAgregar) {
                const existenciaAnterior = productoTiendaAgregar.existencia;

                await tx.productoTienda.update({
                  where: { id: productoTiendaAgregar.id },
                  data: {
                    existencia: {
                      increment: item.cantidad,
                    },
                  },
                });

                await tx.movimientoStock.create({
                  data: {
                    tipo: "DESAGREGACION_ALTA",
                    cantidad: item.cantidad,
                    productoTiendaId: productoTiendaAgregar.id,
                    tiendaId,
                    usuarioId,
                    existenciaAnterior,
                    referenciaId: venta.id,
                    motivo: `Desagregación para venta ${venta.id}`,
                  },
                });
              }
            }
          }
        }

        // 4. Actualizar existencias y acumular movimientos de venta - ÚLTIMO
        const movimientosVenta: Prisma.MovimientoStockCreateManyInput[] = [];
        for (const producto of productos) {
          const productoTienda = productosExistentes.find(
            (p) => p.id === producto.productoTiendaId,
          );
          if (!productoTienda) continue;

          // Obtener la existencia actual (después de desagregaciones si las hubo)
          const productoTiendaActual = await tx.productoTienda.findUnique({
            where: { id: producto.productoTiendaId },
            select: { existencia: true },
          });

          if (!productoTiendaActual) continue;

          const existenciaAnterior = productoTiendaActual.existencia;

          if (existenciaAnterior < producto.cantidad) {
            throw new Error(
              `Existencia insuficiente para realizar la venta de productoTiendaId: ${producto.productoTiendaId}. Existencia: ${existenciaAnterior}, Cantidad a vender: ${producto.cantidad}`,
            );
          }

          // Actualizar existencia
          await tx.productoTienda.update({
            where: { id: producto.productoTiendaId },
            data: {
              existencia: {
                decrement: producto.cantidad,
              },
            },
          });

          // Acumular movimiento de venta
          movimientosVenta.push({
            tipo: "VENTA",
            cantidad: producto.cantidad,
            productoTiendaId: producto.productoTiendaId,
            tiendaId,
            usuarioId,
            existenciaAnterior,
            referenciaId: venta.id,
            motivo: `Venta ${venta.id}`,
            ...(productoTienda.proveedorId && {
              proveedorId: productoTienda.proveedorId,
            }),
          });
        }

        // Insertar todos los movimientos de venta en un solo round-trip
        if (movimientosVenta.length > 0) {
          await tx.movimientoStock.createMany({ data: movimientosVenta });
        }

        return venta;
      },
      {
        // Red de seguridad ante la latencia del transaction pooler.
        maxWait: 10000,
        timeout: 20000,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof InsufficientCashForChangeError) {
      return NextResponse.json(
        {
          error: `Efectivo insuficiente en caja (${error.currency}) para dar el vuelto solicitado`,
          currency: error.currency,
          requestedChange: error.requestedChange,
          available: error.available,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const ventaExistente = await prisma.venta.findFirst({
        where: { syncId },
        include: { productos: true },
      });
      if (ventaExistente) {
        return NextResponse.json(ventaExistente, { status: 200 });
      }
    }

    const message =
      error instanceof Error ? error.message : "Error al crear la venta";
    console.error("❌ [POST /api/venta] Error en transacción:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  try {
    const { cierreId, tiendaId } = await params;

    const ventasPrisma = await prisma.venta.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
          },
        },
        productos: {
          select: {
            cantidad: true,
            id: true,
            productoTiendaId: true,
            precio: true,
            costo: true,
            monedaPrecioCode: true,

            producto: {
              select: {
                proveedor: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
                producto: {
                  select: {
                    nombre: true,
                    id: true,
                  },
                },
              },
            },
          },
        },
        appliedDiscounts: {
          include: {
            discountRule: {
              select: { name: true },
            },
          },
        },
        transferDestination: {
          select: { id: true, nombre: true },
        },
      },
      where: {
        cierrePeriodoId: cierreId,
        tiendaId: tiendaId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const ventas: IVenta[] = ventasPrisma.map((venta) => ({
      id: venta.id,
      createdAt: venta.createdAt,
      total: venta.total,
      totalcash: venta.totalcash,
      totaltransfer: venta.totaltransfer,
      discountTotal: Number(venta.discountTotal ?? 0),
      tiendaId: venta.tiendaId,
      usuarioId: venta.usuarioId,
      cierrePeriodoId: venta.cierrePeriodoId,
      usuario: {
        id: venta.usuario.id,
        nombre: venta.usuario.nombre,
        usuario: "",
        rol: "",
      },
      productos: venta.productos.map((p) => ({
        id: p.producto.producto.id,
        ventaProductoId: p.id,
        ventaId: venta.id,
        productoTiendaId: p.productoTiendaId,
        cantidad: p.cantidad,
        name: p.producto.proveedor
          ? `${p.producto?.producto?.nombre} - ${p.producto.proveedor.nombre}`
          : (p.producto?.producto?.nombre ?? undefined),
        price: p.precio ?? undefined,
        monedaPrecioCode: p.monedaPrecioCode ?? undefined,
      })),
      appliedDiscounts: (venta.appliedDiscounts || []).map((ad) => ({
        id: ad.id,
        discountRuleId: ad.discountRuleId,
        ventaId: ad.ventaId,
        amount: ad.amount,
        // Prisma almacena JSON, lo convertimos al tipo esperado de la UI (si es posible)
        productsAffected: ad.productsAffected as unknown as
          { productoTiendaId: string; cantidad: number }[] | undefined,
        createdAt: ad.createdAt,
        ruleName: ad.discountRule?.name,
      })),
      transferDestinationId: venta.transferDestinationId ?? undefined,
      transferDestination: venta.transferDestination ?? undefined,
      syncId: venta.syncId,
      monedaCobro: venta.monedaCobro ?? undefined,
      pagosDetalle:
        (venta.pagosDetalle as unknown as IVenta["pagosDetalle"]) ?? undefined,
      vueltoDetalle:
        (venta.vueltoDetalle as unknown as IVenta["vueltoDetalle"]) ??
        undefined,
      tasaSnapshot:
        (venta.tasaSnapshot as unknown as IVenta["tasaSnapshot"]) ?? undefined,
    }));

    return NextResponse.json(ventas);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener las ventas" },
      { status: 500 },
    );
  }
}
