import { prisma } from "@/lib/prisma";
import { convertToBase } from "@/lib/currency";
import { prorateSaleDiscountsByRule } from "./discount-proration";
import type { DiscountRuleTotals } from "./discount-proration";
import type { ReportScope } from "./scope";
import type { IDateRange } from "@/schemas/reports/common";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IPagoLinea } from "@/schemas/pago";

/**
 * Server-internal shapes: they carry Maps, Dates and callbacks and never cross
 * the HTTP boundary, so they stay plain types. Everything a route actually
 * serializes is defined as a Zod schema under `src/schemas/reports/`.
 */

/**
 * Catalog facts about a store product, loaded once per request instead of
 * through a three-level nested include on every sale.
 */
export type ProductDimension = {
  storeProductId: string;
  productId: string;
  productName: string;
  /** "Producto - Proveedor" for consignment, plain name otherwise. */
  displayName: string;
  supplierId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  /** Present-day stock — a point-in-time value, not a figure for the range. */
  currentStock: number;
  currentCost: number;
  currentCostCurrency: string | null;
  expiresAt: Date | null;
  isConsignment: boolean;
  isDeleted: boolean;
};

export type NormalizedSaleLine = {
  storeProductId: string;
  quantity: number;
  /** All amounts below are in base currency. */
  grossAmount: number;
  costAmount: number;
  discountAmount: number;
  netAmount: number;
  grossProfit: number;
  netProfit: number;
  dimension: ProductDimension | null;
};

export type NormalizedSale = {
  id: string;
  /** Real sale time: the POS timestamp when available, server time otherwise. */
  soldAt: Date;
  closingPeriodId: string | null;
  sellerId: string;
  collectionCurrency: string;
  rates: ITasaSnapshot;
  /** False when the sale had no tasaSnapshot and foreign lines fell back to 1. */
  hasRates: boolean;
  payments: IPagoLinea[] | null;
  /** Pre-multicurrency fallback, used when `payments` is null. */
  fallbackCash: number;
  fallbackTransfer: number;
  fallbackTransferDestinationId: string | null;
  grossAmount: number;
  discountTotal: number;
  netAmount: number;
  netProfit: number;
  lines: NormalizedSaleLine[];
  discountsByRule: Map<string, DiscountRuleTotals>;
};

export type SalesStreamStats = {
  salesScanned: number;
  linesScanned: number;
  salesWithoutRates: number;
  unknownProducts: number;
  truncated: boolean;
  closingPeriodIds: Set<string>;
};

export type SalesStreamOptions = {
  /** Sales fetched per round-trip. */
  batchSize?: number;
  /** Hard ceiling; hitting it sets `truncated`. */
  maxSales?: number;
  /** Overrides `scope.range` — used to scan the comparison window. */
  range?: IDateRange;
};

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_SALES = 100_000;

/**
 * Loads every store product as a lookup table.
 *
 * Soft-deleted rows are included on purpose: a historical sale can reference a
 * product that was later removed from the store, and dropping it would silently
 * lose revenue from the reports.
 */
export async function loadProductDimensions(
  tiendaId: string,
): Promise<Map<string, ProductDimension>> {
  const rows = await prisma.productoTienda.findMany({
    where: { tiendaId },
    select: {
      id: true,
      productoId: true,
      costo: true,
      existencia: true,
      monedaCostoCode: true,
      fechaVencimiento: true,
      proveedorId: true,
      deletedAt: true,
      producto: {
        select: {
          nombre: true,
          categoriaId: true,
          categoria: { select: { nombre: true, color: true } },
        },
      },
      proveedor: { select: { nombre: true } },
    },
  });

  const dimensions = new Map<string, ProductDimension>();

  for (const row of rows) {
    const productName = row.producto?.nombre ?? "Producto desconocido";
    const supplierName = row.proveedor?.nombre ?? null;

    dimensions.set(row.id, {
      storeProductId: row.id,
      productId: row.productoId,
      productName,
      displayName: supplierName
        ? `${productName} - ${supplierName}`
        : productName,
      supplierId: row.proveedorId,
      supplierName,
      categoryId: row.producto?.categoriaId ?? null,
      categoryName: row.producto?.categoria?.nombre ?? "Sin categoría",
      categoryColor: row.producto?.categoria?.color ?? null,
      currentStock: row.existencia,
      currentCost: row.costo,
      currentCostCurrency: row.monedaCostoCode,
      expiresAt: row.fechaVencimiento,
      isConsignment: row.proveedorId !== null,
      isDeleted: row.deletedAt !== null,
    });
  }

  return dimensions;
}

/**
 * Streams every sale in the range, already converted to base currency and with
 * discounts prorated per line.
 *
 * Scope matches the closings semantics the rest of the reporting uses: only
 * sales belonging to closing periods fully contained in the range, so the
 * figures reconcile with `/resumen_cierre`.
 *
 * Memory stays bounded — one batch is resident at a time, walked by keyset
 * pagination on the primary key rather than a single unbounded findMany.
 */
export async function streamNormalizedSales(
  scope: ReportScope,
  dimensions: Map<string, ProductDimension>,
  onSale: (sale: NormalizedSale) => void,
  options: SalesStreamOptions = {},
): Promise<SalesStreamStats> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxSales = options.maxSales ?? DEFAULT_MAX_SALES;
  const range = options.range ?? scope.range;
  const { baseCurrency } = scope;

  const stats: SalesStreamStats = {
    salesScanned: 0,
    linesScanned: 0,
    salesWithoutRates: 0,
    unknownProducts: 0,
    truncated: false,
    closingPeriodIds: new Set<string>(),
  };

  let cursor: string | null = null;

  for (;;) {
    const batch = await prisma.venta.findMany({
      where: {
        tiendaId: scope.tiendaId,
        cierrePeriodo: {
          fechaInicio: { gte: range.from },
          fechaFin: { lte: range.to },
        },
      },
      include: { productos: true, appliedDiscounts: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) break;

    for (const venta of batch) {
      if (stats.salesScanned >= maxSales) {
        stats.truncated = true;
        return stats;
      }

      onSale(normalizeSale(venta, dimensions, baseCurrency, stats));
      stats.salesScanned += 1;
    }

    if (batch.length < batchSize) break;
    cursor = batch[batch.length - 1].id;
  }

  return stats;
}

type RawSale = Awaited<
  ReturnType<
    typeof prisma.venta.findMany<{
      include: { productos: true; appliedDiscounts: true };
    }>
  >
>[number];

/**
 * Converts one persisted sale into base currency and prorates its discounts.
 *
 * Conversion uses the sale's own `tasaSnapshot`, never today's rates: a sale is
 * worth what it was worth when it happened. Presenting those base amounts in
 * another currency is the UI's job, and it does use current rates.
 */
function normalizeSale(
  venta: RawSale,
  dimensions: Map<string, ProductDimension>,
  baseCurrency: string,
  stats: SalesStreamStats,
): NormalizedSale {
  const rates = (venta.tasaSnapshot ?? {}) as ITasaSnapshot;
  const hasRates = Object.keys(rates).length > 0;
  const discountTotal = Number(venta.discountTotal ?? 0);

  let usedForeignCurrency = false;

  const partials = venta.productos.map((linea) => {
    const priceCurrency = linea.monedaPrecioCode ?? baseCurrency;
    const costCurrency = linea.monedaCostoCode ?? baseCurrency;
    if (priceCurrency !== baseCurrency || costCurrency !== baseCurrency) {
      usedForeignCurrency = true;
    }

    const unitPrice = convertToBase(
      linea.precio,
      priceCurrency,
      rates,
      baseCurrency,
    );
    const unitCost = convertToBase(
      linea.costo,
      costCurrency,
      rates,
      baseCurrency,
    );

    const dimension = dimensions.get(linea.productoTiendaId) ?? null;
    if (!dimension) stats.unknownProducts += 1;

    return {
      storeProductId: linea.productoTiendaId,
      quantity: linea.cantidad,
      grossAmount: unitPrice * linea.cantidad,
      costAmount: unitCost * linea.cantidad,
      grossProfit: (unitPrice - unitCost) * linea.cantidad,
      dimension,
    };
  });

  stats.linesScanned += partials.length;
  // Only flag missing rates when they would actually have changed a number.
  if (!hasRates && usedForeignCurrency) stats.salesWithoutRates += 1;
  if (venta.cierrePeriodoId) stats.closingPeriodIds.add(venta.cierrePeriodoId);

  const { perLine, perRule } = prorateSaleDiscountsByRule(
    partials,
    discountTotal,
    venta.appliedDiscounts.map((discount) => ({
      discountRuleId: discount.discountRuleId,
      amount: Number(discount.amount ?? 0),
      productsAffected: discount.productsAffected,
    })),
  );

  const lines: NormalizedSaleLine[] = partials.map((partial, index) => {
    const discountAmount = perLine[index];
    return {
      storeProductId: partial.storeProductId,
      quantity: partial.quantity,
      grossAmount: partial.grossAmount,
      costAmount: partial.costAmount,
      discountAmount,
      netAmount: partial.grossAmount - discountAmount,
      grossProfit: partial.grossProfit,
      netProfit: partial.grossProfit - discountAmount,
      dimension: partial.dimension,
    };
  });

  const grossAmount = lines.reduce((acc, line) => acc + line.grossAmount, 0);
  const netProfit = lines.reduce((acc, line) => acc + line.netProfit, 0);

  return {
    id: venta.id,
    soldAt: venta.frontendCreatedAt ?? venta.createdAt,
    closingPeriodId: venta.cierrePeriodoId,
    sellerId: venta.usuarioId,
    collectionCurrency: venta.monedaCobro,
    rates,
    hasRates,
    payments: (venta.pagosDetalle as IPagoLinea[] | null) ?? null,
    fallbackCash: venta.totalcash ?? 0,
    fallbackTransfer: venta.totaltransfer ?? 0,
    fallbackTransferDestinationId: venta.transferDestinationId,
    grossAmount,
    discountTotal,
    // Mirrors the existing dashboard: a ticket never contributes negative revenue.
    netAmount: Math.max(0, grossAmount - discountTotal),
    netProfit,
    lines,
    discountsByRule: perRule,
  };
}
