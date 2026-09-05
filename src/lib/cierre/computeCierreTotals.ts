import {
  convertFromBase,
  convertToBase,
  resolveSnapshotFromHistory,
} from "@/lib/currency";
import { applyGastosToResumenMap, calcularGananciaFinal } from "@/lib/gastos";
import {
  applyComprasYDevolucionesToResumenMap,
  applyInitialFundToResumenMap,
  buildResumenMonedas,
  calcularTotalesMovimientosPeriodo,
  montoCompraEnCaja,
  type MovimientoCajaRelevante,
} from "@/lib/movimiento/caja";
import { buildResumenPropinas, totalPropinasBase } from "@/lib/tips";
import type { IDeduccionItem } from "@/schemas/cierre";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaCambio, ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * The single engine that turns the raw rows of a period into its figures.
 *
 * Closing a period, recalculating a closed one, the live figures of the open
 * period and the drift check of the history list all run this same function
 * on the same input shape, so no two screens can disagree on what a period
 * is worth (ADR 0036). It is pure: no Prisma, no dates of its own, no
 * permissions — `loadCierreComputationInput` gathers the rows and
 * `persistCierreComputation` writes the result.
 */

export type TasaHistoryRecord = Pick<
  ITasaCambio,
  "monedaCode" | "tasa" | "createdAt"
>;

export interface CierreSaleLine {
  productoTiendaId: string;
  productoId: string;
  nombre: string;
  cantidad: number;
  costo: number;
  precio: number;
  monedaCostoCode: string | null;
  monedaPrecioCode: string | null;
  proveedor: { id: string; nombre: string } | null;
  /** Current stock of the ProductoTienda; consignment settlements record it. */
  existencia: number;
}

export interface CierreAppliedDiscount {
  amount: number;
  productsAffected: unknown;
}

export interface CierreSale {
  id: string;
  createdAt: Date;
  /** The stored `Venta.total`; only the reconciliation script reads it. */
  total?: number;
  discountTotal: number;
  tipTotal: number;
  totaltransfer: number;
  tasaSnapshot: ITasaSnapshot | null;
  pagosDetalle: IPagoLinea[] | null;
  vueltoDetalle: IVueltoLinea[] | null;
  tipDetail: IPagoLinea[] | null;
  usuario: { id: string; nombre: string } | null;
  transferDestination: { id: string; nombre: string } | null;
  appliedDiscounts: CierreAppliedDiscount[];
  productos: CierreSaleLine[];
}

export interface CierreGasto {
  id: string;
  nombre: string;
  tipoCalculo: string;
  montoCalculado: number;
  monedaCode: string | null;
  naturaleza: string;
  esAdHoc: boolean;
}

export interface CierreMovimiento extends MovimientoCajaRelevante {
  id: string;
  motivo?: string | null;
  productoNombre: string;
}

export interface CierreComputationInput {
  monedaBase: string;
  /** Closing instant; null while the period is still open. */
  fechaFin: Date | null;
  /** Full rate history of the business, ascending by createdAt. */
  historialTasas: TasaHistoryRecord[];
  ventas: CierreSale[];
  gastos: CierreGasto[];
  movimientos: CierreMovimiento[];
  initialFundAmounts: Record<string, number>;
}

/** Exactly the denormalized columns of `CierrePeriodo`. */
export interface CierreStoredTotals {
  totalVentas: number;
  totalVentasBrutas: number;
  totalDescuentos: number;
  totalInversion: number;
  totalGanancia: number;
  totalTransferencia: number;
  totalVentasPropias: number;
  totalVentasConsignacion: number;
  totalGananciasPropias: number;
  totalGananciasConsignacion: number;
  totalGastos: number;
  totalGananciaFinal: number;
  totalComprasCaja: number;
  totalMerma: number;
  totalDevoluciones: number;
  totalTips: number;
}

/** Exactly the columns of `ResumenMonedaCierre`, keyed by currency. */
export interface CierreResumenMoneda {
  monedaCode: string;
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
  totalEfectivoBruto: number;
  equivalenteBaseBruto: number;
  initialFund: number;
  tipCash: number;
  tipTransfer: number;
}

/** A consignment settlement line, as `ProductoProveedorLiquidacion` stores it. */
export interface CierreLiquidacion {
  proveedorId: string;
  productoId: string;
  vendidos: number;
  monto: number;
  costo: number;
  precio: number;
  existencia: number;
}

export interface ValuedSaleLine extends CierreSaleLine {
  precioBase: number;
  costoBase: number;
  totalProducto: number;
  gananciaProducto: number;
}

export interface ValuedSale {
  sale: CierreSale;
  /** Rates the sale is valued with: its own snapshot completed from history. */
  tasas: ITasaSnapshot;
  ventaBruta: number;
  ventaNeta: number;
  lineas: ValuedSaleLine[];
}

export interface NamedTotal {
  id: string;
  nombre: string;
  total: number;
}

export interface CierreComputation {
  totals: CierreStoredTotals;
  resumenMonedas: CierreResumenMoneda[];
  liquidaciones: CierreLiquidacion[];
  ventasValoradas: ValuedSale[];
  /** Rates the period itself is valued with (expenses, purchases, fund). */
  tasasCierre: ITasaSnapshot;
  /** Gross sales per bucket, net of the discounts prorated to them. */
  totalVentasPropiasNeto: number;
  totalVentasConsignacionNeto: number;
  totalVentasPorUsuario: NamedTotal[];
  tipsPorUsuario: NamedTotal[];
  totalTransferenciasByDestination: NamedTotal[];
  gananciaDeducciones: IDeduccionItem[];
  cajaDeducciones: Record<string, IDeduccionItem[]>;
}

/**
 * Widest gap tolerated between a stored total and its recomputation before
 * the period counts as drifted. Both come from this same function, so any
 * real gap means the sales changed after the figures were stored.
 */
export const CIERRE_TOTALS_DRIFT_TOLERANCE = 0.01;

/** Values every sale of the period with its own (completed) rates. */
export function valueSales(
  ventas: CierreSale[],
  monedaBase: string,
  historialTasas: TasaHistoryRecord[],
): ValuedSale[] {
  return ventas.map((sale) => {
    const tasas = resolveSnapshotFromHistory(
      historialTasas,
      sale.tasaSnapshot,
      sale.createdAt,
    );
    const lineas = sale.productos.map<ValuedSaleLine>((line) => {
      const precioBase = convertToBase(
        line.precio,
        line.monedaPrecioCode ?? monedaBase,
        tasas,
        monedaBase,
      );
      const costoBase = convertToBase(
        line.costo,
        line.monedaCostoCode ?? monedaBase,
        tasas,
        monedaBase,
      );
      return {
        ...line,
        precioBase,
        costoBase,
        totalProducto: line.cantidad * precioBase,
        gananciaProducto: line.cantidad * (precioBase - costoBase),
      };
    });
    const ventaBruta = lineas.reduce((sum, l) => sum + l.totalProducto, 0);
    const descuento = Number(sale.discountTotal ?? 0);
    return {
      sale,
      tasas,
      lineas,
      ventaBruta,
      ventaNeta: Math.max(0, ventaBruta - descuento),
    };
  });
}

export interface SalesTotals {
  totalVentas: number;
  totalVentasBrutas: number;
  totalDescuentos: number;
}

/** The three sales figures alone — what the drift check of the list needs. */
export function sumSalesTotals(ventasValoradas: ValuedSale[]): SalesTotals {
  return ventasValoradas.reduce<SalesTotals>(
    (acc, v) => ({
      totalVentas: acc.totalVentas + v.ventaNeta,
      totalVentasBrutas: acc.totalVentasBrutas + v.ventaBruta,
      totalDescuentos: acc.totalDescuentos + Number(v.sale.discountTotal ?? 0),
    }),
    { totalVentas: 0, totalVentasBrutas: 0, totalDescuentos: 0 },
  );
}

/**
 * True when the stored sales total no longer matches what the current sales
 * are worth — the sales of a closed period changed after it was closed.
 */
export function hasTotalsDrift(
  storedTotalVentas: number,
  computedTotalVentas: number,
  tolerance = CIERRE_TOTALS_DRIFT_TOLERANCE,
): boolean {
  return Math.abs(storedTotalVentas - computedTotalVentas) > tolerance;
}

function accumulateNamed(list: NamedTotal[], entry: NamedTotal | null) {
  if (!entry) return;
  const existing = list.find((e) => e.id === entry.id);
  if (existing) existing.total += entry.total;
  else list.push({ ...entry });
}

export function computeCierreTotals(
  input: CierreComputationInput,
): CierreComputation {
  const { monedaBase, historialTasas } = input;

  // Rates of the period itself, for everything that is not a sale: the rate
  // in force when it closed (or now, while open). Deterministic across
  // recalculations, unlike "the latest rate" the old close used.
  const tasasCierre = resolveSnapshotFromHistory(
    historialTasas,
    null,
    input.fechaFin ?? new Date(),
  );

  const ventasValoradas = valueSales(input.ventas, monedaBase, historialTasas);

  let totalVentas = 0;
  let totalVentasBrutas = 0;
  let totalDescuentos = 0;
  let totalTransferencia = 0;
  let totalInversion = 0;
  let totalVentasPropias = 0;
  let totalVentasConsignacion = 0;
  let totalGananciasPropias = 0;
  let totalGananciasConsignacion = 0;
  const totalVentasPorUsuario: NamedTotal[] = [];
  const tipsPorUsuario: NamedTotal[] = [];
  const totalTransferenciasByDestination: NamedTotal[] = [];
  const liquidacionesMap = new Map<string, CierreLiquidacion>();

  for (const valued of ventasValoradas) {
    const { sale } = valued;
    totalTransferencia += sale.totaltransfer;
    totalDescuentos += Number(sale.discountTotal ?? 0);
    totalVentasBrutas += valued.ventaBruta;
    totalVentas += valued.ventaNeta;

    accumulateNamed(
      totalVentasPorUsuario,
      sale.usuario && { ...sale.usuario, total: valued.ventaNeta },
    );
    const tip = Number(sale.tipTotal ?? 0);
    if (tip > 0) {
      accumulateNamed(
        tipsPorUsuario,
        sale.usuario && { ...sale.usuario, total: tip },
      );
    }
    if (sale.transferDestination) {
      accumulateNamed(totalTransferenciasByDestination, {
        ...sale.transferDestination,
        total: sale.totaltransfer,
      });
    }

    for (const line of valued.lineas) {
      const costoTotal = line.cantidad * line.costoBase;
      if (line.proveedor) {
        totalVentasConsignacion += line.totalProducto;
        totalGananciasConsignacion += line.gananciaProducto;

        const key = `${line.proveedor.id}_${line.productoId}`;
        const existing = liquidacionesMap.get(key);
        if (existing) {
          existing.vendidos += line.cantidad;
          existing.monto += costoTotal;
          existing.costo = existing.monto / existing.vendidos;
          existing.precio = line.precioBase;
          existing.existencia = line.existencia;
        } else {
          liquidacionesMap.set(key, {
            proveedorId: line.proveedor.id,
            productoId: line.productoId,
            vendidos: line.cantidad,
            monto: costoTotal,
            costo: line.costoBase,
            precio: line.precioBase,
            existencia: line.existencia,
          });
        }
      } else {
        totalInversion += costoTotal;
        totalVentasPropias += line.totalProducto;
        totalGananciasPropias += line.gananciaProducto;
      }
    }
  }

  // Discounts reduce profit by their full amount; they are prorated between
  // own and consigned goods by each bucket's share of the gross sales.
  let descuentoPropias = 0;
  let descuentoConsignacion = 0;
  if (totalVentasBrutas > 0 && totalDescuentos > 0) {
    descuentoPropias =
      totalDescuentos * (totalVentasPropias / totalVentasBrutas);
    descuentoConsignacion =
      totalDescuentos * (totalVentasConsignacion / totalVentasBrutas);
  }
  const totalGananciasPropiasNet = Math.max(
    0,
    totalGananciasPropias - descuentoPropias,
  );
  const totalGananciasConsignacionNet = Math.max(
    0,
    totalGananciasConsignacion - descuentoConsignacion,
  );
  const totalGanancia = Math.max(
    0,
    totalGananciasPropiasNet + totalGananciasConsignacionNet,
  );

  // Expenses: only OPERATIVO ones reduce profit; every one leaves the drawer.
  const gananciaDeducciones: IDeduccionItem[] = [];
  const cajaDeducciones: Record<string, IDeduccionItem[]> = {};
  const pushCaja = (moneda: string, item: IDeduccionItem) => {
    (cajaDeducciones[moneda] ??= []).push(item);
  };
  let totalGastos = 0;
  for (const g of input.gastos) {
    const moneda = g.monedaCode ?? monedaBase;
    if (g.naturaleza === "OPERATIVO") {
      const enBase = convertToBase(
        g.montoCalculado,
        moneda,
        tasasCierre,
        monedaBase,
      );
      totalGastos += enBase;
      gananciaDeducciones.push({
        id: g.id,
        tipo: "GASTO",
        label: g.nombre,
        monto: enBase,
        esAdHoc: g.esAdHoc,
      });
    }
    pushCaja(moneda, {
      id: g.id,
      tipo: "GASTO",
      label: g.nombre,
      monto: g.montoCalculado,
      esAdHoc: g.esAdHoc,
    });
  }

  const { totalComprasCaja, totalMerma, totalDevoluciones } =
    calcularTotalesMovimientosPeriodo(
      input.movimientos,
      monedaBase,
      tasasCierre,
    );
  for (const m of input.movimientos) {
    const moneda = m.monedaOriginal ?? monedaBase;
    if (m.tipo === "COMPRA") {
      const montoCaja = montoCompraEnCaja(m);
      if (montoCaja <= 0) continue;
      pushCaja(moneda, {
        id: m.id,
        tipo: "COMPRA",
        label:
          m.formaPago === "MIXTO"
            ? `${m.productoNombre} (mixto: ${(m.montoOriginal ?? 0) - montoCaja} de fondeo externo)`
            : m.productoNombre,
        monto: montoCaja,
        motivo: m.motivo,
      });
    } else if (m.tipo === "MERMA") {
      gananciaDeducciones.push({
        id: m.id,
        tipo: "MERMA",
        label: m.productoNombre,
        monto: m.costoTotal ?? 0,
        motivo: m.motivo,
      });
    } else if (m.tipo === "DEVOLUCION_VENTA") {
      gananciaDeducciones.push({
        id: m.id,
        tipo: "DEVOLUCION",
        label: m.productoNombre,
        monto: (m.montoReembolso ?? 0) - (m.costoTotal ?? 0),
        motivo: m.motivo,
      });
      // The drawer panel shows the refund in its own currency; montoReembolso
      // is in base, so it is converted back when montoOriginal is missing.
      const montoEnMoneda =
        m.montoOriginal ??
        (m.monedaOriginal
          ? convertFromBase(
              m.montoReembolso ?? 0,
              m.monedaOriginal,
              tasasCierre,
              monedaBase,
            )
          : (m.montoReembolso ?? 0));
      pushCaja(moneda, {
        id: m.id,
        tipo: "DEVOLUCION",
        label: m.productoNombre,
        monto: montoEnMoneda,
        motivo: m.motivo,
      });
    }
  }

  const totalGananciaFinal = calcularGananciaFinal(
    totalGanancia,
    totalGastos,
    totalMerma,
    totalDevoluciones,
  );

  // Cash per currency. Each sale carries its completed rates, so the fallback
  // the helpers accept never decides a conversion of a sale.
  const ventasConTasas = ventasValoradas.map((v) => ({
    pagosDetalle: v.sale.pagosDetalle,
    vueltoDetalle: v.sale.vueltoDetalle,
    tipDetail: v.sale.tipDetail,
    tasaSnapshot: v.tasas,
  }));
  const resumenMap = buildResumenMonedas(
    ventasConTasas,
    monedaBase,
    tasasCierre,
  ).reduce<
    Record<
      string,
      { totalEfectivo: number; totalTransfer: number; equivalenteBase: number }
    >
  >((acc, r) => {
    acc[r.monedaCode] = {
      totalEfectivo: r.totalEfectivo,
      totalTransfer: r.totalTransfer,
      equivalenteBase: r.equivalenteBase,
    };
    return acc;
  }, {});

  // The initial fund is the starting point of the drawer, not a deduction: it
  // goes in before the gross snapshot so both gross and final include it.
  applyInitialFundToResumenMap(
    resumenMap,
    input.initialFundAmounts,
    monedaBase,
    tasasCierre,
  );
  const bruto: Record<
    string,
    { totalEfectivo: number; equivalenteBase: number }
  > = {};
  for (const [code, vals] of Object.entries(resumenMap)) {
    bruto[code] = {
      totalEfectivo: vals.totalEfectivo,
      equivalenteBase: vals.equivalenteBase,
    };
  }
  applyGastosToResumenMap(resumenMap, input.gastos, monedaBase, tasasCierre);
  applyComprasYDevolucionesToResumenMap(
    resumenMap,
    input.movimientos,
    monedaBase,
    tasasCierre,
  );

  const propinas = Object.fromEntries(
    buildResumenPropinas(ventasConTasas, monedaBase, tasasCierre).map((p) => [
      p.monedaCode,
      p,
    ]),
  );

  const resumenMonedas = Object.entries(resumenMap).map<CierreResumenMoneda>(
    ([monedaCode, vals]) => ({
      monedaCode,
      totalEfectivo: vals.totalEfectivo,
      totalTransfer: vals.totalTransfer,
      equivalenteBase: vals.equivalenteBase,
      totalEfectivoBruto:
        bruto[monedaCode]?.totalEfectivo ?? vals.totalEfectivo,
      equivalenteBaseBruto:
        bruto[monedaCode]?.equivalenteBase ?? vals.equivalenteBase,
      initialFund: input.initialFundAmounts[monedaCode] ?? 0,
      tipCash: propinas[monedaCode]?.tipCash ?? 0,
      tipTransfer: propinas[monedaCode]?.tipTransfer ?? 0,
    }),
  );

  return {
    totals: {
      totalVentas,
      totalVentasBrutas,
      totalDescuentos,
      totalInversion,
      totalGanancia,
      totalTransferencia,
      totalVentasPropias,
      totalVentasConsignacion,
      totalGananciasPropias: totalGananciasPropiasNet,
      totalGananciasConsignacion: totalGananciasConsignacionNet,
      totalGastos,
      totalGananciaFinal,
      totalComprasCaja,
      totalMerma,
      totalDevoluciones,
      totalTips: totalPropinasBase(input.ventas),
    },
    resumenMonedas,
    liquidaciones: Array.from(liquidacionesMap.values()),
    ventasValoradas,
    tasasCierre,
    totalVentasPropiasNeto: Math.max(0, totalVentasPropias - descuentoPropias),
    totalVentasConsignacionNeto: Math.max(
      0,
      totalVentasConsignacion - descuentoConsignacion,
    ),
    totalVentasPorUsuario,
    tipsPorUsuario,
    totalTransferenciasByDestination,
    gananciaDeducciones,
    cajaDeducciones,
  };
}

/**
 * Which consignment settlements a recalculation may rewrite. A settlement
 * with `liquidatedAt` is money already handed to the supplier: it is kept
 * untouched and the recomputed line for the same supplier/product is dropped.
 */
export function mergeLiquidaciones<
  T extends {
    proveedorId: string;
    productoId: string;
    liquidatedAt: Date | null;
  },
>(
  existing: T[],
  computed: CierreLiquidacion[],
): { toCreate: CierreLiquidacion[]; kept: T[] } {
  const kept = existing.filter((l) => l.liquidatedAt !== null);
  const keptKeys = new Set(kept.map((l) => `${l.proveedorId}_${l.productoId}`));
  return {
    kept,
    toCreate: computed.filter(
      (l) => !keptKeys.has(`${l.proveedorId}_${l.productoId}`),
    ),
  };
}
