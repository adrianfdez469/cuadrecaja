import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { applyDiscountsForSale } from "@/lib/discounts";
import { IVenta } from "@/schemas/venta";
import { pagosDetalleAppSchema, vueltoDetalleSchema } from "@/schemas/pago";
import { tasaSnapshotSchema } from "@/schemas/tasaCambio";
import { mapVentaToIVenta } from "@/lib/ventaMapper";
import { validateTip } from "@/lib/tips";
import { packsToOpen, unitsFromPacks } from "@/lib/fractionStock";

// Tipos auxiliares
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

/**
 * POST /api/app/venta/[tiendaId]/[periodoId]
 *
 * Crea una nueva venta. Soporta sincronización offline con syncId.
 * Requiere autenticación por token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; periodoId: string }> },
) {
  let syncId: string | undefined;

  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId, periodoId } = await params;

    const {
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
      monedaCobro,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot,
      tipTotal,
      tipDetail,
    } = await request.json();

    syncId = syncIdBody;

    const usuarioId = session.user.id;

    // Validaciones básicas: detectar qué datos faltan
    const faltantes: string[] = [];
    if (!tiendaId) faltantes.push("tiendaId");
    if (!periodoId) faltantes.push("periodoId");
    if (!productos?.length) faltantes.push("productos (o lista vacía)");
    if (!syncId) faltantes.push("syncId");
    if (createdAt == null || createdAt === "") faltantes.push("createdAt");

    if (faltantes.length > 0) {
      console.error("❌ [APP/VENTA/POST] Datos insuficientes:", faltantes);
      return NextResponse.json(
        {
          error: `Datos insuficientes para crear la venta: ${faltantes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validar campos multimoneda
    if (!pagosDetalleAppSchema.safeParse(pagosDetalle).success) {
      return NextResponse.json(
        {
          error:
            "pagosDetalle es requerido y debe contener al menos un pago válido (transfer requiere transferDestinationId)",
        },
        { status: 400 },
      );
    }
    if (!vueltoDetalleSchema.safeParse(vueltoDetalle).success) {
      return NextResponse.json(
        { error: "vueltoDetalle inválido" },
        { status: 400 },
      );
    }
    if (!tasaSnapshotSchema.safeParse(tasaSnapshot).success) {
      return NextResponse.json(
        { error: "tasaSnapshot es requerido" },
        { status: 400 },
      );
    }

    // Verificar idempotencia - si ya existe una venta con este syncId
    const existeVenta = await prisma.venta.findFirst({
      where: { syncId },
      include: { productos: true },
    });

    if (existeVenta) {
      return NextResponse.json({
        success: true,
        venta: existeVenta,
        duplicado: true,
      });
    }

    // Verificar que el período está abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId, fechaFin: null },
      orderBy: { fechaInicio: "desc" },
    });

    if (!ultimoPeriodo) {
      console.error(
        "❌ [APP/VENTA/POST] No existe un período abierto en la tienda",
      );
      return NextResponse.json(
        { error: "No existe un período abierto en la tienda" },
        { status: 400 },
      );
    }

    // Validar que la venta pertenece al período actual
    if (ultimoPeriodo.id !== periodoId) {
      const periodoDeLaVenta = await prisma.cierrePeriodo.findUnique({
        where: { id: periodoId },
      });

      if (!periodoDeLaVenta) {
        console.error(
          "❌ [APP/VENTA/POST] No existe un período con el id proporcionado",
        );
        return NextResponse.json(
          {
            error: `No existe un período con el id proporcionado. El ultimo periodo abierto es: ${ultimoPeriodo.fechaInicio.toLocaleString()}`,
          },
          { status: 404 },
        );
      }

      console.error(
        "❌ [APP/VENTA/POST] La venta pertenece a un período cerrado o diferente al actual",
      );
      return NextResponse.json(
        {
          error: `La venta pertenece a un período cerrado o diferente al actual. El ultimo periodo abierto es: ${ultimoPeriodo.fechaInicio.toLocaleString()}`,
          periodoActualId: ultimoPeriodo.id,
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
        id: { in: productos.map((p: IncomingProduct) => p.productoTiendaId) },
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
          select: { permiteDecimal: true },
        },
      },
    });

    const productosNoEncontrados = productos.filter(
      (p: IncomingProduct) =>
        !productosExistentes.some((pe) => pe.id === p.productoTiendaId),
    );

    if (productosNoEncontrados.length > 0) {
      throw new Error(
        `Productos no encontrados: ${productosNoEncontrados.map((p: IncomingProduct) => p.name || p.productoTiendaId).join(", ")}`,
      );
    }

    const productosMergeados = productosExistentes.map((p) => {
      const producto = productos.find(
        (p2: IncomingProduct) => p2.productoTiendaId === p.id,
      );
      // DB primero, payload después SOLO para llenar huecos (cantidad, name, etc.):
      // costo/precio/monedaCostoCode/monedaPrecioCode deben ganar siempre desde
      // la BD — de lo contrario un monedaPrecioCode obsoleto del carrito puede
      // quedar emparejado con un precio fresco de otra moneda y disparar
      // conversiones erróneas al cerrar el período.
      return { ...producto, ...p };
    }) as MergedProduct[];

    // Validar cantidades decimales
    const invalidDecimalProducts = productosMergeados.filter(
      (p) => !Number.isInteger(p.cantidad) && !p.producto.permiteDecimal,
    );
    if (invalidDecimalProducts.length > 0) {
      throw new Error(`Cantidad decimal no permitida para algunos productos`);
    }

    // 2. Calcular descuentos (solo lee; NO debe correr dentro del tx)
    let discountTotalCalc = 0;
    let discountCalcResult: Awaited<
      ReturnType<typeof applyDiscountsForSale>
    > | null = null;

    try {
      const discountProducts = productosMergeados.map((p) => ({
        productoTiendaId: String(p.productoTiendaId),
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precio ?? p.price) || 0,
      }));

      discountCalcResult = await applyDiscountsForSale({
        tiendaId,
        discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
        products: discountProducts,
      });
      discountTotalCalc = discountCalcResult.discountTotal;
    } catch {
      discountTotalCalc = 0;
      discountCalcResult = null;
    }

    const tiendaConNegocio = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { negocio: { select: { monedaBase: true } } },
    });
    const monedaBase = tiendaConNegocio?.negocio?.monedaBase ?? "CUP";

    // Igual que en el POS web: la propina no se deriva, se valida contra el
    // excedente realmente cobrado.
    // El total es el que manda la app, ya convertido a moneda base linea por
    // linea. NO usar discountCalcResult.finalTotal: suma precios crudos en
    // monedas mezcladas -> incorrecto (mismo criterio que /api/venta).
    const ventaTotal = Math.max(0, Number(total) || 0);
    const tipCheck = validateTip({
      tipTotal,
      tipDetail,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot,
      total: ventaTotal,
      monedaBase,
    });
    if (!tipCheck.ok) {
      console.error("❌ [APP/VENTA/POST] Propina inválida:", tipCheck.error);
      return NextResponse.json({ error: tipCheck.error }, { status: 400 });
    }

    // Transacción atómica: SOLO escrituras
    const result = await prisma.$transaction(
      async (tx) => {
        // 3. Crear la venta
        const venta = await tx.venta.create({
          data: {
            tiendaId,
            usuarioId,
            total: ventaTotal,
            totalcash: totalcash || 0,
            totaltransfer: totaltransfer || 0,
            cierrePeriodoId: ultimoPeriodo.id,
            syncId,
            frontendCreatedAt: createdAt ? new Date(createdAt) : null,
            wasOffline: wasOffline || false,
            syncAttempts: syncAttempts || 0,
            discountTotal: discountTotalCalc || 0,
            productos: {
              create: productosMergeados.map((p) => ({
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
            // Propina — validada arriba contra el excedente cobrado.
            tipTotal: tipCheck.tipTotal,
            ...(tipCheck.tipDetail && { tipDetail: tipCheck.tipDetail }),
          },
          include: { productos: true },
        });

        // 3.1 Guardar descuentos aplicados (batch, un solo round-trip)
        if (
          (discountTotalCalc || 0) > 0 &&
          discountCalcResult?.applied?.length
        ) {
          await tx.appliedDiscount.createMany({
            data: discountCalcResult.applied.map((a) => ({
              ventaId: venta.id,
              discountRuleId: a.discountRuleId,
              amount: a.amount,
              productsAffected: a.productsAffected ?? null,
            })),
          });
        }

        // 4. Manejar productos fraccionables
        const productosFraccionables = await tx.productoTienda.findMany({
          where: {
            id: {
              in: productos.map((p: IncomingProduct) => p.productoTiendaId),
            },
            producto: { fraccionDeId: { not: null } },
          },
          include: {
            producto: {
              select: {
                fraccionDeId: true,
                unidadesPorFraccion: true,
                nombre: true,
              },
            },
          },
        });

        if (productosFraccionables.length > 0) {
          const productosFraccionablesData = productosFraccionables.filter(
            (pf) => pf.producto.fraccionDeId,
          );

          const itemsDesagregacionBaja: Array<{
            cantidad: number;
            productoId: string | null;
          }> = [];
          const itemsDesagregacionAlta: Array<{
            cantidad: number;
            productoId: string;
          }> = [];

          // Cuántos padres hay que abrir por producto fracción, calculado sobre
          // la existencia ORIGINAL. Sin tope de una caja por venta: vender 25
          // sueltas teniendo 3 abre las tres cajas que hagan falta.
          for (const prodFracc of productosFraccionablesData) {
            const prod = productos.find(
              (p: IncomingProduct) => p.productoTiendaId === prodFracc.id,
            );
            if (!prod) continue;

            const paquetes = packsToOpen(
              prod.cantidad,
              prodFracc.existencia,
              prodFracc.producto.unidadesPorFraccion,
            );
            if (paquetes === 0) continue;

            itemsDesagregacionAlta.push({
              cantidad: unitsFromPacks(
                paquetes,
                prodFracc.producto.unidadesPorFraccion,
              ),
              productoId: prodFracc.productoId,
            });
            itemsDesagregacionBaja.push({
              cantidad: paquetes,
              productoId: prodFracc.producto.fraccionDeId,
            });
          }

          // Procesar DESAGREGACION_BAJA
          for (const item of itemsDesagregacionBaja) {
            if (!item.productoId) continue;

            const productoTiendaDesagregar = await tx.productoTienda.findFirst({
              where: {
                tiendaId,
                productoId: item.productoId,
                proveedorId: null,
              },
              include: { producto: { select: { nombre: true } } },
            });

            if (productoTiendaDesagregar) {
              const existenciaAnterior = productoTiendaDesagregar.existencia;

              if (existenciaAnterior < item.cantidad) {
                throw new Error(
                  `Existencia insuficiente para desagregar. Producto: ${productoTiendaDesagregar.producto.nombre}, Cantidad: ${item.cantidad}, Existencia anterior: ${existenciaAnterior}`,
                );
              }

              await tx.productoTienda.update({
                where: { id: productoTiendaDesagregar.id },
                data: { existencia: { decrement: item.cantidad } },
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

          // Procesar DESAGREGACION_ALTA
          for (const item of itemsDesagregacionAlta) {
            const productoTiendaAgregar = await tx.productoTienda.findFirst({
              where: {
                tiendaId,
                productoId: item.productoId,
                proveedorId: null,
              },
            });

            if (productoTiendaAgregar) {
              const existenciaAnterior = productoTiendaAgregar.existencia;

              await tx.productoTienda.update({
                where: { id: productoTiendaAgregar.id },
                data: { existencia: { increment: item.cantidad } },
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

        // 5. Actualizar existencias y acumular movimientos de venta
        const movimientosVenta: Prisma.MovimientoStockCreateManyInput[] = [];
        for (const producto of productos as IncomingProduct[]) {
          const productoTienda = productosExistentes.find(
            (p) => p.id === producto.productoTiendaId,
          );
          if (!productoTienda) continue;

          // Releer existencia dentro del tx: la desagregación de fraccionables
          // pudo haberla modificado para este producto.
          const productoTiendaActual = await tx.productoTienda.findUnique({
            where: { id: producto.productoTiendaId },
            select: { existencia: true },
          });

          if (!productoTiendaActual) continue;

          const existenciaAnterior = productoTiendaActual.existencia;

          if (existenciaAnterior < producto.cantidad) {
            throw new Error(
              `Existencia insuficiente para ${producto.name || producto.productoTiendaId}`,
            );
          }

          await tx.productoTienda.update({
            where: { id: producto.productoTiendaId },
            data: { existencia: { decrement: producto.cantidad } },
          });

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

    return NextResponse.json(
      {
        success: true,
        venta: result,
        duplicado: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const ventaExistente = await prisma.venta.findFirst({
        where: { syncId },
        include: { productos: true },
      });
      if (ventaExistente) {
        return NextResponse.json({
          success: true,
          venta: ventaExistente,
          duplicado: true,
        });
      }
    }

    console.error("❌ [APP/VENTA/POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Error al crear la venta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/app/venta/[tiendaId]/[periodoId]
 *
 * Obtiene las ventas de un período específico.
 * Requiere autenticación por token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; periodoId: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId, periodoId } = await params;

    if (!tiendaId || !periodoId) {
      return NextResponse.json(
        { error: "tiendaId y periodoId son requeridos" },
        { status: 400 },
      );
    }

    const ventasPrisma = await prisma.venta.findMany({
      include: {
        usuario: {
          select: { id: true, nombre: true },
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
                  select: { id: true, nombre: true },
                },
                producto: {
                  select: { nombre: true, id: true },
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
        cierrePeriodoId: periodoId,
        tiendaId: tiendaId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const ventas: IVenta[] = ventasPrisma.map(mapVentaToIVenta);

    return NextResponse.json({
      success: true,
      ventas: ventas,
      total: ventas.length,
    });
  } catch (error) {
    console.error("❌ [APP/VENTA/GET] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener las ventas" },
      { status: 500 },
    );
  }
}
