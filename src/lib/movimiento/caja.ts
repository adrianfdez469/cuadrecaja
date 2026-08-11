import { prisma } from "@/lib/prisma";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { applyGastosToResumenMap } from "@/lib/gastos";
import { buildResumenPropinas } from "@/lib/tips";
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
      map[moneda].totalEfectivo -= montoEnMoneda;
      map[moneda].equivalenteBase -= enBase;
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

  const resumenMonedaMap = buildResumenMonedas(
    ventas,
    monedaBase,
    tasas,
  ).reduce<Record<string, ResumenEntry>>((acc, r) => {
    acc[r.monedaCode] = { ...r };
    return acc;
  }, {});

  // Snapshot de ventas en efectivo (netas de vuelto) antes de mezclar el
  // fondo inicial y las deducciones — es la línea "ventas reales" del
  // desglose de caja.
  const ventasEfectivoPorMoneda: Record<string, number> = {};
  for (const [moneda, vals] of Object.entries(resumenMonedaMap)) {
    ventasEfectivoPorMoneda[moneda] = vals.totalEfectivo;
  }

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
    ventasEfectivo: ventasEfectivoPorMoneda[monedaCode] ?? 0,
    totalEsperado: vals.totalEfectivo,
    equivalenteBase: vals.equivalenteBase,
    tipCash: tipCashPorMoneda[monedaCode] ?? 0,
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
