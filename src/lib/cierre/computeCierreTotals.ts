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
  refundCashRatio,
  type MovimientoCajaRelevante,
} from "@/lib/movimiento/caja";
import { buildResumenPropinas, totalPropinasBase } from "@/lib/tips";
import { buildCuentasPorCobrarSnapshot } from "@/lib/cuentasPorCobrar/aging";
import type { ICuentaPorCobrarSnapshotInput } from "@/lib/cuentasPorCobrar/aging";
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
  /** Venta.creditoBase: the part of `total` handed over on credit, in base currency. */
  creditoBase: number;
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
  /** ABONO rows whose `fecha` falls inside the period. */
  abonos: CierreAbono[];
  /** Accounts still open at the cutoff, with their movements ALREADY cut off by the loader. */
  cuentasPorCobrar: ICuentaPorCobrarSnapshotInput[];
  /** Transfer destinations of the store, to name the one an abono line points at. */
  transferDestinations: { id: string; nombre: string }[];
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
  /**
   * Sum of Venta.creditoBase of the period. Inside totalVentas, outside the drawer.
   *
   * These three columns are mirrored in `cierreStoredTotalsSchema` and `cierreDataSchema`
   * (src/schemas/cierre.ts). That file belongs to F-034 and is extended there, when the
   * closing screens start rendering the figures; until then the three travel in the JSON
   * of every response without a declared type.
   */
  totalCreditoOtorgado: number;
  /** Debt collected during this period, whatever period the debt was born in. Inside the drawer, outside totalVentas. */
  totalCobrosCredito: number;
  /** Store balance still outstanding at the cutoff, across all periods. A STOCK, never summed across periods. */
  totalPorCobrarAlCierre: number;
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

/**
 * An ABONO row of MovimientoCuentaPorCobrar, as the engine reads it.
 *
 * It deliberately does NOT carry `monto`. MovimientoCuentaPorCobrar.monto is the ledger
 * figure; totalCobrosCredito is defined as what entered the drawer, which comes out of
 * pagosDetalle. Carrying both into the same input would put two candidates for the same
 * definition side by side.
 */
export interface CierreAbono {
  id: string;
  /** When the collection happened. This alone is what assigns it to a period. */
  fecha: Date;
  /** Its OWN rates, from the day it was collected — never the closing rates. */
  tasaSnapshot: ITasaSnapshot | null;
  /** Same IPagoLinea[] shape as Venta.pagosDetalle, so one function reads both. */
  pagosDetalle: IPagoLinea[] | null;
}

export interface ValuedAbono {
  abono: CierreAbono;
  /** Its own snapshot completed from history, resolved at `abono.fecha`. */
  tasas: ITasaSnapshot;
  /** Base value of its cash AND transfer lines. */
  totalBase: number;
  /** Base value of its transfer lines, keyed by transferDestinationId. */
  transferBaseByDestination: Record<string, number>;
}

/**
 * Values every collection of the period with its OWN (completed) rates.
 *
 * Deliberately parallel to valueSales, and for the same reason: a collection happens weeks
 * after the sale, in another state of the market, so valuing it with the closing rates
 * would credit the drawer with a rate that was not in force when the customer paid.
 */
export function valueAbonos(
  abonos: CierreAbono[],
  monedaBase: string,
  historialTasas: TasaHistoryRecord[],
): ValuedAbono[] {
  const input = Array.isArray(abonos) ? abonos : [];
  return input.map((abono) => {
    const tasas = resolveSnapshotFromHistory(
      historialTasas,
      abono.tasaSnapshot,
      abono.fecha,
    );
    const transferBaseByDestination: Record<string, number> = {};
    let totalBase = 0;
    const lineas = Array.isArray(abono.pagosDetalle) ? abono.pagosDetalle : [];
    for (const linea of lineas) {
      // Same rule as buildResumenMonedas: a line whose tipo is neither "cash" nor
      // "transfer" contributes to nothing. No warning is emitted here — that function
      // already logs one for this very line and a second would duplicate the period's log.
      if (linea.tipo !== "cash" && linea.tipo !== "transfer") continue;
      // linea.equivalenteBase is NOT read: the drawer values this same line with
      // convertToBase, and taking a different number here would open a gap in the
      // reconciliation equation (ADR 0105).
      const enBase = convertToBase(
        linea.monto,
        linea.moneda,
        tasas,
        monedaBase,
      );
      totalBase += enBase;
      // A transfer line without a destination adds to totalBase and to no destination,
      // exactly as a sale whose transferDestination is null does today.
      if (linea.tipo === "transfer" && linea.transferDestinationId) {
        transferBaseByDestination[linea.transferDestinationId] =
          (transferBaseByDestination[linea.transferDestinationId] ?? 0) + enBase;
      }
    }
    return { abono, tasas, totalBase, transferBaseByDestination };
  });
}

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

  // The instant the period is measured against: the closing instant of a closed period,
  // now while it is still open. Hoisted because the receivables snapshot needs the very
  // same one.
  const corteCierre = input.fechaFin ?? new Date();
  // Rates of the period itself, for everything that is not a sale: the rate
  // in force when it closed (or now, while open). Deterministic across
  // recalculations, unlike "the latest rate" the old close used.
  const tasasCierre = resolveSnapshotFromHistory(
    historialTasas,
    null,
    corteCierre,
  );

  const ventasValoradas = valueSales(input.ventas, monedaBase, historialTasas);
  // Valued next to the sales, not in the cash block: the per-destination accumulation
  // below needs the result before the drawer is built.
  const abonosValorados = valueAbonos(input.abonos, monedaBase, historialTasas);

  let totalVentas = 0;
  let totalCreditoOtorgado = 0;
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
    // The only line the credit adds here. totalVentas, totalGanancia, totalInversion, the
    // discount proration and the consignment settlements do NOT change: profit is accrued
    // on delivery and an uncollected debt is not a refund.
    totalCreditoOtorgado += Number(sale.creditoBase ?? 0);

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

  // Collections by transfer land in the bank too, so the per-destination breakdown — which
  // is the reconciliation against the bank statement — includes them. Runs after the sales
  // loop so the destinations of the sales are already in.
  //
  // Deliberate asymmetry, worth knowing before painting the two together: the
  // totalTransferencia COLUMN does not change, it stays a sales figure. From here on the
  // two stop adding up to the same number as soon as there is a collection by transfer.
  const destinationNames = new Map(
    input.transferDestinations.map((d) => [d.id, d.nombre] as const),
  );
  for (const valued of abonosValorados) {
    for (const [destinationId, total] of Object.entries(
      valued.transferBaseByDestination,
    )) {
      const nombre = destinationNames.get(destinationId);
      if (nombre === undefined) continue;
      accumulateNamed(totalTransferenciasByDestination, {
        id: destinationId,
        nombre,
        total,
      });
    }
  }

  // What entered the drawer, never MovimientoCuentaPorCobrar.monto. NOT rounded: criterion
  // 12 compares it against the unrounded sum of resumenMonedas.equivalenteBase, and a
  // round2 here would open a gap of up to half a cent in the equation.
  const totalCobrosCredito = abonosValorados.reduce(
    (sum, a) => sum + a.totalBase,
    0,
  );

  // A STOCK, not a flow: recomputed from scratch against the cutoff on every run, never
  // added to the previous period's. The cutoff that decides the figure is the one the
  // loader already applied to each account's movements; `corteCierre` here only drives
  // `dias`/`bucket`, which F-030 neither exposes nor stores.
  const totalPorCobrarAlCierre = buildCuentasPorCobrarSnapshot(
    input.cuentasPorCobrar,
    corteCierre,
  ).total;

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
      // The SAME ratio applyComprasYDevolucionesToResumenMap takes off the drawer, so the
      // panel line and the total agree on what left it. ADR 0105 reads
      // `reembolsosEnEfectivo` of the reconciliation equation from this very entry, and a
      // refund applied in full against the debt has to show 0 here: the profit went down,
      // the cash did not.
      const reembolsoBase =
        m.montoReembolso ??
        convertToBase(montoEnMoneda, moneda, tasasCierre, monedaBase);
      pushCaja(moneda, {
        id: m.id,
        tipo: "DEVOLUCION",
        label: m.productoNombre,
        monto:
          montoEnMoneda * refundCashRatio(reembolsoBase, m.montoAplicadoADeuda),
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
  // Collections enter the drawer through the SAME call as the sales: one definition of
  // "money in the drawer" for a sale and for the collection of an old debt. No adapter is
  // needed — buildResumenMonedas asks for pagosDetalle, vueltoDetalle and tasaSnapshot
  // structurally, and each abono carries its OWN resolved rates, not the closing ones.
  const abonosConTasas = abonosValorados.map((a) => ({
    pagosDetalle: a.abono.pagosDetalle,
    vueltoDetalle: null,
    tasaSnapshot: a.tasas,
  }));
  const resumenMap = buildResumenMonedas(
    [...ventasConTasas, ...abonosConTasas],
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

  // ONLY the sales, never the abonos: a collection generates no tip. Passing them would
  // change nothing today, but it would make valid a shape that tomorrow would tip.
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
      totalCreditoOtorgado,
      totalCobrosCredito,
      totalPorCobrarAlCierre,
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
