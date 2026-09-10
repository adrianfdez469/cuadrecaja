import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { IVenta, IFaltanteExistencia } from "@/schemas/venta";
import { formatQuantity } from "@/utils/formatters";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { applyDiscountsForSale } from "@/lib/discounts";
import { calcularEfectivoDisponiblePorMoneda } from "@/lib/movimiento/caja";
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
import { getSession } from "@/utils/auth";
import {
  assertTiendaTenant,
  tenantNotFoundResponse,
  withTenantScope,
  type ITenantScope,
} from "@/lib/tenantScope";
import { creditoExtrasSchema } from "@/schemas/pago";
import {
  checkCreditInvariant,
  CREDIT_INVARIANT_HTTP_STATUS,
} from "@/lib/cuentasPorCobrar/creditInvariant";
import {
  resolveCreditCustomer,
  type ICreditCustomerResolution,
} from "@/lib/cuentasPorCobrar/creditCustomer";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import { buildVentaCreditoResumen } from "@/lib/ventaMapper";
import {
  CREDIT_CUSTOMER_CONFLICT_CODE,
  CREDIT_CUSTOMER_CONFLICT_MESSAGE,
  CREDIT_CUSTOMER_UPSERT_RETRIES,
  CREDIT_EXTRAS_INVALID_MESSAGE,
  CREDIT_INVARIANT_ERROR_MESSAGE,
} from "@/constants/creditoVenta";

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

/**
 * La tienda no tiene con qué cubrir la venta.
 *
 * Lleva la lista completa, no la primera línea que falló: al cajero le sirve
 * de poco saber que un producto no alcanza si al reponerlo se encuentra con
 * que tampoco alcanzaba el siguiente. El mensaje se arma aquí para que sea
 * legible incluso donde solo llega el texto.
 */
class InsufficientStockError extends Error {
  constructor(public readonly faltantes: IFaltanteExistencia[]) {
    super(
      `Existencia insuficiente para registrar la venta: ${faltantes
        .map(
          (f) =>
            `${f.nombre} (pide ${formatQuantity(f.solicitada)}, hay ${formatQuantity(f.disponible)})`,
        )
        .join("; ")}`,
    );
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
  // Declared out here so the P2002 recovery in the catch can scope its lookup too.
  let tenantScope: ITenantScope | null = null;

  try {
    const { cierreId, tiendaId } = await params;

    // F-021: the store must belong to the session's business before anything is read or written.
    // No permission required — the sale itself never demanded one (ADR 0078).
    const session = await getSession();
    const guard = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!guard.scope) return guard.response;
    tenantScope = guard.scope;
    const { negocioId } = tenantScope;

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
      // Propina — a diferencia del descuento, el servidor no puede derivarla
      // (es una decisión del cajero), solo validar que tenga respaldo en caja.
      tipTotal,
      tipDetail,
      // Credit sale (F-032). Validated by creditoExtrasSchema below, before anything reads
      // the numbers.
      creditoBase,
      clienteId,
      clienteNombre,
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

    // The author of the sale must belong to the same business (ADR 0076).
    const autor = await prisma.usuario.findFirst({
      where: withTenantScope("usuario", { id: usuarioId }, negocioId),
      select: { id: true },
    });
    if (!autor) {
      return tenantNotFoundResponse();
    }

    // Verificar si ya existe una venta con este syncId (idempotencia)
    const existeVenta = await prisma.venta.findFirst({
      where: withTenantScope("venta", { syncId: syncId }, negocioId),
      include: {
        productos: true,
      },
    });

    if (existeVenta) {
      return NextResponse.json(existeVenta, { status: 200 });
    }

    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope(
        "cierrePeriodo",
        { tiendaId, fechaFin: null },
        negocioId,
      ),
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
      const periodoDeLaVenta = await prisma.cierrePeriodo.findFirst({
        where: withTenantScope(
          "cierrePeriodo",
          { id: cierreId, tiendaId },
          negocioId,
        ),
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

    // The credit fields, parsed before anything reads the numbers. This is what closes the
    // negative-creditoBase hole that checkCreditInvariant leaves explicitly to its caller.
    // The Zod detail is NOT echoed: it quotes the value that failed (E-031).
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

    // Base currency and a complete rate snapshot come first: discounts are
    // priced in base, the total is recomputed in base from the lines, and the
    // change is validated against the drawer per currency further down.
    const tiendaConNegocio = await prisma.tienda.findFirst({
      where: withTenantScope("tienda", { id: tiendaId }, negocioId),
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    const monedaBase = tiendaConNegocio?.negocio?.monedaBase ?? "CUP";

    // The client's snapshot is completed server-side before anything reads it:
    // a session may hold rates loaded before a moneda was registered, and every
    // consumer downstream converts a missing moneda at rate 1.
    const pagosLineas = (pagosDetalle as IPagoLinea[] | undefined) ?? [];
    const vueltosLineas = (vueltoDetalle as IVueltoLinea[] | undefined) ?? [];
    const { snapshot: tasaSnapshotResuelto, missing: tasasFaltantes } =
      await resolveSaleTasaSnapshot({
        negocioId,
        monedaBase,
        clientSnapshot: tasaSnapshot,
        momento: createdAt ? new Date(createdAt) : new Date(),
        monedas: [...pagosLineas, ...vueltosLineas].map((l) => l.moneda),
      });
    if (tasasFaltantes.length > 0) {
      console.error(
        "❌ [POST /api/venta] Tasa de cambio faltante:",
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
    const lineasVenta = (productosMegrados as MergedProduct[]).map((p) => ({
      precio: p.precio ?? p.price,
      cantidad: Number(p.cantidad) || 0,
      monedaPrecioCode: p.monedaPrecioCode ?? null,
    }));

    // 2. Calcular descuentos SIEMPRE en base a los productos del payload
    // (códigos opcionales). Solo lee; NO debe correr dentro del tx.
    // Prices go in already converted to base, as the web POS does
    // (`useCartTotals` feeds `priceBase`): a fixed discount is a base amount,
    // and a CUP price fed as-is to a USD business would be discounted as if it
    // were dollars.
    let discountTotalCalc = 0;
    let discountCalcResult: Awaited<
      ReturnType<typeof applyDiscountsForSale>
    > | null = null;
    try {
      const discountProducts = (productosMegrados as MergedProduct[]).map(
        (p, i) => ({
          productoTiendaId: String(p.productoTiendaId),
          cantidad: lineasVenta[i].cantidad,
          precio: linePriceInBase(
            lineasVenta[i],
            tasaSnapshotResuelto,
            monedaBase,
          ),
        }),
      );

      discountCalcResult = await applyDiscountsForSale({
        ...tenantScope,
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
      console.warn("⚠️ [POST /api/venta] Total del cliente descartado:", {
        syncId,
        clientTotal: totalReconciliado.clientTotal,
        serverTotal: totalReconciliado.total,
        delta: totalReconciliado.delta,
      });
    }
    const ventaTotal = totalReconciliado.total;

    // La propina se valida fuera de la transacción: solo compara números del
    // propio payload, no toca la base. Una propina sin respaldo en lo cobrado
    // inflaría todos los reportes de propina sin que la caja cambie.
    const tipCheck = validateTip({
      tipTotal,
      tipDetail,
      pagosDetalle: pagosLineas,
      vueltoDetalle: vueltosLineas,
      tasaSnapshot: tasaSnapshotResuelto,
      total: ventaTotal,
      monedaBase,
    });
    if (!tipCheck.ok) {
      console.error("❌ [POST /api/venta] Propina inválida:", tipCheck.error);
      return NextResponse.json({ error: tipCheck.error }, { status: 400 });
    }

    // The debtor of this sale, and what has to be written for it to exist. It stays null
    // for a cash sale because it is INITIALISED null and the only block that can change it
    // sits entirely behind `creditoBasePersistido > 0` — that is what sustains the
    // `Venta.clienteId NULL <=> creditoBase = 0` invariant F-029 wrote on the column.
    let clienteIdEfectivo: string | null = null;
    let resolution: ICreditCustomerResolution = {
      action: "NONE",
      clienteId: null,
      nombre: null,
    };

    // **TRANSACCIÓN ATÓMICA: Todo o nada (SOLO escrituras)**
    const ejecutarVentaTx = () => prisma.$transaction(
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
            // Recomputed above from the persisted lines converted to base; the
            // client's `total` was only compared against it.
            total: ventaTotal,
            totalcash,
            totaltransfer,
            cierrePeriodoId: ultimoPeriodo.id,
            syncId,
            // 🆕 NUEVOS CAMPOS
            frontendCreatedAt: createdAt ? new Date(createdAt) : null,
            wasOffline: wasOffline || false,
            syncAttempts: syncAttempts || 0, // 🆕 Usar syncAttempts enviado desde frontend
            discountTotal: discountTotalCalc || 0,
            creditoBase: creditoBasePersistido,
            clienteId: clienteIdEfectivo,
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
            // Persisted only when there is something to persist: a CUP-only
            // business without rates keeps null, which reports rely on.
            ...((tasaSnapshot ||
              Object.keys(tasaSnapshotResuelto).length > 0) && {
              tasaSnapshot: tasaSnapshotResuelto,
            }),
            // Propina — ya validada contra el excedente realmente cobrado.
            tipTotal: tipCheck.tipTotal,
            ...(tipCheck.tipDetail && { tipDetail: tipCheck.tipDetail }),
          },
          include: {
            productos: true,
          },
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
              // Con qué nombrar el rechazo si el padre no da para abrir: al
              // cajero le importa la línea que vendió —«Cigarro suelto»— y no
              // el envase del que salía.
              origen: {
                productoTiendaId: prodFracc.id,
                nombre: prod.name || prodFracc.id,
                solicitada: prod.cantidad,
                sueltas: prodFracc.existencia,
                unidadesPorFraccion:
                  prodFracc.producto.unidadesPorFraccion ?? 0,
              },
            });
          }

          // Desagregación en tres consultas, no en seis por producto.
          //
          // Cada fracción hacía antes un `findFirst`, un `update` y un `create`
          // por su padre y otros tres por sí misma: seis viajes secuenciales a
          // la base por producto fraccionado, dentro de la transacción y con el
          // advisory lock de la tienda tomado. Aquí se lee una vez, se simula
          // la secuencia completa en memoria y se escribe una vez.
          const idsProductoDesagregacion = Array.from(
            new Set(
              [...itemsDesagregaciónBaja, ...itemsDesagregaciónAlta].map(
                (item) => String(item.productoId),
              ),
            ),
          );

          if (idsProductoDesagregacion.length > 0) {
            const filasDesagregacion = await tx.productoTienda.findMany({
              where: {
                tiendaId,
                productoId: { in: idsProductoDesagregacion },
                proveedorId: null, // Solo productos propios para desagregación
              },
            });

            // La primera fila de cada producto, que es exactamente lo que
            // devolvía `findFirst`.
            const porProductoId = new Map<
              string,
              (typeof filasDesagregacion)[number]
            >();
            for (const fila of filasDesagregacion) {
              if (!porProductoId.has(fila.productoId)) {
                porProductoId.set(fila.productoId, fila);
              }
            }

            // Se recorre en el mismo orden que antes —primero las bajas, luego
            // las altas— descontando sobre un mapa en memoria. Así cada
            // movimiento registra el mismo `existenciaAnterior` que veía la
            // lectura secuencial, incluso cuando dos fracciones comparten
            // padre y la segunda debe partir de lo que dejó la primera.
            const existenciaSimulada = new Map(
              filasDesagregacion.map((f) => [f.id, f.existencia]),
            );
            const deltaPorId = new Map<string, number>();
            const movimientosDesagregacion: Prisma.MovimientoStockCreateManyInput[] =
              [];

            const aplicar = (
              items: {
                cantidad: number;
                productoId: string;
                origen?: {
                  productoTiendaId: string;
                  nombre: string;
                  solicitada: number;
                  sueltas: number;
                  unidadesPorFraccion: number;
                };
              }[],
              tipo: "DESAGREGACION_BAJA" | "DESAGREGACION_ALTA",
            ) => {
              const signo = tipo === "DESAGREGACION_BAJA" ? -1 : 1;
              for (const item of items) {
                const fila = porProductoId.get(item.productoId);
                if (!fila) continue;

                const existenciaAnterior = existenciaSimulada.get(fila.id) ?? 0;
                if (signo < 0 && existenciaAnterior < item.cantidad) {
                  // Se informa en unidades de lo que se vende, no en paquetes:
                  // «pide 25, hay 8» dice algo; «faltan 2 cajas» obliga a
                  // multiplicar mentalmente para saber si se puede cobrar.
                  const origen = item.origen;
                  throw origen
                    ? new InsufficientStockError([
                        {
                          productoTiendaId: origen.productoTiendaId,
                          nombre: origen.nombre,
                          solicitada: origen.solicitada,
                          disponible:
                            origen.sueltas +
                            existenciaAnterior * origen.unidadesPorFraccion,
                        },
                      ])
                    : new Error(
                        `Existencia insuficiente, no hay suficiente existencia para desagregar. Existencia: ${existenciaAnterior}, Cantidad a desagregar: ${item.cantidad}`,
                      );
                }

                existenciaSimulada.set(
                  fila.id,
                  existenciaAnterior + signo * item.cantidad,
                );
                deltaPorId.set(
                  fila.id,
                  (deltaPorId.get(fila.id) ?? 0) + signo * item.cantidad,
                );
                movimientosDesagregacion.push({
                  tipo,
                  cantidad: item.cantidad,
                  productoTiendaId: fila.id,
                  tiendaId,
                  usuarioId,
                  existenciaAnterior,
                  referenciaId: venta.id,
                  motivo: `Desagregación para venta ${venta.id}`,
                });
              }
            };

            aplicar(itemsDesagregaciónBaja, "DESAGREGACION_BAJA");
            aplicar(itemsDesagregaciónAlta, "DESAGREGACION_ALTA");

            if (deltaPorId.size > 0) {
              // `::text` y no `::uuid`: Prisma mapea `String @id` a una columna
              // `text`, y comparar contra un `uuid` hace fallar el UPDATE.
              const filas = Array.from(deltaPorId.entries()).map(
                ([id, delta]) =>
                  Prisma.sql`(${id}::text, ${delta}::double precision)`,
              );
              await tx.$executeRaw`
                UPDATE "ProductoTienda" AS pt
                SET existencia = pt.existencia + v.delta
                FROM (VALUES ${Prisma.join(filas)}) AS v(id, delta)
                WHERE pt.id = v.id
              `;
            }

            if (movimientosDesagregacion.length > 0) {
              await tx.movimientoStock.createMany({
                data: movimientosDesagregacion,
              });
            }
          }
        }

        // 4. Actualizar existencias y acumular movimientos de venta - ÚLTIMO
        //
        // Una lectura y una escritura para toda la venta, no dos por línea.
        // Antes esto hacía un `findUnique` y un `update` por producto dentro de
        // la transacción: diez líneas eran veinte viajes secuenciales a la
        // base, cada uno pagando el salto extra del pooler, y todo ello con el
        // advisory lock de la tienda tomado — es decir, bloqueando las ventas
        // del resto de las cajas. Es lo que agotaba el timeout de la
        // transacción (ver PERFORMANCE_ISSUES.md).
        const idsVenta: string[] = Array.from(
          new Set(productos.map((p) => String(p.productoTiendaId))),
        );
        // Leídas ahora, después de las desagregaciones, que es justo lo que
        // hacía la lectura por producto.
        const existenciasActuales = await tx.productoTienda.findMany({
          where: { id: { in: idsVenta } },
          select: { id: true, existencia: true },
        });
        const existenciaPorId = new Map(
          existenciasActuales.map((p) => [p.id, p.existencia]),
        );

        const movimientosVenta: Prisma.MovimientoStockCreateManyInput[] = [];
        const decrementoPorId = new Map<string, number>();
        // Se recorren todas las líneas antes de rechazar: cortar en la primera
        // obligaba al cajero a descubrir las que faltaban de una en una,
        // reponiendo y reintentando por cada producto.
        const faltantes: IFaltanteExistencia[] = [];
        for (const producto of productos) {
          const productoTienda = productosExistentes.find(
            (p) => p.id === producto.productoTiendaId,
          );
          if (!productoTienda) continue;

          const existenciaAnterior = existenciaPorId.get(
            producto.productoTiendaId,
          );
          if (existenciaAnterior === undefined) continue;

          if (existenciaAnterior < producto.cantidad) {
            faltantes.push({
              productoTiendaId: producto.productoTiendaId,
              nombre: producto.name || producto.productoTiendaId,
              solicitada: producto.cantidad,
              disponible: existenciaAnterior,
            });
            continue;
          }

          // El mapa se va descontando línea a línea para reproducir exactamente
          // lo que veía la lectura secuencial: si un mismo producto llegara en
          // dos líneas, la segunda parte de la existencia que dejó la primera.
          existenciaPorId.set(
            producto.productoTiendaId,
            existenciaAnterior - producto.cantidad,
          );
          decrementoPorId.set(
            producto.productoTiendaId,
            (decrementoPorId.get(producto.productoTiendaId) ?? 0) +
              producto.cantidad,
          );

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

        // Tras revisar todas las líneas y antes de descontar ninguna. Lo que la
        // transacción haya escrito hasta aquí —las desagregaciones— se deshace
        // con ella.
        if (faltantes.length > 0) {
          throw new InsufficientStockError(faltantes);
        }

        // Un solo UPDATE para todas las líneas. Prisma no sabe descontar una
        // cantidad distinta por fila en una sola llamada, así que va en SQL —
        // parametrizado con `Prisma.join`, nunca interpolado.
        if (decrementoPorId.size > 0) {
          // `::text`, no `::uuid`: Prisma mapea `String @id` a una columna
          // `text`, y comparar contra un `uuid` hace fallar el UPDATE entero.
          const filas = Array.from(decrementoPorId.entries()).map(
            ([id, cantidad]) =>
              Prisma.sql`(${id}::text, ${cantidad}::double precision)`,
          );
          await tx.$executeRaw`
            UPDATE "ProductoTienda" AS pt
            SET existencia = pt.existencia - v.cantidad
            FROM (VALUES ${Prisma.join(filas)}) AS v(id, cantidad)
            WHERE pt.id = v.id
          `;
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
    // none of them changes between the two passes, and repeating them would cost five more
    // queries for a race that does not affect them (contract § 5.6).
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
            pagosDetalle: pagosLineas,
            vueltoDetalle: vueltosLineas,
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
        // returned as it is with a 200.
        const ventaYaCreada = await prisma.venta.findFirst({
          where: withTenantScope("venta", { syncId }, negocioId),
          include: { productos: true },
        });
        if (ventaYaCreada) {
          return NextResponse.json(ventaYaCreada, { status: 200 });
        }

        // The transaction is already aborted and nothing of it committed, so re-running the
        // whole path is safe: on the second pass the pre-transaction read finds the row the
        // winner created and the resolution comes back EXISTING, writing no Cliente at all.
        if (attempt < CREDIT_CUSTOMER_UPSERT_RETRIES) continue;

        // 409 and not 500: `isPermanentSyncError` parks a 409 instead of spinning on it.
        // The sale is not lost — it stays visible as pending and the drawer's re-send button
        // sends it again, and on that send the pre-transaction read already finds the
        // customer. A 500 would have made it retry alone up to MAX_SYNC_ATTEMPTS.
        console.error(
          "❌ [POST /api/venta] Carrera irresoluble en el alta del cliente a credito:",
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

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    // 409, no 500: la venta es correcta, es la tienda la que no la cubre. Un
    // 5xx la habría hecho pasar por un fallo pasajero y la cola la habría
    // reenviado sola una y otra vez.
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: error.message, faltantes: error.faltantes },
        { status: 409 },
      );
    }

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
      const ventaExistente = tenantScope
        ? await prisma.venta.findFirst({
            where: withTenantScope("venta", { syncId }, tenantScope.negocioId),
            include: { productos: true },
          })
        : null;
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

    // F-021: no permission — the sales history of the open period is part of the cashier flow.
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

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
        // The debtor's name, so a sale reloaded into the POS can reprint its ticket with the
        // customer on it. It opens no leak: the findMany is already scoped with
        // withTenantScope, and Venta.cliente can only point at a Cliente of the same
        // business because it is this route that writes it, resolved under scope.
        cliente: {
          select: { id: true, nombre: true },
        },
        // F-035, by written delegation: the credit state of the list is read from an EXPLICIT
        // field of the serialized sale, never deduced from `totalcash + totaltransfer < total`
        // (E-013, criterion 2). It is an `include` over a @unique relation — one row per sale,
        // no N+1 — and the ledger travels only as a COUNT, through summarizeVentaCobros. The
        // POST of this same file is NOT touched.
        cuentaPorCobrar: {
          select: {
            id: true,
            saldoPendiente: true,
            settledAt: true,
            montoOriginal: true,
            movimientos: { select: { tipo: true, monto: true } },
          },
        },
      },
      where: withTenantScope(
        "venta",
        {
          cierrePeriodoId: cierreId,
          tiendaId: tiendaId,
        },
        scope.negocioId,
      ),
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
      tipTotal: Number(venta.tipTotal ?? 0),
      tipDetail:
        (venta.tipDetail as unknown as IVenta["tipDetail"]) ?? undefined,
      creditoBase: Number(venta.creditoBase ?? 0),
      clienteId: venta.clienteId ?? undefined,
      clienteNombre: venta.cliente?.nombre ?? undefined,
      // IMPORTED from src/lib/ventaMapper.ts, never a second assembly of the same block: if each
      // caller built it its own way, the chip of /ventas and the chip of the mobile app could
      // disagree about the very same sale (F-035, contract § 5).
      credito: buildVentaCreditoResumen(venta.cuentaPorCobrar),
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
