"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useAppContext } from "@/context/AppContext";
import { useCartStore } from "@/store/cartStore";
import { useCartTotals } from "@/store/useCartTotals";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { useMonedasAlternativas } from "@/components/MultiCurrencyAmount/useMonedasAlternativas";
import { CheckoutTopBar } from "@/app/pos/components/checkout/CheckoutTopBar";
import { CheckoutSummaryHeader } from "@/app/pos/components/checkout/CheckoutSummaryHeader";
import { CheckoutPayBar } from "@/app/pos/components/checkout/CheckoutPayBar";
import {
  PaymentMethodBody,
  type PaymentMethod,
} from "@/app/pos/components/checkout/PaymentMethodBody";
import { PaymentLineBody } from "@/app/pos/components/checkout/PaymentLineBody";
import {
  MixedPaymentBody,
  type MixedLine,
} from "@/app/pos/components/checkout/MixedPaymentBody";
import {
  AddPaymentSheet,
  type PaymentOption,
} from "@/app/pos/components/checkout/AddPaymentSheet";
import { ChangeSheet } from "@/app/pos/components/checkout/ChangeSheet";
import { TipSheet } from "@/app/pos/components/checkout/TipSheet";
import { usePaymentLines } from "@/app/pos/components/checkout/usePaymentLines";
import { useChangeDistribution } from "@/app/pos/components/checkout/useChangeDistribution";
import {
  changeBase,
  hasMissingTransferDestination,
  isMissing,
  paidBase,
  pendingInCurrency,
  toPagoLineas,
} from "@/app/pos/utils/paymentMath";
import type { PaymentLine, PaymentLineKind } from "@/app/pos/utils/paymentMath";
import { CUSTOM_CHANGE_ID, toVueltoLineas } from "@/app/pos/utils/changeMath";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import {
  tipLinesFromAmounts,
  tipLinesFromChange,
  tipTotalBase,
  tipTotalFromAmounts,
  type TipAmounts,
} from "@/app/pos/utils/tipMath";
import {
  convertFromBase,
  convertToBase,
  roundBaseToAnchorCents,
} from "@/lib/currency";
import { DENOMINACIONES } from "@/constants/billDenominations";
import { formatChangeSplit, formatMontoEnMoneda } from "@/utils/formatters";
import { formatAmount } from "@/utils/numberFormat";
import type { SaleReceipt } from "@/app/pos/components/checkout/saleReceipt";
import type { IMultimonedaExtras, IPagoLinea } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface CheckoutViewProps {
  finalTotal: number;
  discountTotal: number;
  /**
   * The codes actually in force on this cart — the same ones the preview
   * priced. It used to be the raw input draft, so a code typed and never
   * applied still travelled to the server while the total on screen ignored it.
   */
  discountCodes: string[];
  transferDestinations: ITransferDestination[];
  tiendaId: string;
  cierreId: string;
  itemCount: number;
  onBack: () => void;
  makePay: (
    total: number,
    totalcash: number,
    totaltransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => Promise<void>;
  /** The sale is saved: the «Cobro registrado» screen takes over. */
  onSaleComplete: (receipt: SaleReceipt) => void;
  /** Saving it failed, after the screen above was already shown. */
  onSaleFailed: () => void;
}

/**
 * Where the screen is, in the redesign's own states.
 *
 * «pick» is the entrance: nothing chosen, the tiles ask. «line» is one form
 * of payment being counted — the whole payment when it was picked from the
 * tiles, or one of several when it was opened from the mixed list, which is
 * what `from` remembers so «←» goes back to the right place. «mixed» is the
 * list of everything taken so far and what is still missing.
 */
type CheckoutMode =
  | { kind: "pick" }
  | { kind: "line"; lineId: string; from: "pick" | "mixed" }
  | { kind: "mixed" };

const PICK_MODE: CheckoutMode = { kind: "pick" };
const MIXED_MODE: CheckoutMode = { kind: "mixed" };

/** A currency with no bills configured. Stable so memos keyed on it settle. */
const EMPTY_DENOMINATIONS: number[] = [];

const ROOT_SX = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
} as const;

const BODY_SX = { flex: 1, minHeight: 0, overflowY: "auto" } as const;

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

const methodTitle = (kind: PaymentLineKind, currency: string) =>
  `${kind === "cash" ? "Efectivo" : "Transferencia"} ${currency}`;

const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export function CheckoutView({
  finalTotal,
  discountTotal,
  discountCodes,
  transferDestinations,
  tiendaId,
  cierreId,
  itemCount,
  onBack,
  makePay,
  onSaleComplete,
  onSaleFailed,
}: CheckoutViewProps) {
  const { user, monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { unitCount } = useCartTotals();
  const cartName = useCartStore(
    (state) => state.carts.find((c) => c.id === state.activeCartId)?.name,
  );
  const storeStatus = useStoreStatus();
  const { monedasAlternativas, convertToMoneda } = useMonedasAlternativas();

  const [mode, setMode] = useState<CheckoutMode>(PICK_MODE);

  /**
   * Tip taken from the change the cashier was about to hand back. Stored as
   * the already-resolved split rather than an amount, because committing it
   * makes the change zero — recomputing it afterwards would find nothing.
   * The signature is the payment state it was captured against; editing the
   * payment invalidates it (see the effect below) so a stale tip can never
   * outlive the overpayment that backed it.
   */
  const [tipFromChange, setTipFromChange] = useState<{
    signature: string;
    detail: IPagoLinea[];
  } | null>(null);
  /**
   * Tip typed per currency, each amount in its own currency. Not a single
   * base-currency number: the tip need not be in the currency the sale was
   * paid with, and it can be split across several.
   */
  const [explicitTip, setExplicitTip] = useState<TipAmounts>({});

  const tipTotal = useMemo(
    () =>
      tipFromChange
        ? tipTotalBase(tipFromChange.detail, tasasVigentes, monedaBase)
        : tipTotalFromAmounts(explicitTip, tasasVigentes, monedaBase),
    [tipFromChange, explicitTip, tasasVigentes, monedaBase],
  );

  // What the customer actually has to cover. Everything downstream — the
  // tiles, «falta», the change — is measured against this, never against
  // finalTotal, which is the business's share alone. Quantized on the
  // anchor's cents, NOT the base's: with a USD base a base cent is worth
  // several CUP, and rounding a 500-CUP sale to 0.75 USD would corrupt every
  // pending/change figure derived from it (503 CUP asked, 168 CUP change).
  const amountDue = useMemo(
    () =>
      roundBaseToAnchorCents(finalTotal + tipTotal, tasasVigentes, monedaBase),
    [finalTotal, tipTotal, tasasVigentes, monedaBase],
  );

  const monedasActivas = useMemo(
    () => monedasNegocio.filter((m) => m.activo),
    [monedasNegocio],
  );

  const denominationsByCurrency = useMemo(() => {
    const byCurrency = new Map<string, number[]>();
    for (const info of monedasActivas) {
      const values = (info?.moneda?.denominaciones ?? [])
        .filter((d) => d.activo)
        .map((d) => d.valor)
        .sort((a, b) => b - a);
      byCurrency.set(info.monedaCode, values);
    }
    return byCurrency;
  }, [monedasActivas]);

  // CUP keeps a static fallback so the base currency always has bills.
  const cupFallback = useMemo(
    () => [...DENOMINACIONES.CUP].sort((a, b) => b - a),
    [],
  );

  const denominationsFor = useCallback(
    (currency: string): number[] => {
      const values = denominationsByCurrency.get(currency);
      if (values && values.length > 0) return values;
      return currency === "CUP" ? cupFallback : EMPTY_DENOMINATIONS;
    },
    [denominationsByCurrency, cupFallback],
  );

  const { lines, addLine, replaceLines, updateLine, removeLine } =
    usePaymentLines({
      defaultTransferDestId: defaultDestId(transferDestinations),
    });

  // The three figures the bar lives on. Each walks every payment line and
  // converts currencies, so they are memoized — on the keypad this is
  // recomputed on every digit.
  const paid = useMemo(
    () => paidBase(lines, tasasVigentes, monedaBase),
    [lines, tasasVigentes, monedaBase],
  );
  const missing = useMemo(
    () =>
      amountDue === 0
        ? false
        : isMissing(paid, amountDue, tasasVigentes, monedaBase),
    [paid, amountDue, tasasVigentes, monedaBase],
  );
  const missingAmount = Math.max(0, amountDue - paid);
  const change = useMemo(
    () => changeBase(paid, amountDue, tasasVigentes, monedaBase),
    [paid, amountDue, tasasVigentes, monedaBase],
  );

  /** The payment state a committed tip was captured against. */
  const linesSignature = useMemo(
    () =>
      lines
        .map(
          (line) =>
            `${line.kind}:${line.currency}:${line.amount}:${line.transferDestinationId ?? ""}`,
        )
        .join("|"),
    [lines],
  );

  // Editing the payment after leaving the change as a tip drops the tip
  // rather than carrying it onto an overpayment that may no longer exist.
  useEffect(() => {
    if (tipFromChange && tipFromChange.signature !== linesSignature) {
      setTipFromChange(null);
    }
  }, [linesSignature, tipFromChange]);

  const allCurrencies = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

  const {
    options,
    unavailableIds,
    selectedId,
    select,
    distribution,
    errors,
    overshootBase,
    hasErrors,
    custom,
  } = useChangeDistribution({
    lines,
    changeAmountBase: change,
    missing,
    rates: tasasVigentes,
    base: monedaBase,
    currencies: allCurrencies,
    denominationsFor,
    tiendaId,
    cierreId,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  // The exit transition keeps this view mounted for ~200 ms after a sale is
  // submitted; without this guard a second tap would send a second sale.
  const [submitting, setSubmitting] = useState(false);
  // The ref is the actual guard — state updates are asynchronous, so two taps
  // landing in the same tick would both read `submitting === false` and both
  // submit. Ghost double-fire is a real failure mode on POS touch hardware and
  // the cost is a duplicate sale. The state flag only drives `disabled`.
  const submittingRef = useRef(false);

  /** What a currency is allowed to be paid with, per the business setup. */
  const supportFor = useCallback(
    (currency: string) => {
      const isBase = currency === monedaBase;
      const info = monedasActivas.find((m) => m.monedaCode === currency);
      return {
        allowsCash: isBase || (info?.admiteEfectivo ?? true),
        allowsTransfer: isBase || (info?.admiteTransferencia ?? false),
      };
    },
    [monedaBase, monedasActivas],
  );

  /**
   * The forms of payment still open, given what has been taken: cash and
   * transfer for every currency that admits them and has no line of that
   * kind yet, each with what it would have to cover in its own currency.
   */
  const optionsGiven = useCallback(
    (taken: PaymentLine[]): PaymentOption[] => {
      const result: PaymentOption[] = [];
      for (const currency of allCurrencies) {
        const { allowsCash, allowsTransfer } = supportFor(currency);
        const pending = pendingInCurrency(
          taken,
          amountDue,
          currency,
          tasasVigentes,
          monedaBase,
        );
        const has = (kind: PaymentLineKind) =>
          taken.some(
            (line) => line.kind === kind && line.currency === currency,
          );
        if (allowsCash && !has("cash")) {
          result.push({
            kind: "cash",
            currency,
            suggested: suggestedAmounts(pending, denominationsFor(currency))
              .exact,
          });
        }
        if (allowsTransfer && !has("transfer")) {
          result.push({ kind: "transfer", currency, suggested: pending });
        }
      }
      return result;
    },
    [
      allCurrencies,
      supportFor,
      amountDue,
      tasasVigentes,
      monedaBase,
      denominationsFor,
    ],
  );

  const NO_LINES = useMemo<PaymentLine[]>(() => [], []);
  const methods = useMemo<PaymentMethod[]>(() => {
    const single = optionsGiven(NO_LINES).map<PaymentMethod>((option) => ({
      kind: option.kind,
      currency: option.currency,
      title: methodTitle(option.kind, option.currency),
      hint: formatMontoEnMoneda(option.suggested, option.currency),
    }));
    return single.length > 1
      ? [
          ...single,
          { kind: "mixed", title: "Pago mixto", hint: "Dos o más formas" },
        ]
      : single;
  }, [optionsGiven, NO_LINES]);

  const paymentOptions = useMemo(
    () => optionsGiven(lines),
    [optionsGiven, lines],
  );

  const firstError = useMemo(
    () => Object.values(errors).find((error) => error !== null) ?? null,
    [errors],
  );

  // A business with no transfer destinations configured must still be able to
  // sell — the line simply carries none (spec §6). Only demand a destination
  // when there is one to pick.
  const needsTransferDestination =
    transferDestinations.length > 0 && hasMissingTransferDestination(lines);

  const canSell =
    mode.kind !== "pick" &&
    !submitting &&
    // Spec section 5.7: never submit against an empty basket. Without this a
    // post-sale remount lands on amountDue === 0 with a fresh submit ref and
    // re-enables the button.
    itemCount > 0 &&
    lines.length > 0 &&
    (amountDue === 0 || !missing) &&
    !needsTransferDestination &&
    !hasErrors;

  /**
   * The arithmetic behind the amount, spelled out — only when there is
   * arithmetic to show. With it the cashier can explain the figure to the
   * customer without opening anything.
   */
  const breakdown = useMemo(() => {
    if (discountTotal <= 0 && tipTotal <= 0) return undefined;
    const parts = [formatAmount(finalTotal + discountTotal)];
    if (discountTotal > 0) {
      parts.push(`− ${formatAmount(discountTotal)} descuento`);
    }
    if (tipTotal > 0) parts.push(`+ ${formatAmount(tipTotal)} propina`);
    return parts.join(" ");
  }, [finalTotal, discountTotal, tipTotal]);

  /** «≈ 2.893.000,00 CUP» for every other currency of the business. */
  const conversionsOf = useCallback(
    (amountBase: number, except?: string) =>
      monedasAlternativas
        .filter((m) => m.monedaCode !== except)
        .map(
          (m) =>
            `≈ ${formatMontoEnMoneda(convertToMoneda(amountBase, m.monedaCode), m.monedaCode)}`,
        ),
    [monedasAlternativas, convertToMoneda],
  );

  const inCurrency = useCallback(
    (amountBase: number, currency: string) =>
      currency === monedaBase
        ? amountBase
        : convertFromBase(amountBase, currency, tasasVigentes, monedaBase),
    [monedaBase, tasasVigentes],
  );

  const unitsLabel = `${countLabel(itemCount, "producto", "productos")} · ${countLabel(unitCount, "unidad", "unidades")}`;
  const adjustmentsLabel =
    discountTotal > 0 || tipTotal > 0
      ? [
          discountTotal > 0 ? `Descuento ${formatAmount(discountTotal)}` : null,
          tipTotal > 0 ? `propina ${formatAmount(tipTotal)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  // ─── Navigation ───────────────────────────────────────────────────────────

  const pickMethod = (method: PaymentMethod) => {
    if (method.kind === "mixed") {
      setMode(MIXED_MODE);
      return;
    }
    const currency = method.currency ?? monedaBase;
    const pending = pendingInCurrency(
      NO_LINES,
      amountDue,
      currency,
      tasasVigentes,
      monedaBase,
    );
    const amount =
      method.kind === "cash"
        ? suggestedAmounts(pending, denominationsFor(currency)).exact
        : pending;
    const [id] = replaceLines([{ kind: method.kind, currency, amount }]);
    setMode({ kind: "line", lineId: id, from: "pick" });
  };

  const goBack = () => {
    if (mode.kind === "pick") onBack();
    else if (mode.kind === "line") {
      setMode(mode.from === "mixed" ? MIXED_MODE : PICK_MODE);
    } else setMode(PICK_MODE);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSell = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const pagosDetalle = toPagoLineas(lines, tasasVigentes, monedaBase);
    const vueltoDetalle = toVueltoLineas(distribution);

    // Where the tip sits, by currency and method. The split kept from the
    // change is exact by construction; an explicit tip has to be attributed
    // to the payments actually taken.
    const tipDetail = tipFromChange
      ? tipFromChange.detail
      : tipLinesFromAmounts(explicitTip, lines, tasasVigentes, monedaBase);

    const sumBase = (source: IPagoLinea[], kind: "cash" | "transfer") =>
      source
        .filter((p) => p.tipo === kind)
        .reduce((sum, p) => sum + p.equivalenteBase, 0);

    // The aggregates stand for the sale's own money, so the tip comes out of
    // them — `Venta.totalcash + totaltransfer` must still add up to `total`,
    // and a tip settled by transfer would otherwise push totaltransfer past
    // it. The untouched `pagosDetalle` keeps the full amount handed over, so
    // the drawer is unaffected.
    const totalCashBase =
      sumBase(pagosDetalle, "cash") - sumBase(tipDetail, "cash");
    const totalTransferBase =
      sumBase(pagosDetalle, "transfer") - sumBase(tipDetail, "transfer");
    const firstTransferDestId = pagosDetalle.find(
      (p) => p.tipo === "transfer",
    )?.transferDestinationId;

    const multimoneda: IMultimonedaExtras = {
      monedaCobro: monedaBase,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot: tasasVigentes,
      ...(discountTotal > 0 ? { discountTotal } : {}),
      ...(tipTotal > 0 ? { tipTotal, tipDetail } : {}),
    };

    // The parent moves on to «Cobro registrado» and remounts this view for
    // the next sale, so nothing here needs resetting. The receipt is captured
    // now, before the basket is cleared under it.
    onSaleComplete({
      amountBase: amountDue,
      base: monedaBase,
      tipTotalBase: tipTotal,
      change: distribution,
      lines,
      confirmedAt: Date.now(),
    });

    // The sale's own total, never amountDue: the tip is not revenue and must
    // not reach `Venta.total`.
    await makePay(
      finalTotal,
      totalCashBase,
      totalTransferBase,
      firstTransferDestId,
      discountCodes,
      multimoneda,
    ).catch((error) => {
      console.error("Error pago:", error);
      onSaleFailed();
    });
  };

  // ─── The change block, shared by the line and mixed screens ──────────────

  const changeBlock =
    !missing && change > 0
      ? {
          changeAmountBase: change,
          distribution,
          options,
          selectedId,
          unavailableIds,
          onSelect: select,
          customAvailable: custom.currencies.length > 0,
          onOpenCustom: () => {
            select(CUSTOM_CHANGE_ID);
            setChangeOpen(true);
          },
          base: monedaBase,
          error: firstError,
          overshootBase,
          tipAmount: tipTotal,
          onLeaveTip: () => {
            setExplicitTip({});
            setTipFromChange({
              signature: linesSignature,
              // The split already chosen and checked against the drawer: the
              // currency kept is the currency that was about to leave it.
              detail: tipLinesFromChange(
                distribution,
                tasasVigentes,
                monedaBase,
              ),
            });
          },
          onOpenTip: () => setTipOpen(true),
          onClearTip:
            tipTotal > 0
              ? () => {
                  setTipFromChange(null);
                  setExplicitTip({});
                }
              : undefined,
        }
      : null;

  // ─── The screen, per mode ─────────────────────────────────────────────────

  const editingLine =
    mode.kind === "line"
      ? (lines.find((line) => line.id === mode.lineId) ?? null)
      : null;

  // A line opened from the mixed list answers for its share, not for the
  // whole sale: what it has to cover is what the other lines leave.
  const lineTarget =
    editingLine && mode.kind === "line"
      ? mode.from === "mixed"
        ? convertToBase(
            pendingInCurrency(
              lines,
              amountDue,
              editingLine.currency,
              tasasVigentes,
              monedaBase,
              editingLine.id,
            ),
            editingLine.currency,
            tasasVigentes,
            monedaBase,
          )
        : amountDue
      : amountDue;

  const lineSuggestions = editingLine
    ? suggestedAmounts(
        inCurrency(lineTarget, editingLine.currency),
        denominationsFor(editingLine.currency),
      )
    : null;

  const storeSubtitle = [user?.localActual?.nombre, storeStatus]
    .filter(Boolean)
    .join(" · ");

  let topBar: { title: string; subtitle?: string };
  let summary: {
    label: string;
    detail?: string;
    amount: number;
    currency: string;
    conversions: string[];
    breakdown?: string;
  };
  let payBar: {
    status: string;
    detail?: string;
    amount: number;
    currency: string;
    codeSuffix?: string;
    conversions?: string[];
  };

  if (editingLine && mode.kind === "line") {
    const { currency, kind } = editingLine;
    const isBase = currency === monedaBase;
    const title = methodTitle(kind, currency);
    const rate = convertFromBase(1, currency, tasasVigentes, monedaBase);
    const figure = inCurrency(lineTarget, currency);
    const equivalences = isBase
      ? conversionsOf(lineTarget)
      : [
          `= ${formatMontoEnMoneda(lineTarget, monedaBase)}`,
          ...conversionsOf(lineTarget, currency),
        ];
    topBar = {
      title,
      subtitle: `${cartName ?? "Cuenta"} · ${formatMontoEnMoneda(amountDue, monedaBase)}`,
    };
    summary = {
      label:
        mode.from === "mixed"
          ? `Por cubrir en ${currency}`
          : isBase
            ? "A cobrar"
            : `A cobrar en ${currency}`,
      detail: isBase ? unitsLabel : `Tasa ${formatAmount(rate)}`,
      amount: figure,
      currency,
      conversions: equivalences,
      breakdown: mode.from === "mixed" ? undefined : breakdown,
    };
    payBar = {
      status: `${title} · recibido ${formatAmount(editingLine.amount)}`,
      detail: missing
        ? `Falta ${formatMontoEnMoneda(missingAmount, monedaBase)}`
        : change > 0
          ? `Vuelto ${formatChangeSplit(distribution) || formatMontoEnMoneda(change, monedaBase)}`
          : "Pago exacto",
      amount: figure,
      currency,
      conversions: isBase
        ? undefined
        : [`= ${formatMontoEnMoneda(lineTarget, monedaBase)}`],
    };
  } else if (mode.kind === "mixed") {
    const formsLabel = countLabel(
      lines.length,
      "forma de pago",
      "formas de pago",
    );
    topBar = {
      title: "Pago mixto",
      subtitle: `${cartName ?? "Cuenta"} · ${formsLabel}`,
    };
    summary = {
      label: "A cobrar",
      detail: adjustmentsLabel ?? unitsLabel,
      amount: amountDue,
      currency: monedaBase,
      conversions: conversionsOf(amountDue),
      breakdown,
    };
    payBar = missing
      ? {
          status: `Cubierto ${formatAmount(paid)} de ${formatAmount(amountDue)}`,
          detail: formsLabel,
          amount: missingAmount,
          currency: monedaBase,
          codeSuffix: "por cubrir",
        }
      : {
          status: "Total a cobrar",
          detail: formsLabel,
          amount: amountDue,
          currency: monedaBase,
          conversions: conversionsOf(amountDue),
        };
  } else {
    topBar = {
      title: cartName ? `Cobrar · ${cartName}` : "Cobrar",
      subtitle: storeSubtitle || undefined,
    };
    summary = {
      label: "A cobrar",
      detail: unitsLabel,
      amount: amountDue,
      currency: monedaBase,
      conversions: conversionsOf(amountDue),
      breakdown,
    };
    payBar = {
      status: "Total a cobrar",
      detail: "Elige una forma de pago",
      amount: amountDue,
      currency: monedaBase,
      conversions: conversionsOf(amountDue),
    };
  }

  const mixedLines = useMemo<MixedLine[]>(
    () =>
      lines.map((line) => {
        const destination =
          line.kind === "transfer" && transferDestinations.length > 0
            ? transferDestinations.find(
                (d) => d.id === line.transferDestinationId,
              )?.nombre
            : undefined;
        return {
          id: line.id,
          title: methodTitle(line.kind, line.currency),
          hint: [formatMontoEnMoneda(line.amount, line.currency), destination]
            .filter(Boolean)
            .join(" · "),
          amountBase: convertToBase(
            line.amount,
            line.currency,
            tasasVigentes,
            monedaBase,
          ),
        };
      }),
    [lines, transferDestinations, tasasVigentes, monedaBase],
  );

  return (
    <Box sx={ROOT_SX}>
      <CheckoutTopBar
        title={topBar.title}
        subtitle={topBar.subtitle}
        onBack={goBack}
      />

      <CheckoutSummaryHeader
        label={summary.label}
        detail={summary.detail}
        amount={summary.amount}
        currency={summary.currency}
        conversions={summary.conversions}
        breakdown={summary.breakdown}
      />

      <Box sx={BODY_SX}>
        {editingLine && lineSuggestions && mode.kind === "line" ? (
          <PaymentLineBody
            // Remounted per line so the draft starts from that line's amount.
            key={editingLine.id}
            line={editingLine}
            denominations={denominationsFor(editingLine.currency)}
            exact={lineSuggestions.exact}
            suggestions={lineSuggestions.suggestions}
            onAmountChange={(amount) => updateLine(editingLine.id, { amount })}
            transferDestinations={transferDestinations}
            onDestinationChange={(transferDestinationId) =>
              updateLine(editingLine.id, { transferDestinationId })
            }
            missingAmountBase={missing ? missingAmount : null}
            base={monedaBase}
            change={changeBlock}
          />
        ) : mode.kind === "mixed" ? (
          <MixedPaymentBody
            lines={mixedLines}
            onOpenLine={(lineId) =>
              setMode({ kind: "line", lineId, from: "mixed" })
            }
            onRemoveLine={removeLine}
            canAdd={paymentOptions.length > 0}
            onAdd={() => setAddOpen(true)}
            missingAmountBase={missing ? missingAmount : null}
            change={changeBlock}
            discountTotal={discountTotal}
            tipTotal={tipTotal}
            base={monedaBase}
            onOpenTip={() => setTipOpen(true)}
          />
        ) : (
          <PaymentMethodBody
            discountTotal={discountTotal}
            tipTotal={tipTotal}
            base={monedaBase}
            onOpenTip={() => setTipOpen(true)}
            methods={methods}
            onPick={pickMethod}
          />
        )}
      </Box>

      <CheckoutPayBar
        status={payBar.status}
        detail={payBar.detail}
        amount={payBar.amount}
        currency={payBar.currency}
        codeSuffix={payBar.codeSuffix}
        conversions={payBar.conversions}
        canSell={canSell}
        submitting={submitting}
        onConfirm={handleSell}
      />

      <AddPaymentSheet
        open={addOpen}
        options={paymentOptions}
        onClose={() => setAddOpen(false)}
        onPick={(option) => {
          const id = addLine(option.kind, option.currency, option.suggested);
          setAddOpen(false);
          setMode({ kind: "line", lineId: id, from: "mixed" });
        }}
      />

      <TipSheet
        open={tipOpen}
        currencies={allCurrencies}
        // Reopening the tip taken from the change shows it in the currency it
        // actually landed in, not empty: editing from there is continuing,
        // not starting over.
        value={
          tipFromChange
            ? Object.fromEntries(
                tipFromChange.detail.map((linea) => [
                  linea.moneda,
                  linea.monto,
                ]),
              )
            : explicitTip
        }
        rates={tasasVigentes}
        base={monedaBase}
        onClose={() => setTipOpen(false)}
        onConfirm={(amounts) => {
          // A typed amount replaces the tip taken from the change: two
          // origins for one number would be ambiguous to undo.
          setTipFromChange(null);
          setExplicitTip(amounts);
        }}
      />

      <ChangeSheet
        open={changeOpen}
        options={options}
        selectedId={selectedId}
        unavailableIds={unavailableIds}
        errors={errors}
        overshootBase={overshootBase}
        custom={custom}
        changeTotalBase={change}
        rates={tasasVigentes}
        base={monedaBase}
        onClose={() => setChangeOpen(false)}
        onSelect={select}
      />
    </Box>
  );
}
