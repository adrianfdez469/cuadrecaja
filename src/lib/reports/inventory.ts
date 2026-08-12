import { convertToBase } from "@/lib/currency";
import type { ProductDimension } from "./sales-stream";
import type { ProductSalesResult } from "./aggregators/product-sales";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export type TurnoverRow = {
  storeProductId: string;
  nombre: string;
  categoryName: string;
  /** Present-day stock, not a figure for the requested range. */
  existenciaActual: number;
  unidadesVendidas: number;
  ventaDiariaPromedio: number;
  /** Stock ÷ average daily sales. Null when the product did not sell. */
  diasCobertura: number | null;
  valorStock: number;
  rotacion: number;
  estado: "sin_stock" | "critico" | "bajo" | "saludable" | "sobrestock";
};

export type DeadStockRow = {
  storeProductId: string;
  nombre: string;
  categoryName: string;
  existenciaActual: number;
  capitalInmovilizado: number;
  expiresAt: Date | null;
};

export type AbcRow = {
  storeProductId: string;
  nombre: string;
  ganancia: number;
  ventasNetas: number;
  gananciaAcumuladaPorcentaje: number;
  clase: "A" | "B" | "C";
};

export type ExpiryBucket = {
  /** Days-to-expiry ceiling for this bucket; 0 means already expired. */
  dias: number;
  etiqueta: string;
  productos: number;
  unidades: number;
  valorEnRiesgo: number;
};

export type ExpiryRiskRow = {
  storeProductId: string;
  nombre: string;
  existenciaActual: number;
  valorEnRiesgo: number;
  expiresAt: Date;
  diasRestantes: number;
};

/** Coverage thresholds, in days of remaining stock. */
const CRITICAL_DAYS = 3;
const LOW_DAYS = 7;
const OVERSTOCK_DAYS = 90;

const EXPIRY_BUCKETS = [
  { dias: 0, etiqueta: "Vencidos" },
  { dias: 7, etiqueta: "≤ 7 días" },
  { dias: 15, etiqueta: "≤ 15 días" },
  { dias: 30, etiqueta: "≤ 30 días" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stock value in base currency, using the product's current cost currency. */
function stockValue(
  dimension: ProductDimension,
  baseCurrency: string,
  rates: ITasaSnapshot,
): number {
  return convertToBase(
    dimension.currentCost * dimension.currentStock,
    dimension.currentCostCurrency ?? baseCurrency,
    rates,
    baseCurrency,
  );
}

function classifyCoverage(
  existencia: number,
  dias: number | null,
): TurnoverRow["estado"] {
  if (existencia <= 0) return "sin_stock";
  if (dias === null) return "sobrestock"; // stock that never sold in the range
  if (dias <= CRITICAL_DAYS) return "critico";
  if (dias <= LOW_DAYS) return "bajo";
  if (dias >= OVERSTOCK_DAYS) return "sobrestock";
  return "saludable";
}

/**
 * Turnover and days of coverage.
 *
 * Replaces the hardcoded "stock ≤ 5 units is low" rule: five units is a week
 * for one product and a year for another, so coverage is measured against how
 * fast each product actually sells.
 */
export function buildTurnoverReport(
  dimensions: Map<string, ProductDimension>,
  sales: ProductSalesResult,
  days: number,
  baseCurrency: string,
  rates: ITasaSnapshot,
): TurnoverRow[] {
  const rows: TurnoverRow[] = [];
  const safeDays = Math.max(1, days);

  for (const dimension of dimensions.values()) {
    if (dimension.isDeleted) continue;

    const sold = sales.byStoreProductId.get(dimension.storeProductId);
    const unidadesVendidas = sold?.unidades ?? 0;
    const ventaDiariaPromedio = unidadesVendidas / safeDays;
    const diasCobertura =
      ventaDiariaPromedio > 0
        ? dimension.currentStock / ventaDiariaPromedio
        : null;

    rows.push({
      storeProductId: dimension.storeProductId,
      nombre: dimension.displayName,
      categoryName: dimension.categoryName,
      existenciaActual: dimension.currentStock,
      unidadesVendidas,
      ventaDiariaPromedio,
      diasCobertura,
      valorStock: stockValue(dimension, baseCurrency, rates),
      rotacion:
        dimension.currentStock > 0
          ? unidadesVendidas / dimension.currentStock
          : 0,
      estado: classifyCoverage(dimension.currentStock, diasCobertura),
    });
  }

  // Most urgent first: products about to run out lead the list.
  return rows.sort((a, b) => {
    if (a.diasCobertura === null) return 1;
    if (b.diasCobertura === null) return -1;
    return a.diasCobertura - b.diasCobertura;
  });
}

/** Products holding stock that sold nothing in the range — cash sitting still. */
export function buildDeadStockReport(
  dimensions: Map<string, ProductDimension>,
  sales: ProductSalesResult,
  baseCurrency: string,
  rates: ITasaSnapshot,
): DeadStockRow[] {
  const rows: DeadStockRow[] = [];

  for (const dimension of dimensions.values()) {
    if (dimension.isDeleted || dimension.currentStock <= 0) continue;
    if (
      (sales.byStoreProductId.get(dimension.storeProductId)?.unidades ?? 0) > 0
    ) {
      continue;
    }

    rows.push({
      storeProductId: dimension.storeProductId,
      nombre: dimension.displayName,
      categoryName: dimension.categoryName,
      existenciaActual: dimension.currentStock,
      capitalInmovilizado: stockValue(dimension, baseCurrency, rates),
      expiresAt: dimension.expiresAt,
    });
  }

  return rows.sort((a, b) => b.capitalInmovilizado - a.capitalInmovilizado);
}

/**
 * ABC classification by cumulative profit: A up to 80%, B to 95%, C the rest.
 * Identifies the minority of products carrying most of the margin.
 */
export function buildAbcReport(sales: ProductSalesResult): AbcRow[] {
  const positive = sales.rows
    .filter((row) => row.ganancia > 0)
    .sort((a, b) => b.ganancia - a.ganancia);

  const total = positive.reduce((acc, row) => acc + row.ganancia, 0);
  if (total <= 0) return [];

  let cumulative = 0;

  return positive.map((row) => {
    cumulative += row.ganancia;
    const share = (cumulative / total) * 100;
    return {
      storeProductId: row.storeProductId,
      nombre: row.nombre,
      ganancia: row.ganancia,
      ventasNetas: row.ventasNetas,
      gananciaAcumuladaPorcentaje: share,
      clase: share <= 80 ? "A" : share <= 95 ? "B" : "C",
    };
  });
}

/**
 * Money at risk from expiry, bucketed by how soon each lot expires.
 *
 * The existing expiry alert only lists products; valuing the stock is what
 * turns it into a decision about what to discount first.
 */
export function buildExpiryRiskReport(
  dimensions: Map<string, ProductDimension>,
  baseCurrency: string,
  rates: ITasaSnapshot,
  now: Date = new Date(),
): { buckets: ExpiryBucket[]; rows: ExpiryRiskRow[]; totalEnRiesgo: number } {
  const buckets: ExpiryBucket[] = EXPIRY_BUCKETS.map((bucket) => ({
    ...bucket,
    productos: 0,
    unidades: 0,
    valorEnRiesgo: 0,
  }));

  const rows: ExpiryRiskRow[] = [];
  let totalEnRiesgo = 0;

  for (const dimension of dimensions.values()) {
    if (dimension.isDeleted || !dimension.expiresAt) continue;
    if (dimension.currentStock <= 0) continue;

    const diasRestantes = Math.floor(
      (dimension.expiresAt.getTime() - now.getTime()) / DAY_MS,
    );
    if (diasRestantes > 30) continue;

    const valor = stockValue(dimension, baseCurrency, rates);
    totalEnRiesgo += valor;

    rows.push({
      storeProductId: dimension.storeProductId,
      nombre: dimension.displayName,
      existenciaActual: dimension.currentStock,
      valorEnRiesgo: valor,
      expiresAt: dimension.expiresAt,
      diasRestantes,
    });

    const target =
      buckets.find((bucket) => diasRestantes <= bucket.dias) ??
      buckets[buckets.length - 1];
    target.productos += 1;
    target.unidades += dimension.currentStock;
    target.valorEnRiesgo += valor;
  }

  return {
    buckets,
    rows: rows.sort((a, b) => a.diasRestantes - b.diasRestantes),
    totalEnRiesgo,
  };
}
