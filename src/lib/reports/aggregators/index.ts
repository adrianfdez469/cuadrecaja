import { loadProductDimensions, streamNormalizedSales } from "../sales-stream";
import type {
  NormalizedSale,
  ProductDimension,
  SalesStreamOptions,
  SalesStreamStats,
} from "../sales-stream";
import type { ReportScope } from "../scope";

/**
 * Visitor over the sales stream.
 *
 * Loading the sales of a range is the expensive part, so reports are written as
 * aggregators and several of them share a single pass instead of each running
 * its own query.
 */
export interface SalesAggregator<TResult> {
  consume(sale: NormalizedSale): void;
  finalize(context: AggregatorContext): TResult;
}

export type AggregatorContext = {
  scope: ReportScope;
  dimensions: Map<string, ProductDimension>;
  stats: SalesStreamStats;
};

/** Maps a record of aggregators to a record of their finalized results. */
type AggregatorResults<T extends Record<string, SalesAggregator<unknown>>> = {
  [K in keyof T]: T[K] extends SalesAggregator<infer R> ? R : never;
};

/**
 * Runs every aggregator over one pass of the sales stream.
 *
 * Pass `dimensions` when the caller already loaded them (for example to run a
 * second pass over the comparison window) to avoid reloading the catalog.
 */
export async function runAggregators<
  T extends Record<string, SalesAggregator<unknown>>,
>(
  scope: ReportScope,
  aggregators: T,
  options: SalesStreamOptions & {
    dimensions?: Map<string, ProductDimension>;
  } = {},
): Promise<{
  results: AggregatorResults<T>;
  stats: SalesStreamStats;
  dimensions: Map<string, ProductDimension>;
}> {
  const { dimensions: provided, ...streamOptions } = options;
  const dimensions = provided ?? (await loadProductDimensions(scope.tiendaId));
  const entries = Object.values(aggregators);

  const stats = await streamNormalizedSales(
    scope,
    dimensions,
    (sale) => {
      for (const aggregator of entries) aggregator.consume(sale);
    },
    streamOptions,
  );

  const context: AggregatorContext = { scope, dimensions, stats };
  const results = {} as AggregatorResults<T>;

  for (const [key, aggregator] of Object.entries(aggregators)) {
    results[key as keyof T] = aggregator.finalize(
      context,
    ) as AggregatorResults<T>[keyof T];
  }

  return { results, stats, dimensions };
}
