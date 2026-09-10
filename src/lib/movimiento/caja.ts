import { prisma } from "@/lib/prisma";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { applyGastosToResumenMap } from "@/lib/gastos";
import { buildResumenPropinas } from "@/lib/tips";
import { UNKNOWN_PAYMENT_LINE_TYPE_WARNING } from "@/constants/pago";
import { netCollectionRows } from "@/lib/cuentasPorCobrar/cobrosNetos";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { Prisma } from "@prisma/client";

// Subconjunto de PrismaClient usado por calcularEfectivoDisponiblePorMoneda —
// acepta tanto el cliente normal como un `tx` dentro de $transaction, para
// poder ejecutar el cálculo con lock dentro de la misma transacción que
// escribe el movimiento (ver CreateMoviento).
type PrismaLike = typeof prisma | Prisma.TransactionClient;

type ResumenEntry = {
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
};

export type MovimientoCajaRelevante = {
  tipo: string;
  formaPago?: string | null;
  costoTotal?: number | null;
  montoReembolso?: number | null;
  monedaOriginal?: string | null;
  montoOriginal?: number | null;
  montoEfectivoCaja?: number | null;
  /** DEVOLUCION_VENTA on a credit sale: how much of montoReembolso went to the debt. */
  montoAplicadoADeuda?: number | null;
};

export type TotalesMovimientosPeriodo = {
  totalComprasCaja: number;
  totalMerma: number;
  totalDevoluciones: number;
};

/**
 * Monto de una COMPRA que realmente salió de la caja, en su moneda original.
 * EFECTIVO_CAJA = el monto completo; MIXTO = solo la porción cubierta con
 * caja (el resto es fondeo externo); EXTERNO = nada.
 */
export function montoCompraEnCaja(m: MovimientoCajaRelevante): number {
  if (m.formaPago === "MIXTO") return m.montoEfectivoCaja ?? 0;
  if (m.formaPago === "EFECTIVO_CAJA")
    return m.montoOriginal ?? m.costoTotal ?? 0;
  return 0;
}

/**
 * Agrega, para un conjunto de movimientos COMPRA/MERMA/DEVOLUCION_VENTA de un
 * período, los totales usados tanto en el resumen de caja como en el cálculo
 * de ganancia final. Única fuente de verdad para esta agregación — antes
 * estaba duplicada en cada endpoint que necesitaba estos totales.
 */
export function calcularTotalesMovimientosPeriodo(
  movimientos: MovimientoCajaRelevante[],
  monedaBase: string,
  tasas: ITasaSnapshot,
): TotalesMovimientosPeriodo {
  let totalComprasCaja = 0;
  let totalMerma = 0;
  let totalDevoluciones = 0;

  for (const m of movimientos) {
    if (m.tipo === "COMPRA") {
      const montoEnMoneda = montoCompraEnCaja(m);
      if (montoEnMoneda > 0) {
        // costoTotal de una COMPRA está en la moneda de la compra, no en monedaBase
        totalComprasCaja += convertToBase(
          montoEnMoneda,
          m.monedaOriginal ?? monedaBase,
          tasas,
          monedaBase,
        );
      }
    } else if (m.tipo === "MERMA") {
      totalMerma += m.costoTotal ?? 0;
    } else if (m.tipo === "DEVOLUCION_VENTA") {
      totalDevoluciones += (m.montoReembolso ?? 0) - (m.costoTotal ?? 0);
    }
  }

  return { totalComprasCaja, totalMerma, totalDevoluciones };
}

/**
 * Share of a DEVOLUCION_VENTA refund that actually left the drawer, in [0, 1].
 *
 * A refund on a credit sale can be applied against the customer's debt instead of being
 * handed back in cash (MovimientoStock.montoAplicadoADeuda, in base currency). What left
 * the drawer is montoReembolso - montoAplicadoADeuda, and callers apply that as a RATIO
 * over the figures they already compute, so the currency the refund was recorded in never
 * has to be reconciled against the base currency the debt is denominated in.
 *
 * Returns 1 when there is no debt portion, which is every row recorded before the column
 * existed and every refund of a non-credit sale: the caller then subtracts exactly what it
 * subtracts today.
 */
export function refundCashRatio(
  montoReembolsoBase: number,
  montoAplicadoADeuda: number | null | undefined,
): number {
  const debt = Number(montoAplicadoADeuda);
  if (!Number.isFinite(debt) || debt <= 0) return 1;
  const refund = Number(montoReembolsoBase);
  // A refund applied entirely to a debt that cannot be measured against anything: the
  // conservative reading is that the drawer does not go down.
  if (!Number.isFinite(refund) || refund <= 0) return 0;
  return Math.min(1, Math.max(0, (refund - debt) / refund));
}

/**
 * Descuenta de la caja del período (por moneda) las compras de mercancía pagadas
 * con efectivo de caja (total o parcialmente, ver formaPago = MIXTO) y los
 * reembolsos por devolución de venta. No toca ganancia (eso se calcula aparte
 * con totalMerma/totalDevoluciones sobre totalGananciaFinal).
 */
export function applyComprasYDevolucionesToResumenMap(
  map: Record<string, ResumenEntry>,
  movimientos: MovimientoCajaRelevante[],
  monedaBase: string,
  tasas: ITasaSnapshot,
): void {
  for (const m of movimientos) {
    if (m.tipo === "COMPRA") {
      const montoEnMoneda = montoCompraEnCaja(m);
      if (montoEnMoneda <= 0) continue;
      const moneda = m.monedaOriginal ?? monedaBase;
      // costoTotal de una COMPRA se guarda en la moneda de la compra, no en
      // monedaBase — hay que convertirlo explícitamente.
      const enBase = convertToBase(montoEnMoneda, moneda, tasas, monedaBase);
      if (!map[moneda]) {
        map[moneda] = {
          totalEfectivo: 0,
          totalTransfer: 0,
          equivalenteBase: 0,
        };
      }
      map[moneda].totalEfectivo -= montoEnMoneda;
      map[moneda].equivalenteBase -= enBase;
    } else if (m.tipo === "DEVOLUCION_VENTA") {
      const moneda = m.monedaOriginal ?? monedaBase;
      const montoEnMoneda = m.montoOriginal ?? m.montoReembolso ?? 0;
      // montoReembolso ya viene en monedaBase (convertido con la tasa
      // histórica de la venta original al crear la devolución). Si no viene,
      // NUNCA asumir que montoEnMoneda ya está en monedaBase — convertirlo
      // explícitamente para no restar, p.ej., dólares crudos de un
      // acumulado que está en pesos.
      const enBase =
        m.montoReembolso ??
        convertToBase(montoEnMoneda, moneda, tasas, monedaBase);
      if (!map[moneda]) {
        map[moneda] = {
          totalEfectivo: 0,
          totalTransfer: 0,
          equivalenteBase: 0,
        };
      }
      // Only the part that really left the drawer comes off the cash. The ratio is
      // computed entirely in base currency and applied to BOTH figures, so a refund
      // applied in full against the debt takes exactly 0 off each of them — converting
      // montoAplicadoADeuda into the refund's currency with the closing rates (which
      // need not be the ones of the original sale) would leave a non-zero residue.
      const cashRatio = refundCashRatio(enBase, m.montoAplicadoADeuda);
      map[moneda].totalEfectivo -= montoEnMoneda * cashRatio;
      map[moneda].equivalenteBase -= enBase * cashRatio;
    }
  }
}

/**
 * Agrupa, por moneda, los pagos y vueltos de un conjunto de ventas. Única
 * fuente de verdad — antes vivía duplicada como función local en el GET de
 * cierre y en close/route.ts.
 */
export function buildResumenMonedas(
  ventas: {
    pagosDetalle?: unknown;
    vueltoDetalle?: unknown;
    tasaSnapshot?: unknown;
  }[],
  monedaBase: string,
  tasasFallback: ITasaSnapshot = {},
): Array<{ id: string; monedaCode: string } & ResumenEntry> {
  const map: Record<string, ResumenEntry> = {};
  for (const venta of ventas) {
    if (!venta.pagosDetalle) continue;
    const pagos = venta.pagosDetalle as IPagoLinea[];
    const tasas = {
      ...tasasFallback,
      ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
    };
    for (const pago of pagos) {
      // The guard goes BEFORE the currency bucket is created: an unknown line must not
      // add a row of zeros either. pagosDetalle comes from a Json column and the cast
      // above validates nothing, so this branch is reachable at runtime.
      if (pago.tipo !== "cash" && pago.tipo !== "transfer") {
        console.warn(UNKNOWN_PAYMENT_LINE_TYPE_WARNING);
        continue;
      }
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

/**
 * Fondo inicial vigente de un período, por moneda. `InitialCashFund` es
 * append-only: cada edición inserta una fila con el snapshot completo de
 * todas las monedas, y la más reciente por createdAt es la vigente. Sin
 * ninguna fila, el fondo es 0 en todas las monedas (comportamiento por
 * defecto al abrir un período, sin insertar nada).
 */
export async function getCurrentInitialCashFundAmounts(
  cierrePeriodoId: string,
  client: PrismaLike = prisma,
): Promise<Record<string, number>> {
  const latest = await client.initialCashFund.findFirst({
    where: { cierrePeriodoId },
    orderBy: { createdAt: "desc" },
  });
  return (latest?.amounts as Record<string, number>) ?? {};
}

/**
 * Suma el fondo inicial de caja (por moneda) como término inicial positivo.
 * No es una deducción — es el punto de partida del efectivo, igual que las
 * ventas en efectivo del período. Debe aplicarse junto a (no después de)
 * applyGastosToResumenMap/applyComprasYDevolucionesToResumenMap.
 */
export function applyInitialFundToResumenMap(
  map: Record<string, ResumenEntry>,
  amounts: Record<string, number>,
  monedaBase: string,
  tasas: ITasaSnapshot,
): void {
  for (const [monedaCode, amount] of Object.entries(amounts)) {
    if (!amount) continue;
    if (!map[monedaCode]) {
      map[monedaCode] = {
        totalEfectivo: 0,
        totalTransfer: 0,
        equivalenteBase: 0,
      };
    }
    map[monedaCode].totalEfectivo += amount;
    map[monedaCode].equivalenteBase += convertToBase(
      amount,
      monedaCode,
      tasas,
      monedaBase,
    );
  }
}

export type ResumenCajaMoneda = {
  monedaCode: string;
  fondoInicial: number;
  // Ventas en efectivo, netas de vuelto — antes de mezclar el fondo inicial
  // y las deducciones (gastos, compras/devoluciones en efectivo).
  ventasEfectivo: number;
  // fondoInicial + ventasEfectivo - gastos - compras/devoluciones en efectivo.
  totalEsperado: number;
  equivalenteBase: number;
  // Propina en efectivo, ya incluida en ventasEfectivo y totalEsperado. Se
  // expone aparte para que el cajero sepa cuánto de la gaveta no es del
  // negocio, sin alterar el total contra el que se cuenta el efectivo.
  tipCash: number;
  // Debt collected in cash during this open period, net of nothing. Already included in
  // totalEsperado; kept apart from ventasEfectivo because the drawer widget has to be able
  // to tell a sale from the collection of an old debt.
  cobrosCreditoEfectivo: number;
};

/**
 * Única fuente de verdad del desglose de caja del período actualmente abierto
 * de una tienda, por moneda. `null` si no hay período abierto. Usada tanto
 * por `calcularEfectivoDisponiblePorMoneda` (solo el total) como por
 * `calcularResumenCajaPorMoneda` (desglose completo para el widget de caja).
 */
async function construirResumenCajaAbierta(
  tiendaId: string,
  monedaBase: string,
  client: PrismaLike,
): Promise<ResumenCajaMoneda[] | null> {
  const periodoAbierto = await client.cierrePeriodo.findFirst({
    where: { tiendaId, fechaFin: null },
    orderBy: { fechaInicio: "desc" },
  });
  if (!periodoAbierto) return null;

  const [
    ventas,
    gastosCierre,
    movimientosPeriodo,
    tiendaConNegocio,
    initialFundAmounts,
    abonos,
  ] = await Promise.all([
    client.venta.findMany({
      where: { cierrePeriodoId: periodoAbierto.id },
      select: {
        pagosDetalle: true,
        vueltoDetalle: true,
        tasaSnapshot: true,
        tipDetail: true,
      },
    }),
    client.gastoCierre.findMany({ where: { cierreId: periodoAbierto.id } }),
    client.movimientoStock.findMany({
      where: {
        tiendaId,
        tipo: { in: ["COMPRA", "DEVOLUCION_VENTA"] },
        fecha: { gte: periodoAbierto.fechaInicio },
      },
    }),
    client.tienda.findUnique({
      where: { id: tiendaId },
      select: { negocio: { select: { id: true } } },
    }),
    getCurrentInitialCashFundAmounts(periodoAbierto.id, client),
    client.movimientoCuentaPorCobrar.findMany({
      // Same tenant posture as the movimientoStock query above it: this function receives a
      // tiendaId its callers already resolved against the session's negocioId, and a Tienda
      // belongs to exactly one Negocio, so the hop through cuentaPorCobrar is the tenant edge.
      //
      // ABONO and REVERSION_ABONO, and only those two: CONDONACION and AJUSTE_DEVOLUCION move
      // no physical money and carry a null pagosDetalle. F-033 started writing REVERSION_ABONO,
      // so undoing a collection has to take the money back OUT of the drawer (ADR 0121) —
      // `netCollectionRows` below turns each reversal into a mirror with the amounts negated,
      // which is what makes `buildResumenMonedas` subtract without changing a line.
      where: {
        tipo: { in: ["ABONO", "REVERSION_ABONO"] },
        cuentaPorCobrar: { tiendaId },
        fecha: { gte: periodoAbierto.fechaInicio },
      },
      select: {
        id: true,
        tipo: true,
        fecha: true,
        pagosDetalle: true,
        tasaSnapshot: true,
        revierte: { select: { pagosDetalle: true, tasaSnapshot: true } },
      },
    }),
  ]);

  const negocioId = tiendaConNegocio?.negocio?.id;
  const tasasCambio = negocioId
    ? await client.tasaCambio.findMany({
        where: { negocioId },
        orderBy: { createdAt: "desc" },
        distinct: ["monedaCode"],
      })
    : [];
  const tasas = buildTasaSnapshot(tasasCambio);

  const toResumenMap = (
    rows: Array<{ monedaCode: string } & ResumenEntry>,
  ): Record<string, ResumenEntry> =>
    rows.reduce<Record<string, ResumenEntry>>((acc, r) => {
      acc[r.monedaCode] = {
        totalEfectivo: r.totalEfectivo,
        totalTransfer: r.totalTransfer,
        equivalenteBase: r.equivalenteBase,
      };
      return acc;
    }, {});

  // Sales and collections are aggregated by the SAME function: there is one definition of
  // "money in the drawer" for a sale and for the collection of an old debt. The two
  // breakdown figures are computed with separate passes and NEVER derived by subtracting
  // one from the other: (a + b) - b does not give back `a` in floating point, and
  // ventasEfectivo has to keep giving exactly today's number when there are no abonos.
  // A reversal arrives here as the MIRROR of the collection it undoes: the origin's lines with
  // the amounts negated, so the only-adding engine below subtracts them (ADR 0121).
  const abonosNetos = netCollectionRows(
    abonos.map((a) => ({
      id: a.id,
      tipo: a.tipo as "ABONO" | "REVERSION_ABONO",
      fecha: a.fecha,
      tasaSnapshot: (a.tasaSnapshot as ITasaSnapshot | null) ?? null,
      pagosDetalle: (a.pagosDetalle as IPagoLinea[] | null) ?? null,
      revierte: a.revierte
        ? {
            pagosDetalle:
              (a.revierte.pagosDetalle as IPagoLinea[] | null) ?? null,
            tasaSnapshot:
              (a.revierte.tasaSnapshot as ITasaSnapshot | null) ?? null,
          }
        : null,
    })),
  );

  const ventasPorMoneda = toResumenMap(
    buildResumenMonedas(ventas, monedaBase, tasas),
  );
  const cobrosPorMoneda = toResumenMap(
    buildResumenMonedas(abonosNetos, monedaBase, tasas),
  );
  const resumenMonedaMap = toResumenMap(
    buildResumenMonedas([...ventas, ...abonosNetos], monedaBase, tasas),
  );

  applyInitialFundToResumenMap(
    resumenMonedaMap,
    initialFundAmounts,
    monedaBase,
    tasas,
  );
  applyGastosToResumenMap(resumenMonedaMap, gastosCierre, monedaBase, tasas);
  applyComprasYDevolucionesToResumenMap(
    resumenMonedaMap,
    movimientosPeriodo,
    monedaBase,
    tasas,
  );

  // Las propinas se agregan aparte y NO se restan de la caja: el billete
  // sigue en la gaveta hasta que alguien lo reparta, así que el efectivo
  // esperado debe seguir incluyéndolo.
  const propinasPorMoneda = buildResumenPropinas(ventas, monedaBase, tasas);
  const tipCashPorMoneda = Object.fromEntries(
    propinasPorMoneda.map((p) => [p.monedaCode, p.tipCash]),
  );

  return Object.entries(resumenMonedaMap).map(([monedaCode, vals]) => ({
    monedaCode,
    fondoInicial: initialFundAmounts[monedaCode] ?? 0,
    ventasEfectivo: ventasPorMoneda[monedaCode]?.totalEfectivo ?? 0,
    totalEsperado: vals.totalEfectivo,
    equivalenteBase: vals.equivalenteBase,
    tipCash: tipCashPorMoneda[monedaCode] ?? 0,
    cobrosCreditoEfectivo: cobrosPorMoneda[monedaCode]?.totalEfectivo ?? 0,
  }));
}

/**
 * Efectivo real disponible en caja, por moneda, para el período actualmente
 * abierto de una tienda: pagos en efectivo de las ventas del período, menos
 * vueltos, gastos y compras/devoluciones ya registrados. Usado para no
 * permitir que una COMPRA en efectivo deje la caja en negativo (ver
 * FormaPagoCompra.MIXTO).
 */
export async function calcularEfectivoDisponiblePorMoneda(
  tiendaId: string,
  monedaBase: string,
  client: PrismaLike = prisma,
): Promise<Record<string, number>> {
  const resumen = await construirResumenCajaAbierta(
    tiendaId,
    monedaBase,
    client,
  );
  if (!resumen) return {};
  return Object.fromEntries(
    resumen.map((r) => [r.monedaCode, r.totalEsperado]),
  );
}

/**
 * Desglose de caja del período abierto, por moneda, separando cuánto es
 * fondo inicial y cuánto son ventas reales del total esperado en caja. Usado
 * por el widget de caja del POS.
 */
export async function calcularResumenCajaPorMoneda(
  tiendaId: string,
  monedaBase: string,
  client: PrismaLike = prisma,
): Promise<ResumenCajaMoneda[]> {
  return (
    (await construirResumenCajaAbierta(tiendaId, monedaBase, client)) ?? []
  );
}
