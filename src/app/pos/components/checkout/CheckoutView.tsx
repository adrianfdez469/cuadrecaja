"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, ButtonBase } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useAppContext } from "@/context/AppContext";
import { useCartStore } from "@/store/cartStore";
import { useCartTotals } from "@/store/useCartTotals";
import { useMonedasAlternativas } from "@/components/MultiCurrencyAmount/useMonedasAlternativas";
import { CheckoutTopBar } from "@/app/pos/components/checkout/CheckoutTopBar";
import { CheckoutPayBar } from "@/app/pos/components/checkout/CheckoutPayBar";
import { PaymentCard } from "@/app/pos/components/checkout/PaymentCard";
import type { CurrencyChoice } from "@/app/pos/components/checkout/CurrencySheet";
import {
  AddPaymentSheet,
  type PaymentOption,
} from "@/app/pos/components/checkout/AddPaymentSheet";
import { ChangeSheet } from "@/app/pos/components/checkout/ChangeSheet";
import { ChangeBlock } from "@/app/pos/components/checkout/ChangeBlock";
import { MissingBlock } from "@/app/pos/components/checkout/MissingBlock";
import { TipChip, TipLink } from "@/app/pos/components/checkout/TipControls";
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
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import { toVueltoLineas } from "@/app/pos/utils/changeMath";
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
import type { SaleReceipt } from "@/app/pos/components/checkout/saleReceipt";
import type { IMultimonedaExtras, IPagoLinea } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";
import { touch } from "@/theme";

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

/** A currency with no bills configured. Stable so memos keyed on it settle. */
const EMPTY_DENOMINATIONS: number[] = [];

const ROOT_SX = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
} as const;

const BODY_SX = { flex: 1, minHeight: 0, overflowY: "auto", pb: 2 } as const;

// Each currency after the first sits on its own rule.
const CARD_SEPARATOR_SX = {
  mt: 1.5,
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

// «＋ Agregar forma de pago»: a 56px row on a rule, violet, as the redesign
// draws it — not a dashed box.
const ADD_SX = {
  width: "100%",
  height: touch.row,
  mt: 1.5,
  px: 1.75,
  gap: 1.25,
  justifyContent: "flex-start",
  borderTop: "1px solid",
  borderColor: "divider",
  color: "primary.main",
  fontSize: "0.9375rem",
  fontWeight: 600,
} as const;

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

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
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { unitCount } = useCartTotals();
  const cartName = useCartStore(
    (state) => state.carts.find((c) => c.id === state.activeCartId)?.name,
  );
  const { monedasAlternativas, convertToMoneda } = useMonedasAlternativas();

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
    /**
     * The change it replaced, in base. The split leaving the drawer is in
     * whole bills, so its value can exceed the change by a fraction of a
     * bill — and a tip worth more than the change would put the sale a few
     * cents short of paid. What the customer gave up is the change; the
     * bills are only how it is kept.
     */
    capBase: number;
  } | null>(null);
  /**
   * Tip typed per currency, each amount in its own currency. Not a single
   * base-currency number: the tip need not be in the currency the sale was
   * paid with, and it can be split across several.
   */
  const [explicitTip, setExplicitTip] = useState<TipAmounts>({});

  // Memoized because the whole checkout hangs off this: it is recomputed on
  // every keystroke, and `amountDue` below — plus everything derived from
  // it — depends on the result.
  const tipTotal = useMemo(
    () =>
      tipFromChange
        ? Math.min(
            tipTotalBase(tipFromChange.detail, tasasVigentes, monedaBase),
            tipFromChange.capBase,
          )
        : tipTotalFromAmounts(explicitTip, tasasVigentes, monedaBase),
    [tipFromChange, explicitTip, tasasVigentes, monedaBase],
  );

  // What the customer actually has to cover. Everything downstream — the
  // preloaded line, «falta», the change — is measured against this, never
  // against finalTotal, which is the business's share alone. Quantized on the
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

  // Resolved once per currency instead of on every call: it is invoked from
  // inside the JSX per card as well as from the chained memos of
  // `useChangeDistribution`, all of which key off its identity.
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

  const convertAmount = useCallback(
    (amount: number, from: string, to: string) =>
      from === to
        ? amount
        : convertFromBase(
            convertToBase(amount, from, tasasVigentes, monedaBase),
            to,
            tasasVigentes,
            monedaBase,
          ),
    [tasasVigentes, monedaBase],
  );

  const pendingFor = useCallback(
    (currentLines: PaymentLine[], currency: string, ignoreIds: string[]) =>
      pendingInCurrency(
        currentLines,
        amountDue,
        currency,
        tasasVigentes,
        monedaBase,
        ignoreIds,
      ),
    [amountDue, tasasVigentes, monedaBase],
  );

  const {
    lines,
    dirty,
    addLine,
    updateLine,
    removeCurrencyGroup,
    changeCurrency,
    toggleTransfer,
    setTransferAmount,
    setTransferDestination,
  } = usePaymentLines({
    finalTotal: amountDue,
    monedaBase,
    denominationsFor,
    defaultTransferDestId: defaultDestId(transferDestinations),
    convertAmount,
    pendingFor,
  });

  // The base cash line the hook preloads at the full total. While untouched
  // (`dirty === false`) it does not represent a real cashier decision yet, so
  // «Agregar forma de pago» must be able to both (a) build its suggestions as
  // if that amount were not committed, and (b) shrink it when a suggestion is
  // picked, so the total paid does not silently double.
  const baseCashLine = useMemo(
    () =>
      lines.find(
        (line) => line.kind === "cash" && line.currency === monedaBase,
      ),
    [lines, monedaBase],
  );

  // One card per currency: a cash line and its embedded transfer line (if
  // the toggle is on) group together, so cash and transfer for the same
  // currency never appear as two separate cards.
  const currencyGroups = useMemo(() => {
    const order: string[] = [];
    const cashByCurrency = new Map<string, PaymentLine>();
    const transferByCurrency = new Map<string, PaymentLine>();
    for (const line of lines) {
      if (!order.includes(line.currency)) order.push(line.currency);
      if (line.kind === "cash") cashByCurrency.set(line.currency, line);
      else transferByCurrency.set(line.currency, line);
    }
    return order.map((currency) => ({
      currency,
      cashLine: cashByCurrency.get(currency),
      transferLine: transferByCurrency.get(currency),
    }));
  }, [lines]);

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
        isBase,
        allowsCash: isBase || (info?.admiteEfectivo ?? true),
        allowsTransfer: isBase || (info?.admiteTransferencia ?? false),
      };
    },
    [monedaBase, monedasActivas],
  );

  /**
   * Currencies a card can be re-denominated to: those with no card of their
   * own yet — a merge would mean two cash lines for one currency — and that
   * admit every kind of payment the card currently holds. The card's own
   * currency leads the list, each with what is owed in it.
   */
  const currencyChoicesFor = useCallback(
    (
      current: string,
      hasCash: boolean,
      hasTransfer: boolean,
    ): CurrencyChoice[] =>
      [current, ...allCurrencies.filter((c) => c !== current)]
        .filter((currency) => {
          if (currency === current) return true;
          if (lines.some((line) => line.currency === currency)) return false;
          const { allowsCash, allowsTransfer } = supportFor(currency);
          return (!hasCash || allowsCash) && (!hasTransfer || allowsTransfer);
        })
        .map((code) => ({
          code,
          amount:
            code === monedaBase
              ? amountDue
              : convertFromBase(amountDue, code, tasasVigentes, monedaBase),
        })),
    [allCurrencies, lines, supportFor, monedaBase, amountDue, tasasVigentes],
  );

  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const result: PaymentOption[] = [];
    // The initial base cash line is a placeholder, not a cashier decision,
    // until something is touched. Excluding it here means "1000 cash + 250
    // transfer" suggests 250 for the transfer on first open instead of 0 —
    // the whole line would otherwise count as already covering the total.
    const excludeId = !dirty && baseCashLine ? baseCashLine.id : undefined;
    for (const currency of allCurrencies) {
      const { isBase, allowsCash, allowsTransfer } = supportFor(currency);
      const pending = pendingInCurrency(
        lines,
        amountDue,
        currency,
        tasasVigentes,
        monedaBase,
        excludeId,
      );
      const suggested = suggestedAmounts(
        pending,
        denominationsFor(currency),
      ).exact;
      const cashEquivalentBase =
        isBase || suggested <= 0
          ? null
          : convertToBase(suggested, currency, tasasVigentes, monedaBase);
      const transferEquivalentBase =
        isBase || pending <= 0
          ? null
          : convertToBase(pending, currency, tasasVigentes, monedaBase);

      const owed = isBase
        ? amountDue
        : convertFromBase(amountDue, currency, tasasVigentes, monedaBase);
      const owedBase = isBase ? null : amountDue;

      const hasCashLine = lines.some(
        (line) => line.kind === "cash" && line.currency === currency,
      );
      if (allowsCash && !hasCashLine) {
        result.push({
          kind: "cash",
          currency,
          suggested,
          equivalentBase: cashEquivalentBase,
          owed,
          owedBase,
        });
      }
      // Transfer for a cash-capable currency is not offered here: once that
      // currency has a cash card, its transfer toggle lives on the card
      // itself (see PaymentCard). This sheet only offers transfer as a
      // standalone option for a currency that can't take cash at all.
      const hasTransferLine = lines.some(
        (line) => line.kind === "transfer" && line.currency === currency,
      );
      if (allowsTransfer && !allowsCash && !hasTransferLine) {
        result.push({
          kind: "transfer",
          currency,
          suggested: pending,
          equivalentBase: transferEquivalentBase,
          owed,
          owedBase,
        });
      }
    }
    return result;
  }, [
    allCurrencies,
    monedaBase,
    supportFor,
    lines,
    amountDue,
    tasasVigentes,
    denominationsFor,
    dirty,
    baseCashLine,
  ]);

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
    !submitting &&
    // Spec section 5.7: never submit against an empty basket. Without this a
    // post-sale remount lands on amountDue === 0 with a fresh submit ref and
    // re-enables the button.
    itemCount > 0 &&
    (amountDue === 0 ? lines.length > 0 : !missing) &&
    !needsTransferDestination &&
    !hasErrors;

  const hasChange = !missing && change > 0;
  const changeLabel =
    formatChangeSplit(distribution) || formatMontoEnMoneda(change, monedaBase);

  /** «Pagado 13,00 USD» — or what the payment came to, as the bar says it. */
  const paidLabel = missing
    ? `Pagado ${formatMontoEnMoneda(paid, monedaBase)}`
    : hasChange
      ? `Pagado ${formatMontoEnMoneda(paid, monedaBase)}`
      : `Pago exacto ${formatMontoEnMoneda(0, monedaBase)}`;

  const conversions = monedasAlternativas.map(
    (m) =>
      `≈ ${formatMontoEnMoneda(convertToMoneda(amountDue, m.monedaCode), m.monedaCode)}`,
  );

  const clearTip = () => {
    setTipFromChange(null);
    setExplicitTip({});
  };

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

  return (
    <Box sx={ROOT_SX}>
      <CheckoutTopBar
        title="Cobrar"
        subtitle={`${cartName ?? "Cuenta"} · ${itemCount} ${itemCount === 1 ? "producto" : "productos"}`}
        count={unitCount}
        onBack={onBack}
      />

      <Box sx={BODY_SX}>
        {currencyGroups.map((group, index) => {
          const { allowsTransfer } = supportFor(group.currency);
          const onRemove =
            currencyGroups.length > 1
              ? () => removeCurrencyGroup(group.currency)
              : undefined;
          const currencyChoices = currencyChoicesFor(
            group.currency,
            Boolean(group.cashLine),
            Boolean(group.transferLine),
          );
          const onCurrencyChange = (currency: string) =>
            changeCurrency(group.currency, currency);
          const line = group.cashLine ?? group.transferLine;
          if (!line) return null;

          return (
            <Box key={group.currency} sx={index > 0 ? CARD_SEPARATOR_SX : null}>
              <PaymentCard
                line={line}
                pending={pendingInCurrency(
                  lines,
                  amountDue,
                  group.currency,
                  tasasVigentes,
                  monedaBase,
                  line.id,
                )}
                denominations={denominationsFor(group.currency)}
                transferDestinations={transferDestinations}
                onChange={(patch) => updateLine(line.id, patch)}
                onRemove={onRemove}
                currencyChoices={currencyChoices}
                onCurrencyChange={onCurrencyChange}
                canToggleTransfer={Boolean(group.cashLine) && allowsTransfer}
                transferLine={group.cashLine ? group.transferLine : undefined}
                transferPending={
                  group.cashLine && group.transferLine
                    ? pendingInCurrency(
                        lines,
                        amountDue,
                        group.currency,
                        tasasVigentes,
                        monedaBase,
                        group.transferLine.id,
                      )
                    : undefined
                }
                onToggleTransfer={() => toggleTransfer(group.currency)}
                onTransferAmountChange={(amount) =>
                  setTransferAmount(group.currency, amount)
                }
                onTransferDestinationChange={(destId) =>
                  setTransferDestination(group.currency, destId)
                }
              />
            </Box>
          );
        })}

        {paymentOptions.length > 0 && (
          <ButtonBase onClick={() => setAddOpen(true)} sx={ADD_SX}>
            <AddIcon fontSize="small" />
            Agregar forma de pago
          </ButtonBase>
        )}

        {/* What the payment leaves over: the change, the shortfall, the tip.
            The tip sits next to the change and not among the cards — it is
            not a form of payment, and this is the moment the customer says
            «quédate con el vuelto». */}
        {missing && (
          <MissingBlock amount={missingAmount} currency={monedaBase} />
        )}
        {hasChange && tipTotal === 0 && (
          <ChangeBlock
            changeLabel={changeLabel}
            // Only worth opening when there is something else to pick. The
            // typed split is always one more way, so the sheet stops being a
            // dead end as soon as there is a currency to type into.
            interactive={options.length > 1 || custom.currencies.length > 0}
            onOpenDetail={() => setChangeOpen(true)}
            onLeaveTip={() => {
              setExplicitTip({});
              setTipFromChange({
                signature: linesSignature,
                // The split already chosen and checked against the drawer:
                // the currency kept is the currency that was about to leave.
                detail: tipLinesFromChange(
                  distribution,
                  tasasVigentes,
                  monedaBase,
                ),
                capBase: change,
              });
            }}
            onOpenTip={() => setTipOpen(true)}
            base={monedaBase}
            error={firstError}
            overshootBase={overshootBase}
          />
        )}
        {tipTotal > 0 ? (
          <TipChip
            amountBase={tipTotal}
            base={monedaBase}
            onOpen={() => setTipOpen(true)}
            onClear={clearTip}
          />
        ) : (
          !hasChange && <TipLink onOpen={() => setTipOpen(true)} />
        )}
      </Box>

      <CheckoutPayBar
        status={cartName ? `A cobrar · ${cartName}` : "A cobrar"}
        detail={paidLabel}
        amount={amountDue}
        currency={monedaBase}
        conversions={conversions}
        canSell={canSell}
        submitting={submitting}
        onConfirm={handleSell}
      />

      <AddPaymentSheet
        open={addOpen}
        options={paymentOptions}
        base={monedaBase}
        covered={!missing}
        onClose={() => setAddOpen(false)}
        onPick={(option) => {
          // Mirrors the exclusion above: while the base cash line is still
          // untouched it stands for the whole total, so picking a second
          // form of payment must carve the picked amount out of it —
          // otherwise the total paid would silently double.
          if (!dirty && baseCashLine && baseCashLine.amount > 0) {
            const pickedBase =
              option.currency === monedaBase
                ? option.suggested
                : convertToBase(
                    option.suggested,
                    option.currency,
                    tasasVigentes,
                    monedaBase,
                  );
            const reduceBy = Math.min(pickedBase, baseCashLine.amount);
            const newAmount =
              Math.round((baseCashLine.amount - reduceBy) * 100) / 100;
            updateLine(baseCashLine.id, { amount: Math.max(0, newAmount) });
          }
          addLine(option.kind, option.currency, option.suggested);
          setAddOpen(false);
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
