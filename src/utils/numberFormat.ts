/**
 * Cached `Intl.NumberFormat` instances.
 *
 * `Number.prototype.toLocaleString(locale, options)` builds a brand new
 * formatter on every call, which is roughly fifty times more expensive than
 * formatting through one that already exists. The POS formats hundreds of
 * amounts per render of the product grid — one per card, more when the
 * currency equivalents are on — so the construction cost, not the formatting,
 * was what showed up in the profile.
 *
 * Caching is safe: an `Intl.NumberFormat` is immutable and stateless.
 */

/** Locale used across the app. Kept here so the cache key is complete. */
export const LOCALE = "es-ES";

const formatterCache = new Map<string, Intl.NumberFormat>();

function cacheKey(locale: string, options?: Intl.NumberFormatOptions): string {
  if (!options) return locale;
  return [
    locale,
    options.style ?? "",
    options.currency ?? "",
    options.minimumFractionDigits ?? "",
    options.maximumFractionDigits ?? "",
    options.useGrouping ?? "",
  ].join("|");
}

/**
 * A formatter for `locale`/`options`, built once and reused afterwards.
 *
 * Only the options that appear in the cache key are honoured — that covers
 * every call site in this codebase. Passing anything else would silently share
 * a formatter across different option sets, so extend `cacheKey` first.
 */
export function getNumberFormat(
  locale: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Drop-in replacement for `value.toLocaleString(locale, options)`. */
export function formatNumberWith(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string = LOCALE,
): string {
  return getNumberFormat(locale, options).format(value);
}

/**
 * The app's default money shape: exactly two decimals, no currency symbol.
 * By far the most common formatting call, and the one in the POS hot path.
 */
export function formatAmount(value: number, locale: string = LOCALE): string {
  return getNumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
