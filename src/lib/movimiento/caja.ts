import { prisma } from "@/lib/prisma";
import { convertToBase, buildTasaSnapshot } from "@/lib/currency";
import { applyGastosToResumenMap } from "@/lib/gastos";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";

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
      // histórica de la venta original al crear la devolución)
      const enBase = m.montoReembolso ?? montoEnMoneda;
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
 * Efectivo real disponible en caja, por moneda, para el período actualmente
 * abierto de una tienda: pagos en efectivo de las ventas del período, menos
 * vueltos, gastos y compras/devoluciones ya registrados. Usado para no
 * permitir que una COMPRA en efectivo deje la caja en negativo (ver
 * FormaPagoCompra.MIXTO).
 */
export async function calcularEfectivoDisponiblePorMoneda(
  tiendaId: string,
  monedaBase: string,
): Promise<Record<string, number>> {
  const periodoAbierto = await prisma.cierrePeriodo.findFirst({
    where: { tiendaId, fechaFin: null },
    orderBy: { fechaInicio: "desc" },
  });
  if (!periodoAbierto) return {};

  const [ventas, gastosCierre, movimientosPeriodo, tiendaConNegocio] =
    await Promise.all([
      prisma.venta.findMany({
        where: { cierrePeriodoId: periodoAbierto.id },
        select: { pagosDetalle: true, vueltoDetalle: true, tasaSnapshot: true },
      }),
      prisma.gastoCierre.findMany({ where: { cierreId: periodoAbierto.id } }),
      prisma.movimientoStock.findMany({
        where: {
          tiendaId,
          tipo: { in: ["COMPRA", "DEVOLUCION_VENTA"] },
          fecha: { gte: periodoAbierto.fechaInicio },
        },
      }),
      prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: { negocio: { select: { id: true } } },
      }),
    ]);

  const negocioId = tiendaConNegocio?.negocio?.id;
  const tasasCambio = negocioId
    ? await prisma.tasaCambio.findMany({
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

  applyGastosToResumenMap(resumenMonedaMap, gastosCierre, monedaBase, tasas);
  applyComprasYDevolucionesToResumenMap(
    resumenMonedaMap,
    movimientosPeriodo,
    monedaBase,
    tasas,
  );

  const disponible: Record<string, number> = {};
  for (const [moneda, vals] of Object.entries(resumenMonedaMap)) {
    disponible[moneda] = vals.totalEfectivo;
  }
  return disponible;
}
