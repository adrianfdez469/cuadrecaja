import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import {
  assertTiendaTenant,
  withTenantScope,
  type ITenantScope,
} from "@/lib/tenantScope";
import { applyDiscountsForSale } from "@/lib/discounts";
import { IVenta } from "@/schemas/venta";
import {
  creditoExtrasSchema,
  pagosDetalleConCreditoAppSchema,
  vueltoDetalleSchema,
} from "@/schemas/pago";
import {
  checkCreditInvariant,
  CREDIT_INVARIANT_HTTP_STATUS,
} from "@/lib/cuentasPorCobrar/creditInvariant";
import {
  resolveCreditCustomer,
  type ICreditCustomerResolution,
} from "@/lib/cuentasPorCobrar/creditCustomer";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import {
  CREDIT_CUSTOMER_CONFLICT_CODE,
  CREDIT_CUSTOMER_CONFLICT_MESSAGE,
  CREDIT_CUSTOMER_UPSERT_RETRIES,
  CREDIT_EXTRAS_INVALID_MESSAGE,
  CREDIT_INVARIANT_ERROR_MESSAGE,
} from "@/constants/creditoVenta";
import { tasaSnapshotSchema } from "@/schemas/tasaCambio";
import { mapVentaToIVenta } from "@/lib/ventaMapper";
import { validateTip } from "@/lib/tips";
import { packsToOpen, unitsFromPacks } from "@/lib/fractionStock";
import {
  MISSING_EXCHANGE_RATE_ERROR,
  missingExchangeRateMessage,
  resolveSaleTasaSnapshot,
} from "@/lib/tasaSnapshotResolver";
import {
  grossTotalBase,
  linePriceInBase,
  reconcileSaleTotal,
} from "@/lib/saleTotal";

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
  // Declared out here so the P2002 recovery in the catch can scope its lookup too.
  let tenantScope: ITenantScope | null = null;

  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId, periodoId } = await params;

    // F-021: the store must belong to the session's business. No permission — this verb never
    // demanded one (ADR 0078).
    const guard = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!guard.scope) return guard.response;
    tenantScope = guard.scope;
    const { negocioId } = tenantScope;

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
      // Credit sale (F-032). Validated by creditoExtrasSchema below, before anything reads
      // the numbers.
      creditoBase,
      clienteId,
      clienteNombre,
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

    // The credit fields, parsed BEFORE the payment lines so `creditoBaseEntrante` is already
    // validated when the line rule reads it. The Zod detail is NOT echoed: it quotes the
    // value that failed (E-031).
    const creditExtras = creditoExtrasSchema.safeParse({
      creditoBase,
      clienteId,
      clienteNombre,
    });
    if (!creditExtras.success) {
      return NextResponse.json(
        { error: CREDIT_EXTRAS_INVALID_MESSAGE },
        { status: 400 },
      );
    }
    const creditoBasePersistido = Number(creditExtras.data.creditoBase) || 0;

    // Validar campos multimoneda
    // A sale with no payment lines is accepted ONLY when it carries credit. The body and the
    // status of this 400 do not change: criterion 12 asks for "exactly today's behaviour"
    // for a cash sale with no lines, and that literal is part of it (E-016, E-018).
    if (
      !pagosDetalleConCreditoAppSchema.safeParse({
        pagosDetalle,
        creditoBase: creditoBasePersistido,
      }).success
    ) {
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
      where: withTenantScope("venta", { syncId }, negocioId),
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
      where: withTenantScope(
        "cierrePeriodo",
        { tiendaId, fechaFin: null },
        negocioId,
      ),
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
      const periodoDeLaVenta = await prisma.cierrePeriodo.findFirst({
        where: withTenantScope(
          "cierrePeriodo",
          { id: periodoId, tiendaId },
          negocioId,
        ),
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
      where: withTenantScope(
        "productoTienda",
        {
          id: { in: productos.map((p: IncomingProduct) => p.productoTiendaId) },
          tiendaId,
        },
        negocioId,
      ),
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

    // Base currency and a complete rate snapshot come first: discounts are
    // priced in base and the total is recomputed in base from the lines.
    const tiendaConNegocio = await prisma.tienda.findFirst({
      where: withTenantScope("tienda", { id: tiendaId }, negocioId),
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    const monedaBase = tiendaConNegocio?.negocio?.monedaBase ?? "CUP";

    // The client's snapshot is completed server-side before anything reads it:
    // the app used to send it without the business's own monedaBase, and every
    // consumer downstream converts a missing moneda at rate 1.
    const { snapshot: tasaSnapshotResuelto, missing: tasasFaltantes } =
      await resolveSaleTasaSnapshot({
        negocioId,
        monedaBase,
        clientSnapshot: tasaSnapshot,
        momento: createdAt ? new Date(createdAt) : new Date(),
        monedas: [...pagosDetalle, ...vueltoDetalle].map((l) => l.moneda),
      });
    if (tasasFaltantes.length > 0) {
      console.error(
        "❌ [APP/VENTA/POST] Tasa de cambio faltante:",
        tasasFaltantes.join(", "),
      );
      return NextResponse.json(
        {
          error: missingExchangeRateMessage(tasasFaltantes),
          code: MISSING_EXCHANGE_RATE_ERROR,
          monedas: tasasFaltantes,
        },
        { status: 400 },
      );
    }

    // The lines exactly as they are persisted below: DB price in its own
    // currency. Discounts and the total are both derived from these.
    const lineasVenta = productosMergeados.map((p) => ({
      precio: p.precio ?? p.price,
      cantidad: Number(p.cantidad) || 0,
      monedaPrecioCode: p.monedaPrecioCode ?? null,
    }));

    // 2. Calcular descuentos (solo lee; NO debe correr dentro del tx).
    // Prices go in already converted to base, as the web POS does: a fixed
    // discount is a base amount, and a CUP price fed as-is to a USD business
    // would be discounted as if it were dollars.
    let discountTotalCalc = 0;
    let discountCalcResult: Awaited<
      ReturnType<typeof applyDiscountsForSale>
    > | null = null;

    try {
      const discountProducts = productosMergeados.map((p, i) => ({
        productoTiendaId: String(p.productoTiendaId),
        cantidad: lineasVenta[i].cantidad,
        precio: linePriceInBase(
          lineasVenta[i],
          tasaSnapshotResuelto,
          monedaBase,
        ),
      }));

      discountCalcResult = await applyDiscountsForSale({
        ...tenantScope,
        discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
        products: discountProducts,
      });
      discountTotalCalc = discountCalcResult.discountTotal;
    } catch {
      discountTotalCalc = 0;
      discountCalcResult = null;
    }

    // The total the books carry is recomputed here from the same prices and
    // rates the lines are persisted with; the client's figure is only compared
    // against it. Clients have stored the raw sum of prices across currencies
    // (a 15 300 CUP basket as 15 300 USD).
    const totalReconciliado = reconcileSaleTotal(
      total,
      grossTotalBase(lineasVenta, tasaSnapshotResuelto, monedaBase) -
        discountTotalCalc,
    );
    if (totalReconciliado.diverged) {
      console.warn("⚠️ [APP/VENTA/POST] Total del cliente descartado:", {
        syncId,
        clientTotal: totalReconciliado.clientTotal,
        serverTotal: totalReconciliado.total,
        delta: totalReconciliado.delta,
      });
    }
    const ventaTotal = totalReconciliado.total;

    // Igual que en el POS web: la propina no se deriva, se valida contra el
    // excedente realmente cobrado.
    const tipCheck = validateTip({
      tipTotal,
      tipDetail,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot: tasaSnapshotResuelto,
      total: ventaTotal,
      monedaBase,
    });
    if (!tipCheck.ok) {
      console.error("❌ [APP/VENTA/POST] Propina inválida:", tipCheck.error);
      return NextResponse.json({ error: tipCheck.error }, { status: 400 });
    }

    // The debtor of this sale, and what has to be written for it to exist. It stays null for
    // a cash sale because it is INITIALISED null and the only block that can change it sits
    // entirely behind `creditoBasePersistido > 0` — that is what sustains the
    // `Venta.clienteId NULL <=> creditoBase = 0` invariant F-029 wrote on the column.
    let clienteIdEfectivo: string | null = null;
    let resolution: ICreditCustomerResolution = {
      action: "NONE",
      clienteId: null,
      nombre: null,
    };

    // Transacción atómica: SOLO escrituras
    const ejecutarVentaTx = () => prisma.$transaction(
      async (tx) => {
        // 2.5 The customer of a credit sale, written inside the SAME transaction as the
        // sale. Only for CREATE and REACTIVATE; with EXISTING nothing is written to
        // Cliente, and with NONE there is no customer at all.
        //
        // `createOrReactivateCliente` is deliberately NOT reused here: it talks to the
        // global `prisma`, not to `tx`, and opens its own read/write cycle outside any
        // transaction (ADR 0107). Calling it from inside this $transaction would ask the
        // pooler for a second connection and answer "Transaction already closed". What IS
        // reused is its pure half, `decideClienteUpsert`, through resolveCreditCustomer.
        if (
          resolution.action === "CREATE" ||
          resolution.action === "REACTIVATE"
        ) {
          // Read again INSIDE the transaction before writing. This is the half of E-038
          // that resolves the sequential case — the same sale re-sent, a name another sale
          // created a moment ago — without violating anything. The other half, the retry,
          // lives outside the transaction: a P2002 aborts the whole transaction in Postgres
          // and cannot be recovered from in here.
          const yaExiste = await tx.cliente.findFirst({
            where: withTenantScope(
              "cliente",
              { nombre: resolution.nombre },
              negocioId,
            ),
            select: { id: true, deletedAt: true },
          });

          if (yaExiste) {
            clienteIdEfectivo = yaExiste.id;
            if (yaExiste.deletedAt) {
              await tx.cliente.update({
                // The tenant clause is repeated in the write, not only in the read that
                // resolved the id: one composite `where`, never a check held in memory.
                where: withTenantScope(
                  "cliente",
                  { id: yaExiste.id },
                  negocioId,
                ),
                data: { deletedAt: null },
              });
            }
          } else {
            const creado = await tx.cliente.create({
              data: {
                // The id resolveCreditCustomer already handed to checkCreditInvariant, so
                // the row that gets written is the row the invariant was checked against.
                id: resolution.clienteId,
                nombre: resolution.nombre,
                negocioId,
              },
              select: { id: true },
            });
            clienteIdEfectivo = creado.id;
          }
        }

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
            creditoBase: creditoBasePersistido,
            clienteId: clienteIdEfectivo,
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
            tasaSnapshot: tasaSnapshotResuelto,
            // Propina — validada arriba contra el excedente cobrado.
            tipTotal: tipCheck.tipTotal,
            ...(tipCheck.tipDetail && { tipDetail: tipCheck.tipDetail }),
          },
          include: { productos: true },
        });

        // 3.0.1 The debt, in the SAME transaction as the sale and immediately after it. If
        // anything later fails — insufficient stock, for instance — the debt is undone with
        // everything else.
        //
        // ZERO rows in MovimientoCuentaPorCobrar: creating a debt is not a movement of the
        // ledger, there is no TipoMovimientoCuentaPorCobrar for "opened". The first writer
        // of that ledger is F-033.
        if (creditoBasePersistido > 0) {
          await tx.cuentaPorCobrar.create({
            data: {
              ventaId: venta.id,
              clienteId: clienteIdEfectivo,
              // The SAME variable already persisted as Venta.tiendaId. Never re-read from
              // the body, from a route param, or from anywhere else: TENANT_RELATION_PATH
              // reaches negocioId through this column alone, so a row born with a
              // different tiendaId would hang from the wrong tenant with a correct path.
              tiendaId,
              // The moment the sale happened, not the moment it arrived: a sale synced
              // three days late would otherwise be born with the wrong age, and aging is
              // measured from this column. The `?? new Date()` is unreachable today — the
              // route already answers 400 without `createdAt` — and is here so the
              // expression has a type.
              fechaVenta: createdAt ? new Date(createdAt) : new Date(),
              // Both from the SAME variable and unrounded: rounding here and not in
              // Venta.creditoBase would drift the two figures apart by a cent.
              montoOriginal: creditoBasePersistido,
              saldoPendiente: creditoBasePersistido,
              settledAt: null,
              // monedaDeudaCode and montoDeudaMonedaOriginal are left null: the checkout
              // denominates the whole sale in base, so there is no second currency to note
              // (contract § 5.5, decision 8). The first feature with one is F-036.
            },
          });
        }

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

    let result: Awaited<ReturnType<typeof ejecutarVentaTx>> = null;

    // The credit path and the transaction, retried AT MOST ONCE and only for the one
    // failure a retry can resolve: the race two DIFFERENT sales naming the same brand-new
    // customer lose against each other — two syncIds, two devices, one name. The sale's own
    // idempotency does not cover it; it protects against re-sending the SAME sale (E-038).
    //
    // What is NOT repeated, and it matters: products, monedaBase, resolveSaleTasaSnapshot,
    // discounts, reconcileSaleTotal and validateTip. None of them depends on the customer,
    // none of them changes between the two passes (contract § 5.6).
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Only when there IS credit (decision 3). checkCreditInvariant is stricter than
        // what the server does today, and calling it unguarded would turn cash sales that
        // are registered today into 400s — exactly the degradation criterion 1 forbids.
        if (creditoBasePersistido > 0) {
          const extras = creditExtras.data;
          // Both lookups are read-only, run OUTSIDE the transaction and are scoped with the
          // negocioId assertTiendaTenant resolved — never one read from the body. Neither
          // filters by deletedAt, on purpose (contract § 5.1). Only one of the two runs.
          const byId = extras.clienteId
            ? await prisma.cliente.findFirst({
                where: withTenantScope(
                  "cliente",
                  { id: extras.clienteId },
                  negocioId,
                ),
                select: { id: true, deletedAt: true },
              })
            : null;

          const nombreNormalizado = normalizeClienteNombre(
            extras.clienteNombre ?? "",
          );
          const byNombre =
            !extras.clienteId && nombreNormalizado
              ? await prisma.cliente.findFirst({
                  where: withTenantScope(
                    "cliente",
                    { nombre: nombreNormalizado },
                    negocioId,
                  ),
                  select: { id: true, deletedAt: true },
                })
              : null;

          resolution = resolveCreditCustomer({
            creditoBase: creditoBasePersistido,
            clienteId: extras.clienteId,
            clienteNombre: extras.clienteNombre,
            byId,
            byNombre,
            nuevoClienteId: crypto.randomUUID(),
          });
          clienteIdEfectivo = resolution.clienteId;

          // The RECONCILED total, never the client's: validating against the client's
          // figure would void the only defence against a debt the client invented
          // (criterion 13).
          const check = checkCreditInvariant({
            total: ventaTotal,
            tipTotal,
            creditoBase: creditoBasePersistido,
            clienteId: resolution.clienteId,
            pagosDetalle,
            vueltoDetalle,
            tasaSnapshot: tasaSnapshotResuelto,
            monedaBase,
          });
          if (!check.ok) {
            return NextResponse.json(
              {
                error: CREDIT_INVARIANT_ERROR_MESSAGE[check.violation],
                code: check.violation,
              },
              { status: CREDIT_INVARIANT_HTTP_STATUS[check.violation] },
            );
          }
        }

        result = await ejecutarVentaTx();
        break;
      } catch (error: unknown) {
        const esCarreraDeAlta =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (resolution.action === "CREATE" ||
            resolution.action === "REACTIVATE");
        if (!esCarreraDeAlta) throw error;

        // The syncId recovery keeps its priority: if the sale is already there, it is
        // returned as it is, wrapped as this route wraps it.
        const ventaYaCreada = await prisma.venta.findFirst({
          where: withTenantScope("venta", { syncId }, negocioId),
          include: { productos: true },
        });
        if (ventaYaCreada) {
          return NextResponse.json({
            success: true,
            venta: ventaYaCreada,
            duplicado: true,
          });
        }

        // The transaction is already aborted and nothing of it committed, so re-running the
        // whole path is safe: on the second pass the pre-transaction read finds the row the
        // winner created and the resolution comes back EXISTING, writing no Cliente at all.
        if (attempt < CREDIT_CUSTOMER_UPSERT_RETRIES) continue;

        // 409 and not 500: `isPermanentSyncError` parks a 409 instead of spinning on it.
        console.error(
          "❌ [APP/VENTA/POST] Carrera irresoluble en el alta del cliente a credito:",
          syncId,
        );
        return NextResponse.json(
          {
            error: CREDIT_CUSTOMER_CONFLICT_MESSAGE,
            code: CREDIT_CUSTOMER_CONFLICT_CODE,
          },
          { status: 409 },
        );
      }
    }

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
      const ventaExistente = tenantScope
        ? await prisma.venta.findFirst({
            where: withTenantScope("venta", { syncId }, tenantScope.negocioId),
            include: { productos: true },
          })
        : null;
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

    if (!periodoId) {
      return NextResponse.json(
        { error: "tiendaId y periodoId son requeridos" },
        { status: 400 },
      );
    }

    // F-021: no permission — this verb never demanded one (ADR 0078).
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

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
      where: withTenantScope(
        "venta",
        {
          cierrePeriodoId: periodoId,
          tiendaId: tiendaId,
        },
        scope.negocioId,
      ),
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
