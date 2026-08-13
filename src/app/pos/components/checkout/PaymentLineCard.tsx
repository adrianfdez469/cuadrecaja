"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { AmountChips } from "@/app/pos/components/checkout/AmountChips";
import { AmountField } from "@/app/pos/components/checkout/AmountField";
import { CurrencyChipSelect } from "@/app/pos/components/checkout/CurrencyChipSelect";
import { AmountKeypad } from "@/app/pos/components/checkout/AmountKeypad";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import { convertToBase } from "@/lib/currency";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { ITransferDestination } from "@/schemas/transferDestination";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface PaymentLineCardProps {
  /** The cash line for this currency, or the standalone transfer line for a
   * currency that doesn't admit cash at all. */
  line: PaymentLine;
  /** Amount still owed, expressed in this line's currency. */
  pending: number;
  denominations: number[];
  isBase: boolean;
  transferDestinations: ITransferDestination[];
  rates: ITasaSnapshot;
  base: string;
  onChange: (patch: Partial<PaymentLine>) => void;
  onRemove?: () => void;
  /** Currencies this card can be re-denominated to; empty disables the menu. */
  currencyOptions: string[];
  onCurrencyChange: (currency: string) => void;
  /** Present only when `line` is a cash line and this currency also admits
   * transfer: shows the toggle that reveals the embedded transfer field. */
  canToggleTransfer?: boolean;
  /** The paired transfer line for this currency, once the toggle is on. */
  transferLine?: PaymentLine;
  /** Amount still owed, expressed in this currency, excluding the transfer
   * line itself. */
  transferPending?: number;
  onToggleTransfer?: () => void;
  onTransferAmountChange?: (amount: number) => void;
  onTransferDestinationChange?: (destinationId: string) => void;
}

export function PaymentLineCard({
  line,
  pending,
  denominations,
  isBase,
  transferDestinations,
  rates,
  base,
  onChange,
  onRemove,
  currencyOptions,
  onCurrencyChange,
  canToggleTransfer,
  transferLine,
  transferPending = 0,
  onToggleTransfer,
  onTransferAmountChange,
  onTransferDestinationChange,
}: PaymentLineCardProps) {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [transferKeypadOpen, setTransferKeypadOpen] = useState(false);

  const { exact, suggestions } = useMemo(
    () => suggestedAmounts(pending, denominations),
    [pending, denominations],
  );

  const isCash = line.kind === "cash";
  const equivalentBase = useMemo(
    () =>
      isBase || line.amount <= 0
        ? null
        : convertToBase(line.amount, line.currency, rates, base),
    [isBase, line.amount, line.currency, rates, base],
  );

  const transferEquivalentBase = useMemo(
    () =>
      !transferLine || isBase || transferLine.amount <= 0
        ? null
        : convertToBase(
            transferLine.amount,
            transferLine.currency,
            rates,
            base,
          ),
    [transferLine, isBase, rates, base],
  );

  const showTransferSection = isCash && Boolean(transferLine);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
        {/* Cash gets neither icon nor label: the currency is what actually
            distinguishes one card from the next, so it gets the emphasis
            instead. Standalone transfer cards keep both — there's no switch
            there to say so otherwise. */}
        {!isCash && (
          <>
            <CreditCardIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={700}>
              Transferencia
            </Typography>
          </>
        )}
        <CurrencyChipSelect
          value={line.currency}
          options={currencyOptions}
          onChange={onCurrencyChange}
        />
        <Box flex={1} />
        {onRemove && (
          <IconButton
            size="small"
            onClick={onRemove}
            aria-label={`Quitar ${line.currency}`}
            sx={{
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              color: "error.main",
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {/* The transfer control lives inside the amount field's own underline —
          a card icon at its right edge — instead of as a separate labeled
          row below the chips: paying part of this currency by transfer is a
          property of this amount, so it belongs on the amount. */}
      <AmountField
        value={line.amount}
        ariaLabel={`Monto en ${line.currency}`}
        keypadOpen={keypadOpen}
        onOpenKeypad={() => setKeypadOpen(true)}
        onChange={(amount) => onChange({ amount })}
        action={
          isCash &&
          canToggleTransfer &&
          onToggleTransfer && (
            <Tooltip
              title={
                transferLine
                  ? "Quitar transferencia"
                  : "Pagar parte con transferencia"
              }
            >
              <IconButton
                size="small"
                onClick={onToggleTransfer}
                color={transferLine ? "primary" : "default"}
                aria-pressed={Boolean(transferLine)}
                aria-label={
                  transferLine
                    ? `Quitar transferencia en ${line.currency}`
                    : `Agregar transferencia en ${line.currency}`
                }
                sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
              >
                <CreditCardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        }
      />

      {equivalentBase !== null && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mt={0.5}
        >
          ≈ {formatMontoEnMoneda(equivalentBase, base)}
        </Typography>
      )}

      {isCash && (
        <Box mt={1}>
          <AmountChips
            exact={exact}
            suggestions={suggestions}
            value={line.amount}
            onSelect={(amount) => onChange({ amount })}
          />
        </Box>
      )}

      {/* Standalone transfer-only currency: this line IS the transfer, its
          own destination selector lives here directly. */}
      {!isCash && line.amount > 0 && transferDestinations.length > 1 && (
        <FormControl
          fullWidth
          size="small"
          sx={{ mt: 2, "& .MuiOutlinedInput-root": { minHeight: 44 } }}
        >
          <InputLabel>Destino</InputLabel>
          <Select
            label="Destino"
            value={line.transferDestinationId ?? ""}
            onChange={(event) =>
              onChange({ transferDestinationId: event.target.value })
            }
          >
            {transferDestinations.map((destination) => (
              <MenuItem key={destination.id} value={destination.id}>
                {destination.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Transfer embedded in a cash card: typing here moves money out of
          the cash amount above, it never adds to what's already been
          counted as paid. A local fallback keeps the fields renderable
          while the toggle-off animates the section closed — `transferLine`
          is gone from state the instant the icon is tapped, but Collapse
          needs a frame or two of content to animate against. */}
      {isCash && canToggleTransfer && (
        <Collapse in={showTransferSection}>
          {(() => {
            const t = transferLine ?? {
              id: "",
              kind: "transfer" as const,
              currency: line.currency,
              amount: 0,
            };
            return (
              <Box
                mt={1.25}
                pt={1.25}
                sx={{ borderTop: "1px dashed", borderColor: "divider" }}
              >
                {/* The section needs to say what it is now that the control
                    revealing it is an icon rather than a labeled switch. */}
                <Stack direction="row" alignItems="center" gap={0.75} mb={0.5}>
                  <CreditCardIcon fontSize="small" color="primary" />
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color="text.secondary"
                  >
                    Transferencia
                  </Typography>
                </Stack>

                <AmountField
                  value={t.amount}
                  ariaLabel={`Monto por transferencia en ${t.currency}`}
                  keypadOpen={transferKeypadOpen}
                  onOpenKeypad={() => setTransferKeypadOpen(true)}
                  onChange={(amount) => onTransferAmountChange?.(amount)}
                />

                {transferEquivalentBase !== null && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mt={0.5}
                  >
                    ≈ {formatMontoEnMoneda(transferEquivalentBase, base)}
                  </Typography>
                )}

                {t.amount > 0 && transferDestinations.length > 1 && (
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{
                      mt: 2,
                      "& .MuiOutlinedInput-root": { minHeight: 44 },
                    }}
                  >
                    <InputLabel>Destino</InputLabel>
                    <Select
                      label="Destino"
                      value={t.transferDestinationId ?? ""}
                      onChange={(event) =>
                        onTransferDestinationChange?.(event.target.value)
                      }
                    >
                      {transferDestinations.map((destination) => (
                        <MenuItem key={destination.id} value={destination.id}>
                          {destination.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <AmountKeypad
                  open={transferKeypadOpen}
                  currency={t.currency}
                  denominations={[]}
                  value={t.amount}
                  label={`Transferencia ${t.currency}`}
                  pendingLabel={`Falta ${formatMontoEnMoneda(transferPending, t.currency)}`}
                  onClose={() => setTransferKeypadOpen(false)}
                  onConfirm={(amount) => {
                    onTransferAmountChange?.(amount);
                    setTransferKeypadOpen(false);
                  }}
                />
              </Box>
            );
          })()}
        </Collapse>
      )}

      <AmountKeypad
        open={keypadOpen}
        currency={line.currency}
        denominations={denominations}
        value={line.amount}
        label={`${isCash ? "Efectivo" : "Transferencia"} ${line.currency}`}
        pendingLabel={`Falta ${formatMontoEnMoneda(pending, line.currency)}`}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(amount) => {
          onChange({ amount });
          setKeypadOpen(false);
        }}
      />
    </Paper>
  );
}
