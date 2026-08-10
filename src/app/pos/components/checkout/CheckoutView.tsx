"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useAppContext } from "@/context/AppContext";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { PaymentLineCard } from "@/app/pos/components/checkout/PaymentLineCard";
import {
  AddPaymentSheet,
  type PaymentOption,
} from "@/app/pos/components/checkout/AddPaymentSheet";
import { ChangeSheet } from "@/app/pos/components/checkout/ChangeSheet";
import { ChangeSummary } from "@/app/pos/components/checkout/ChangeSummary";
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
import { toVueltoLineas } from "@/app/pos/utils/changeMath";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import { convertFromBase, convertToBase } from "@/lib/currency";
import { DENOMINACIONES } from "@/constants/billDenominations";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface CheckoutViewProps {
  finalTotal: number;
  discountTotal: number;
  promoCode: string;
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
  onSaleComplete: () => void;
}

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

export function CheckoutView({
  finalTotal,
  discountTotal,
  promoCode,
  transferDestinations,
  tiendaId,
  cierreId,
  itemCount,
  onBack,
  makePay,
  onSaleComplete,
}: CheckoutViewProps) {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();

  const monedasActivas = useMemo(
    () => monedasNegocio.filter((m) => m.activo),
    [monedasNegocio],
  );

  const denominationsFor = useCallback(
    (currency: string): number[] => {
      const info = monedasActivas.find((m) => m.monedaCode === currency);
      const values = (info?.moneda?.denominaciones ?? [])
        .filter((d) => d.activo)
        .map((d) => d.valor)
        .sort((a, b) => b - a);
      if (values.length > 0) return values;
      // CUP keeps a static fallback so the base currency always has bills.
      return currency === "CUP"
        ? [...DENOMINACIONES.CUP].sort((a, b) => b - a)
        : [];
    },
    [monedasActivas],
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
    finalTotal,
    monedaBase,
    denominationsFor,
    defaultTransferDestId: defaultDestId(transferDestinations),
    convertAmount,
  });

  // The base cash line the hook preloads at the full total. While untouched
  // (`dirty === false`) it does not represent a real cashier decision yet, so
  // "Agregar forma de pago" must be able to both (a) build its suggestions as
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
    const cashByCurrency = new Map<string, (typeof lines)[number]>();
    const transferByCurrency = new Map<string, (typeof lines)[number]>();
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

  const paid = paidBase(lines, tasasVigentes, monedaBase);
  const missing = finalTotal === 0 ? false : isMissing(paid, finalTotal);
  const change = changeBase(paid, finalTotal);

  const {
    distribution,
    errors,
    hasErrors,
    distributedBaseAmount,
    setAmount,
    addCurrency,
    removeCurrency,
  } = useChangeDistribution({
    lines,
    changeAmountBase: change,
    missing,
    rates: tasasVigentes,
    base: monedaBase,
    tiendaId,
    cierreId,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  // The exit transition keeps this view mounted for ~200 ms after a sale is
  // submitted; without this guard a second tap would send a second sale.
  const [submitting, setSubmitting] = useState(false);
  // The ref is the actual guard — state updates are asynchronous, so two taps
  // landing in the same tick would both read `submitting === false` and both
  // submit. Ghost double-fire is a real failure mode on POS touch hardware and
  // the cost is a duplicate sale. The state flag only drives `disabled`.
  const submittingRef = useRef(false);

  const allCurrencies = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

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
   * admit every kind of payment the card currently holds.
   */
  const currencyOptionsFor = useCallback(
    (hasCash: boolean, hasTransfer: boolean) =>
      allCurrencies.filter((currency) => {
        if (lines.some((line) => line.currency === currency)) return false;
        const { allowsCash, allowsTransfer } = supportFor(currency);
        return (!hasCash || allowsCash) && (!hasTransfer || allowsTransfer);
      }),
    [allCurrencies, lines, supportFor],
  );

  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];
    // The initial base cash line is a placeholder, not a cashier decision,
    // until something is touched. Excluding it here means "1000 cash + 250
    // transfer" suggests 250 for the transfer on first open instead of 0 —
    // the whole line would otherwise count as already covering the total.
    const excludeId = !dirty && baseCashLine ? baseCashLine.id : undefined;
    for (const currency of allCurrencies) {
      const { isBase, allowsCash, allowsTransfer } = supportFor(currency);
      const pending = pendingInCurrency(
        lines,
        finalTotal,
        currency,
        tasasVigentes,
        monedaBase,
        excludeId,
      );
      const suggested = suggestedAmounts(
        pending,
        denominationsFor(currency),
      ).exact;
      // Computed separately per option, each from the value it actually
      // displays: the cash row shows the ceiled `suggested`, the transfer
      // row shows the raw `pending` — reusing one for the other made the
      // transfer row's "≈" disagree with its own suggested amount.
      const cashEquivalentBase =
        isBase || suggested <= 0
          ? null
          : convertToBase(suggested, currency, tasasVigentes, monedaBase);
      const transferEquivalentBase =
        isBase || pending <= 0
          ? null
          : convertToBase(pending, currency, tasasVigentes, monedaBase);

      const hasCashLine = lines.some(
        (line) => line.kind === "cash" && line.currency === currency,
      );
      if (allowsCash && !hasCashLine) {
        options.push({
          kind: "cash",
          currency,
          suggested,
          equivalentBase: cashEquivalentBase,
        });
      }
      // Transfer for a cash-capable currency is no longer offered here: once
      // that currency has a cash card, its transfer toggle lives on the card
      // itself (see PaymentLineCard) and typing into it reduces the cash
      // amount, like the old per-currency panel did. This sheet only needs
      // to offer transfer as a standalone option for a currency that can't
      // take cash at all — there's no cash card to embed a toggle into.
      const hasTransferLine = lines.some(
        (line) => line.kind === "transfer" && line.currency === currency,
      );
      if (allowsTransfer && !allowsCash && !hasTransferLine) {
        options.push({
          kind: "transfer",
          currency,
          suggested: pending,
          equivalentBase: transferEquivalentBase,
        });
      }
    }
    return options;
  }, [
    allCurrencies,
    monedaBase,
    supportFor,
    lines,
    finalTotal,
    tasasVigentes,
    denominationsFor,
    dirty,
    baseCashLine,
  ]);

  const eligibleChangeCurrencies = useMemo(
    () =>
      allCurrencies.filter(
        (currency) =>
          !(currency in distribution) && denominationsFor(currency).length > 0,
      ),
    [allCurrencies, distribution, denominationsFor],
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
    !submitting &&
    // Spec section 5.7: never submit against an empty basket. Without this a
    // post-sale remount lands on finalTotal === 0 with a fresh submit ref and
    // re-enables the button.
    itemCount > 0 &&
    (finalTotal === 0 ? lines.length > 0 : !missing) &&
    !needsTransferDestination &&
    !hasErrors;

  const handleSell = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const pagosDetalle = toPagoLineas(lines, tasasVigentes, monedaBase);
    const vueltoDetalle = toVueltoLineas(distribution);

    const totalCashBase = pagosDetalle
      .filter((p) => p.tipo === "cash")
      .reduce((sum, p) => sum + p.equivalenteBase, 0);
    const totalTransferBase = pagosDetalle
      .filter((p) => p.tipo === "transfer")
      .reduce((sum, p) => sum + p.equivalenteBase, 0);
    const firstTransferDestId = pagosDetalle.find(
      (p) => p.tipo === "transfer",
    )?.transferDestinationId;

    const multimoneda: IMultimonedaExtras = {
      monedaCobro: monedaBase,
      pagosDetalle,
      vueltoDetalle,
      tasaSnapshot: tasasVigentes,
      ...(discountTotal > 0 ? { discountTotal } : {}),
    };

    // The parent switches back to the cart step, which unmounts this view and
    // therefore resets both hooks — no explicit reset needed here.
    onSaleComplete();

    await makePay(
      finalTotal,
      totalCashBase,
      totalTransferBase,
      firstTransferDestId,
      promoCode ? [promoCode] : [],
      multimoneda,
    ).catch((error) => console.error("Error pago:", error));
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        rowGap={0.5}
        gap={1}
        mb={1.5}
      >
        <IconButton
          onClick={onBack}
          aria-label="Volver al carrito"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h6">Cobrar</Typography>
          <Chip
            icon={<ShoppingCartIcon sx={{ fontSize: "1rem !important" }} />}
            label={itemCount}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 24, fontWeight: 700 }}
          />
        </Stack>

        <Box flex={1} sx={{ minWidth: 8 }} />

        {/* The equivalents stay on screen rather than behind a tap: this is
            the number the cashier reads out loud, and a customer paying in
            another currency asks for it every time. Same "hero" size and
            inline layout as the cart step's total, so the two screens read
            consistently. */}
        <MultiCurrencyAmount
          amount={finalTotal}
          variant="hero"
          color="success.main"
          align="right"
          layout="inline"
        />
      </Stack>

      <Box flex={1} minHeight={0} sx={{ overflowY: "auto" }}>
        <Stack gap={1}>
          {currencyGroups.map((group) => {
            const { isBase, allowsTransfer } = supportFor(group.currency);
            const onRemove =
              currencyGroups.length > 1
                ? () => removeCurrencyGroup(group.currency)
                : undefined;
            const currencyOptions = currencyOptionsFor(
              Boolean(group.cashLine),
              Boolean(group.transferLine),
            );
            const onCurrencyChange = (currency: string) =>
              changeCurrency(group.currency, currency);

            if (group.cashLine) {
              const cashLine = group.cashLine;
              return (
                <PaymentLineCard
                  key={group.currency}
                  line={cashLine}
                  pending={pendingInCurrency(
                    lines,
                    finalTotal,
                    group.currency,
                    tasasVigentes,
                    monedaBase,
                    cashLine.id,
                  )}
                  denominations={denominationsFor(group.currency)}
                  isBase={isBase}
                  transferDestinations={transferDestinations}
                  rates={tasasVigentes}
                  base={monedaBase}
                  onChange={(patch) => updateLine(cashLine.id, patch)}
                  onRemove={onRemove}
                  currencyOptions={currencyOptions}
                  onCurrencyChange={onCurrencyChange}
                  canToggleTransfer={allowsTransfer}
                  transferLine={group.transferLine}
                  transferPending={
                    group.transferLine
                      ? pendingInCurrency(
                          lines,
                          finalTotal,
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
              );
            }

            // Transfer-only currency: no cash line to embed a toggle into,
            // so this line stands alone exactly like it did before.
            if (!group.transferLine) return null;
            const transferLine = group.transferLine;
            return (
              <PaymentLineCard
                key={group.currency}
                line={transferLine}
                pending={pendingInCurrency(
                  lines,
                  finalTotal,
                  group.currency,
                  tasasVigentes,
                  monedaBase,
                  transferLine.id,
                )}
                denominations={denominationsFor(group.currency)}
                isBase={isBase}
                transferDestinations={transferDestinations}
                rates={tasasVigentes}
                base={monedaBase}
                onChange={(patch) => updateLine(transferLine.id, patch)}
                onRemove={onRemove}
                currencyOptions={currencyOptions}
                onCurrencyChange={onCurrencyChange}
              />
            );
          })}

          {paymentOptions.length > 0 && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              sx={{
                textTransform: "none",
                borderStyle: "dashed",
                minHeight: 44,
              }}
              variant="outlined"
              color="inherit"
            >
              Agregar forma de pago
            </Button>
          )}
        </Stack>
      </Box>

      {/*
        No safe-area padding here on purpose: CartContent already applies
        `env(safe-area-inset-bottom)` to the container this view is absolutely
        positioned inside. Adding it again would double the gap. If CheckoutView
        is ever mounted somewhere else, that container owes it the same padding.
      */}
      <Box
        flex="0 0 auto"
        sx={{
          mt: 1,
          pt: 1.5,
          pb: 1.5,
          px: 2,
          // Cancels the parent drawer's own horizontal padding (theme.spacing(2))
          // so this panel reaches the drawer's true edges instead of sitting
          // inset like the rest of the content — same treatment as the cart
          // step's footer.
          mx: -2,
          bgcolor: "background.paper",
          // The shadow alone reads as "a panel floating above the content
          // below it" — a divider line reads as a boundary, not elevation.
          boxShadow: "0px -6px 16px rgba(0,0,0,0.12)",
        }}
      >
        <ChangeSummary
          missing={missing}
          missingAmount={Math.max(0, finalTotal - paid)}
          changeAmount={change}
          base={monedaBase}
          error={firstError}
          canSell={canSell}
          onOpenDetail={() => setChangeOpen(true)}
          onSell={handleSell}
        />
      </Box>

      <AddPaymentSheet
        open={addOpen}
        options={paymentOptions}
        base={monedaBase}
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

      <ChangeSheet
        open={changeOpen}
        distribution={distribution}
        errors={errors}
        eligibleCurrencies={eligibleChangeCurrencies}
        changeTotalBase={change}
        distributedBaseAmount={distributedBaseAmount}
        base={monedaBase}
        onClose={() => setChangeOpen(false)}
        onChange={setAmount}
        onAdd={addCurrency}
        onRemove={removeCurrency}
      />
    </Box>
  );
}
