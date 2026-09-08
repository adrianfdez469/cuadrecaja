/**
 * Currency-option helpers shared by every screen that lets the user pick a
 * currency.
 *
 * The reason this exists: `NegocioMoneda` only stores the EXTRA currencies a
 * business enabled — the base currency (`Negocio.monedaBase`) has no row there.
 * Every consumer that shows a currency list has to add it back, and each one
 * that forgot ended up hiding the field entirely (a business with base CUP and
 * only USD enabled reads as "one currency, nothing to choose").
 */

/** The shape every currency list needs — a subset of `INegocioMoneda`. */
export interface MonedaOption {
  monedaCode: string;
  admiteEfectivo?: boolean;
  moneda?: { nombre: string; simbolo: string };
}

/**
 * The currencies a user may pick, base first.
 *
 * The base currency leads the list because it is the default, and it keeps its
 * `NegocioMoneda` row when one exists so its name and symbol survive.
 */
export function buildMonedaOptions<T extends MonedaOption>(
  monedasNegocio: T[] | undefined | null,
  monedaBase: string | undefined | null,
): (T | MonedaOption)[] {
  const monedas = monedasNegocio ?? [];
  if (!monedaBase) return monedas;

  const baseRow = monedas.find((m) => m.monedaCode === monedaBase);
  const extras = monedas.filter((m) => m.monedaCode !== monedaBase);

  return [
    baseRow ?? { monedaCode: monedaBase, admiteEfectivo: true },
    ...extras,
  ];
}

/**
 * Symbol to prefix an amount with, or `"$"` when the currency has no row of its
 * own — which is the base currency's normal state, and what `formatCurrency`
 * already prints for it.
 */
export function monedaSimbolo(
  options: MonedaOption[],
  monedaCode: string | undefined | null,
): string {
  return (
    options.find((m) => m.monedaCode === monedaCode)?.moneda?.simbolo ?? "$"
  );
}
