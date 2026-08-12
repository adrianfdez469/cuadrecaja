import { convertToBase } from "@/lib/currency";
import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

export type PaymentMixRow = {
  /** "cash" | "transfer" */
  tipo: string;
  moneda: string;
  /** Amount in the original currency — what was physically taken in. */
  montoOriginal: number;
  /** Same amount expressed in base currency. */
  montoBase: number;
  transacciones: number;
  participacionPorcentaje: number;
  /** True when reconstructed from legacy totalcash/totaltransfer fields. */
  estimado: boolean;
};

export type TransferDestinationRow = {
  transferDestinationId: string | null;
  nombre: string;
  montoBase: number;
  transacciones: number;
};

export type PaymentMixResult = {
  rows: PaymentMixRow[];
  destinos: TransferDestinationRow[];
  totalBase: number;
  /** Sales with no pagosDetalle, reconstructed from the legacy columns. */
  ventasEstimadas: number;
};

type Accumulator = Omit<PaymentMixRow, "participacionPorcentaje">;

/**
 * Payment-method and currency mix.
 *
 * Sales recorded before multi-currency have no `pagosDetalle`, so they are
 * reconstructed from `totalcash`/`totaltransfer` under the sale's collection
 * currency and flagged as estimated — dropping them would silently understate
 * the totals.
 */
export function createPaymentMixAggregator(
  baseCurrency: string,
): SalesAggregator<PaymentMixResult> {
  const rows = new Map<string, Accumulator>();
  const destinos = new Map<string, TransferDestinationRow>();
  let ventasEstimadas = 0;

  const add = (
    tipo: string,
    moneda: string,
    montoOriginal: number,
    montoBase: number,
    estimado: boolean,
  ) => {
    if (montoOriginal <= 0) return;
    const key = `${tipo}::${moneda}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        tipo,
        moneda,
        montoOriginal: 0,
        montoBase: 0,
        transacciones: 0,
        estimado: false,
      };
      rows.set(key, row);
    }
    row.montoOriginal += montoOriginal;
    row.montoBase += montoBase;
    row.transacciones += 1;
    // A bucket is flagged estimated if any sale in it needed reconstruction.
    if (estimado) row.estimado = true;
  };

  const addDestino = (id: string | null, montoBase: number) => {
    if (montoBase <= 0) return;
    const key = id ?? "__sin_destino__";
    let destino = destinos.get(key);
    if (!destino) {
      destino = {
        transferDestinationId: id,
        nombre: id ?? "Sin destino asignado",
        montoBase: 0,
        transacciones: 0,
      };
      destinos.set(key, destino);
    }
    destino.montoBase += montoBase;
    destino.transacciones += 1;
  };

  return {
    consume(sale: NormalizedSale) {
      if (sale.payments && sale.payments.length > 0) {
        for (const payment of sale.payments) {
          add(
            payment.tipo,
            payment.moneda,
            payment.monto,
            payment.equivalenteBase ?? 0,
            false,
          );
          if (payment.tipo === "transfer") {
            addDestino(
              payment.transferDestinationId ?? null,
              payment.equivalenteBase ?? 0,
            );
          }
        }
        return;
      }

      // Legacy sale: rebuild the split from the flat columns.
      ventasEstimadas += 1;
      const moneda = sale.collectionCurrency;
      const toBase = (amount: number) =>
        convertToBase(amount, moneda, sale.rates, baseCurrency);

      add("cash", moneda, sale.fallbackCash, toBase(sale.fallbackCash), true);
      add(
        "transfer",
        moneda,
        sale.fallbackTransfer,
        toBase(sale.fallbackTransfer),
        true,
      );
      addDestino(
        sale.fallbackTransferDestinationId,
        toBase(sale.fallbackTransfer),
      );
    },
    finalize() {
      const list = Array.from(rows.values());
      const totalBase = list.reduce((acc, row) => acc + row.montoBase, 0);

      const withShare: PaymentMixRow[] = list.map((row) => ({
        ...row,
        participacionPorcentaje:
          totalBase > 0 ? (row.montoBase / totalBase) * 100 : 0,
      }));

      return {
        rows: withShare.sort((a, b) => b.montoBase - a.montoBase),
        destinos: Array.from(destinos.values()).sort(
          (a, b) => b.montoBase - a.montoBase,
        ),
        totalBase,
        ventasEstimadas,
      };
    },
  };
}
