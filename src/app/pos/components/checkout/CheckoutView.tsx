"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
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
import { convertToBase } from "@/lib/currency";
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

  const { lines, addLine, updateLine, removeLine } = usePaymentLines({
    finalTotal,
    monedaBase,
    denominationsFor,
    defaultTransferDestId: defaultDestId(transferDestinations),
  });

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

  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];
    for (const currency of allCurrencies) {
      const isBase = currency === monedaBase;
      const info = monedasActivas.find((m) => m.monedaCode === currency);
      const allowsCash = isBase || (info?.admiteEfectivo ?? true);
      const allowsTransfer = isBase || (info?.admiteTransferencia ?? false);
      const pending = pendingInCurrency(
        lines,
        finalTotal,
        currency,
        tasasVigentes,
        monedaBase,
      );
      const suggested = suggestedAmounts(
        pending,
        denominationsFor(currency),
      ).exact;
      const equivalentBase =
        isBase || suggested <= 0
          ? null
          : convertToBase(suggested, currency, tasasVigentes, monedaBase);

      const hasCashLine = lines.some(
        (line) => line.kind === "cash" && line.currency === currency,
      );
      if (allowsCash && !hasCashLine) {
        options.push({ kind: "cash", currency, suggested, equivalentBase });
      }
      if (allowsTransfer) {
        options.push({
          kind: "transfer",
          currency,
          suggested: pending,
          equivalentBase,
        });
      }
    }
    return options;
  }, [
    allCurrencies,
    monedaBase,
    monedasActivas,
    lines,
    finalTotal,
    tasasVigentes,
    denominationsFor,
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
      <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
        <IconButton
          onClick={onBack}
          aria-label="Volver al carrito"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h6">Cobrar</Typography>
          <Typography variant="caption" color="text.secondary">
            {itemCount} producto{itemCount !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Stack>

      <Box flex={1} minHeight={0} sx={{ overflowY: "auto" }}>
        <Box mb={1.5}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            Total a cobrar
          </Typography>
          <MultiCurrencyAmount
            amount={finalTotal}
            variant="emphasized"
            color="success.main"
          />
        </Box>

        <Stack gap={1}>
          {lines.map((line) => (
            <PaymentLineCard
              key={line.id}
              line={line}
              pending={pendingInCurrency(
                lines,
                finalTotal,
                line.currency,
                tasasVigentes,
                monedaBase,
                line.id,
              )}
              denominations={denominationsFor(line.currency)}
              isBase={line.currency === monedaBase}
              transferDestinations={transferDestinations}
              rates={tasasVigentes}
              base={monedaBase}
              onChange={(patch) => updateLine(line.id, patch)}
              onRemove={
                lines.length > 1 ? () => removeLine(line.id) : undefined
              }
            />
          ))}

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
          borderTop: "2px solid",
          borderColor: "divider",
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
