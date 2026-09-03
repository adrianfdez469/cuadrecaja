import type { ITasaSnapshot, ITasaCambio } from "@/schemas/tasaCambio";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { formatNumberWith } from "@/utils/numberFormat";

// CUP is the universal anchor — always 1. Rates are always expressed as "1 X = Y CUP".
const cupTasa = (code: string, tasas: ITasaSnapshot): number =>
  code === "CUP" ? 1 : (tasas[code] ?? 1);

// Tolerance for floating point noise before rounding up to a denomination —
// avoids Math.ceil bumping an exact multiple (e.g. 20.00000000000006) to the next one.
const EPS = 1e-6;

/**
 * Builds a tasa snapshot from the latest TasaCambio records per moneda.
 * CUP is always implicit at 1 and is never stored in the snapshot.
 * All rates are expressed as: 1 <code> = <tasa> CUP.
 */
export function buildTasaSnapshot(
  tasasCambio: Pick<ITasaCambio, "monedaCode" | "tasa" | "createdAt">[],
): ITasaSnapshot {
  const latest: Record<string, { tasa: number; createdAt: Date }> = {};

  for (const t of tasasCambio) {
    if (t.monedaCode === "CUP") continue;
    const prev = latest[t.monedaCode];
    if (!prev || t.createdAt > prev.createdAt) {
      latest[t.monedaCode] = { tasa: t.tasa, createdAt: t.createdAt };
    }
  }

  const snapshot: ITasaSnapshot = {};
  for (const [code, { tasa }] of Object.entries(latest)) {
    snapshot[code] = tasa;
  }
  return snapshot;
}

export type ITasaSnapshotMeta = {
  vigentes: ITasaSnapshot;
  actualizadoEn: string | null;
};

/**
 * Builds vigentes snapshot plus the most recent createdAt among included rates.
 * Filters out non-positive rates for app consumption.
 *
 * The business's own monedaBase is deliberately KEPT: rates are anchored on
 * CUP, not on monedaBase, so `cupTasa(monedaBase)` must be resolvable from the
 * snapshot whenever the base is not CUP. An earlier version dropped it and the
 * mobile app persisted snapshots like `{ EUR: 775 }` for USD-based businesses,
 * which made every CUP/EUR → USD conversion fall back to rate 1.
 */
export function buildTasaSnapshotWithMeta(
  tasasCambio: Pick<ITasaCambio, "monedaCode" | "tasa" | "createdAt">[],
): ITasaSnapshotMeta {
  const latest: Record<string, { tasa: number; createdAt: Date }> = {};

  for (const t of tasasCambio) {
    if (t.monedaCode === "CUP") continue;
    const prev = latest[t.monedaCode];
    if (!prev || t.createdAt > prev.createdAt) {
      latest[t.monedaCode] = { tasa: t.tasa, createdAt: t.createdAt };
    }
  }

  const vigentes: ITasaSnapshot = {};
  let maxCreatedAt: Date | null = null;

  for (const [code, { tasa, createdAt }] of Object.entries(latest)) {
    if (tasa <= 0) continue;
    vigentes[code] = tasa;
    if (!maxCreatedAt || createdAt > maxCreatedAt) {
      maxCreatedAt = createdAt;
    }
  }

  return {
    vigentes,
    actualizadoEn: maxCreatedAt?.toISOString() ?? null,
  };
}

/**
 * Rates in force at a given moment: for each moneda, the most recent record
 * whose createdAt is <= momento. `history` must be sorted ascending by
 * createdAt (the last assignment wins). CUP is never included.
 */
export function buildTasaSnapshotAt(
  history: Pick<ITasaCambio, "monedaCode" | "tasa" | "createdAt">[],
  momento: Date,
): ITasaSnapshot {
  const snapshot: ITasaSnapshot = {};
  for (const t of history) {
    if (t.monedaCode === "CUP" || t.createdAt > momento) continue;
    snapshot[t.monedaCode] = t.tasa;
  }
  return snapshot;
}

/**
 * Fills the gaps of a client-provided snapshot with fallback snapshots.
 * Precedence is left to right: the client's own rates always win (they are
 * the rates the customer was actually charged with), then each fallback only
 * contributes the monedas still missing. Non-positive rates are ignored.
 */
export function completeTasaSnapshot(
  client: ITasaSnapshot | null | undefined,
  ...fallbacks: ITasaSnapshot[]
): ITasaSnapshot {
  const result: ITasaSnapshot = {};
  const layers = [client ?? {}, ...fallbacks];
  for (const layer of layers) {
    for (const [code, tasa] of Object.entries(layer)) {
      if (code === "CUP" || !(tasa > 0) || code in result) continue;
      result[code] = tasa;
    }
  }
  return result;
}

/**
 * Monedas whose rate is required to value a sale but absent from `snapshot`.
 *
 * A rate is required for every non-CUP moneda that takes part in a conversion:
 * the monedas of the payment/change lines that differ from monedaBase, plus
 * monedaBase itself (the conversion routes through CUP, so the base's own
 * CUP rate is needed too). A sale settled entirely in monedaBase needs no
 * rate at all, even when the base is not CUP.
 */
export function missingRateCodes(
  snapshot: ITasaSnapshot,
  monedaBase: string,
  monedas: string[],
): string[] {
  const foreign = monedas.filter((m) => m !== monedaBase);
  if (foreign.length === 0) return [];

  const required = new Set<string>([monedaBase, ...foreign]);
  required.delete("CUP");

  return [...required].filter((code) => !(snapshot[code] > 0));
}

/**
 * Converts monto in moneda → monedaBase, routing through CUP as the anchor.
 * Default monedaBase = 'CUP' (pure CUP conversion).
 */
export function convertToBase(
  monto: number,
  moneda: string,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  return (monto * cupTasa(moneda, tasas)) / cupTasa(monedaBase, tasas);
}

/**
 * Converts montoBase in monedaBase → moneda, routing through CUP as the anchor.
 * Default monedaBase = 'CUP'.
 */
export function convertFromBase(
  montoBase: number,
  moneda: string,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  const tasa = cupTasa(moneda, tasas);
  if (tasa === 0) return 0;
  return (montoBase * cupTasa(monedaBase, tasas)) / tasa;
}

/**
 * Rounds an amount expressed in `monedaBase` to the anchor's (CUP) cent grid.
 *
 * Base-currency arithmetic must never be quantized to the base's own cents:
 * with a coarse base (1 USD = 670 CUP) one base cent is worth 6.7 CUP, so
 * rounding a 500-CUP sale to 0.75 USD invents 2.5 CUP out of thin air — and
 * every derived number (pending, change, suggestions) inherits the error.
 * Quantizing on the anchor keeps full precision for any base: when the base
 * IS the anchor this is a plain round-to-cents.
 */
export function roundBaseToAnchorCents(
  monto: number,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  const rate = cupTasa(monedaBase, tasas);
  if (rate === 0) return monto;
  return Math.round(monto * rate * 100) / 100 / rate;
}

/**
 * A base-currency amount in whole anchor (CUP) cents, for float-safe money
 * comparisons at the finest granularity the business handles.
 */
export function anchorCents(
  monto: number,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  return Math.round(monto * cupTasa(monedaBase, tasas) * 100);
}

/**
 * Calculates change distribution across currencies.
 * All arithmetic routes through CUP anchor.
 */
export function calcularVuelto(
  totalBase: number,
  pagos: IPagoLinea[],
  monedaCobro: string,
  monedaBase: string,
  tasas: ITasaSnapshot,
  denominaciones: Record<string, number[]>,
): IVueltoLinea[] {
  const totalPagadoBase = pagos.reduce(
    (sum, p) => sum + convertToBase(p.monto, p.moneda, tasas, monedaBase),
    0,
  );
  const vueltoTotalBase = totalPagadoBase - totalBase;
  if (vueltoTotalBase < 0.0001) return [];

  const result: IVueltoLinea[] = [];

  if (monedaCobro !== monedaBase) {
    const vueltoEnMonedaCobroRaw = convertFromBase(
      vueltoTotalBase,
      monedaCobro,
      tasas,
      monedaBase,
    );
    const denomsOrdenadas = (denominaciones[monedaCobro] ?? [])
      .slice()
      .sort((a, b) => b - a);
    const denomMin = denomsOrdenadas.at(-1) ?? 1;
    // Redondear el vuelto en monedaCobro hacia ABAJO a su denominación
    // disponible — nunca hacia arriba, porque monedaCobro suele ser la
    // moneda de denominación más gruesa (ej. USD con mínimo 0.1) y
    // redondear hacia arriba ahí puede sobrepasar el vuelto total adeudado.
    // El resto exacto se cubre justo abajo en monedaBase, cuya denominación
    // mínima es más fina (ej. CUP con mínimo 0.01) y sí se redondea hacia
    // arriba para no dar de menos.
    const vueltoEnMonedaCobro =
      Math.floor((vueltoEnMonedaCobroRaw + EPS) / denomMin) * denomMin;

    if (vueltoEnMonedaCobro > 0) {
      result.push({ moneda: monedaCobro, monto: vueltoEnMonedaCobro });
    }

    const restoBase =
      vueltoTotalBase -
      convertToBase(vueltoEnMonedaCobro, monedaCobro, tasas, monedaBase);

    if (restoBase > 0.0001) {
      const denomsBase = (denominaciones[monedaBase] ?? [])
        .slice()
        .sort((a, b) => b - a);
      const denomMinBase = denomsBase.at(-1) ?? 1;
      const vueltoEnBase =
        Math.ceil((restoBase - EPS) / denomMinBase) * denomMinBase;
      result.push({ moneda: monedaBase, monto: vueltoEnBase });
    }
  } else {
    const denomsBase = (denominaciones[monedaBase] ?? [])
      .slice()
      .sort((a, b) => b - a);
    const denomMinBase = denomsBase.at(-1) ?? 1;
    // Un vuelto por debajo de la denominación mínima no se puede entregar
    // — se absorbe como error de redondeo en vez de redondearlo hacia
    // arriba a una denominación completa.
    if (vueltoTotalBase >= denomMinBase - EPS) {
      const vueltoEnBase =
        Math.ceil((vueltoTotalBase - EPS) / denomMinBase) * denomMinBase;
      if (vueltoEnBase > 0) {
        result.push({ moneda: monedaBase, monto: vueltoEnBase });
      }
    }
  }

  return result;
}

/**
 * Formats a monetary amount with its currency symbol.
 * Falls back to the currency code if no symbol is provided.
 */
export function formatMoneda(
  monto: number,
  simbolo: string,
  decimales = 2,
): string {
  return `${simbolo}${formatNumberWith(monto, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/**
 * True si la venta no tiene pagos registrados o tiene exactamente un pago
 * (una sola moneda y una sola forma de pago: efectivo O transferencia, no ambas).
 * Se usa para permitir/bloquear la eliminación de un producto individual de
 * una venta ya pagada: con más de un pago no hay forma de saber de cuál
 * descontar el monto del producto eliminado, así que directamente no se
 * reparte nada — se ajusta el único pago existente.
 */
export function pagadaConUnSoloPago(
  pagosDetalle?: Pick<IPagoLinea, "moneda">[] | null,
): boolean {
  return (pagosDetalle?.length ?? 0) <= 1;
}
