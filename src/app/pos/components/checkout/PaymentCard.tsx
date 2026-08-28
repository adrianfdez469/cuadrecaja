"use client";

import { memo, useMemo, useState } from "react";
import {
  Box,
  ButtonBase,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ReceivedAmountField } from "@/app/pos/components/checkout/ReceivedAmountField";
import { QuickAmountChips } from "@/app/pos/components/checkout/QuickAmountChips";
import { AmountKeypadSheet } from "@/app/pos/components/checkout/AmountKeypadSheet";
import {
  CurrencySheet,
  type CurrencyChoice,
} from "@/app/pos/components/checkout/CurrencySheet";
import { suggestedAmounts } from "@/app/pos/utils/suggestedAmounts";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { ITransferDestination } from "@/schemas/transferDestination";
import { shape, touch } from "@/theme";

interface PaymentCardProps {
  /** The cash line for this currency, or the standalone transfer line for a
   * currency that doesn't admit cash at all. */
  line: PaymentLine;
  /** Amount still owed, expressed in this line's currency. */
  pending: number;
  denominations: number[];
  transferDestinations: ITransferDestination[];
  onChange: (patch: Partial<PaymentLine>) => void;
  /** Present on every card but the only one. */
  onRemove?: () => void;
  /** The currencies this card can be paid in, the current one included,
   * each with what is owed in it. One entry means there is nothing to
   * switch to. */
  currencyChoices: CurrencyChoice[];
  onCurrencyChange: (currency: string) => void;
  /** Present only when `line` is a cash line and this currency also admits
   * transfer: shows the toggle that reveals the embedded transfer field. */
  canToggleTransfer?: boolean;
  /** The paired transfer line for this currency, once the toggle is on. */
  transferLine?: PaymentLine;
  /** Amount still owed, in this currency, excluding the transfer line. */
  transferPending?: number;
  onToggleTransfer?: () => void;
  onTransferAmountChange?: (amount: number) => void;
  onTransferDestinationChange?: (destinationId: string) => void;
}

/**
 * One currency of the payment, as the redesign draws it: the currency chip
 * and the transfer toggle on one row, the amount received in the 64px box,
 * the transfer under it when the toggle is on, and the quick amounts.
 *
 * Same functions as the production card: the chip re-denominates the card,
 * the toggle reveals a transfer that subtracts from the cash, and the amount
 * is typed straight in on a desktop or through the keypad sheet on a phone.
 */

const CARD_SX = { pt: 1.75 } as const;

const CUR_ROW_SX = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  px: 1.75,
} as const;

const CHIP_SX = {
  height: touch.min,
  px: 2,
  gap: 0.875,
  borderRadius: `${shape.radius.pill}px`,
  bgcolor: "semantic.hue.accent.surface",
  color: "primary.main",
  fontSize: "0.875rem",
  fontWeight: 700,
} as const;

const KIND_SX = {
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  color: "text.secondary",
  fontSize: "0.875rem",
  fontWeight: 600,
} as const;

const TIC_SX = {
  ml: "auto",
  width: touch.min,
  height: touch.min,
  flex: `0 0 ${touch.min}px`,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.md}px`,
  color: "text.secondary",
} as const;

const TIC_ON_SX = {
  ...TIC_SX,
  borderColor: "primary.main",
  bgcolor: "semantic.hue.accent.surface",
  color: "primary.main",
} as const;

const REMOVE_SX = {
  width: touch.min,
  height: touch.min,
  color: "text.secondary",
} as const;

const FIELD_SX = { px: 1.75, pt: 1.25 } as const;

const DESTINATION_SX = {
  mt: 1.25,
  "& .MuiOutlinedInput-root": { minHeight: 44 },
} as const;

const CHIPS_SX = { px: 1.75 } as const;

const toDraft = (amount: number) =>
  amount > 0
    ? Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2)
    : "";

const parse = (draft: string) => {
  const parsed = Number(draft || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function DestinationSelect({
  destinations,
  value,
  onChange,
}: {
  destinations: ITransferDestination[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (destinations.length <= 1) return null;
  return (
    <FormControl fullWidth size="small" sx={DESTINATION_SX}>
      <InputLabel>Destino</InputLabel>
      <Select
        label="Destino"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {destinations.map((destination) => (
          <MenuItem key={destination.id} value={destination.id}>
            {destination.nombre}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function PaymentCardComponent({
  line,
  pending,
  denominations,
  transferDestinations,
  onChange,
  onRemove,
  currencyChoices,
  onCurrencyChange,
  canToggleTransfer,
  transferLine,
  transferPending = 0,
  onToggleTransfer,
  onTransferAmountChange,
  onTransferDestinationChange,
}: PaymentCardProps) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [transferKeypadOpen, setTransferKeypadOpen] = useState(false);
  // While typing, the raw text is kept locally: parsing straight into a
  // number on every keystroke would erase a trailing decimal separator the
  // moment it is typed ("12," → 12 → "12"). Null means "show the line".
  const [draft, setDraft] = useState<string | null>(null);
  const [transferDraft, setTransferDraft] = useState<string | null>(null);

  const { exact, suggestions } = useMemo(
    () => suggestedAmounts(pending, denominations),
    [pending, denominations],
  );

  const isCash = line.kind === "cash";
  const canSwitchCurrency = currencyChoices.length > 1;

  return (
    <Box sx={CARD_SX}>
      <Box sx={CUR_ROW_SX}>
        <ButtonBase
          onClick={canSwitchCurrency ? () => setCurrencyOpen(true) : undefined}
          disabled={!canSwitchCurrency}
          aria-label={`Cambiar la moneda de este pago (${line.currency})`}
          sx={CHIP_SX}
        >
          {line.currency}
          {canSwitchCurrency && <ExpandMoreIcon fontSize="small" />}
        </ButtonBase>

        {/* A standalone transfer has no toggle to say what it is. */}
        {!isCash && (
          <Box sx={KIND_SX}>
            <CreditCardOutlinedIcon fontSize="small" />
            Transferencia
          </Box>
        )}

        {isCash && canToggleTransfer && onToggleTransfer && (
          <ButtonBase
            onClick={onToggleTransfer}
            aria-pressed={Boolean(transferLine)}
            aria-label={
              transferLine
                ? `Quitar transferencia en ${line.currency}`
                : `Agregar transferencia en ${line.currency}`
            }
            title={
              transferLine
                ? "Quitar transferencia"
                : "Pagar parte con transferencia"
            }
            sx={transferLine ? TIC_ON_SX : TIC_SX}
          >
            <CreditCardOutlinedIcon fontSize="small" />
          </ButtonBase>
        )}

        {onRemove && (
          <IconButton
            onClick={onRemove}
            aria-label={`Quitar ${line.currency}`}
            sx={{ ...REMOVE_SX, ml: canToggleTransfer ? 0 : "auto" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box sx={FIELD_SX}>
        <ReceivedAmountField
          draft={draft ?? toDraft(line.amount)}
          label={line.currency}
          ariaLabel={`Monto en ${line.currency}`}
          keypadOpen={keypadOpen}
          onOpenKeypad={() => setKeypadOpen(true)}
          onDraftChange={(next) => {
            setDraft(next);
            onChange({ amount: parse(next) });
          }}
        />
        {!isCash && (
          <DestinationSelect
            destinations={transferDestinations}
            value={line.transferDestinationId ?? ""}
            onChange={(id) => onChange({ transferDestinationId: id })}
          />
        )}
      </Box>

      {/* Transfer embedded in a cash card: typing here moves money out of
          the cash amount above, it never adds to what's already been
          counted as paid. */}
      {isCash && transferLine && (
        <Box sx={FIELD_SX}>
          <ReceivedAmountField
            variant="secondary"
            draft={transferDraft ?? toDraft(transferLine.amount)}
            label="Transferencia"
            ariaLabel={`Monto por transferencia en ${line.currency}`}
            keypadOpen={transferKeypadOpen}
            onOpenKeypad={() => setTransferKeypadOpen(true)}
            onDraftChange={(next) => {
              setTransferDraft(next);
              onTransferAmountChange?.(parse(next));
            }}
          />
          {transferLine.amount > 0 && (
            <DestinationSelect
              destinations={transferDestinations}
              value={transferLine.transferDestinationId ?? ""}
              onChange={(id) => onTransferDestinationChange?.(id)}
            />
          )}
        </Box>
      )}

      {isCash && (
        <Box sx={CHIPS_SX}>
          <QuickAmountChips
            exact={exact}
            suggestions={suggestions}
            value={line.amount}
            onSelect={(amount) => {
              setDraft(null);
              onChange({ amount });
            }}
          />
        </Box>
      )}

      <CurrencySheet
        open={currencyOpen}
        choices={currencyChoices}
        selected={line.currency}
        onClose={() => setCurrencyOpen(false)}
        onSelect={(currency) => {
          setCurrencyOpen(false);
          setDraft(null);
          setTransferDraft(null);
          onCurrencyChange(currency);
        }}
      />

      <AmountKeypadSheet
        open={keypadOpen}
        currency={line.currency}
        denominations={isCash ? denominations : []}
        value={line.amount}
        label={`${isCash ? "Efectivo" : "Transferencia"} ${line.currency}`}
        pendingLabel={`Falta ${formatMontoEnMoneda(pending, line.currency)}`}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(amount) => {
          setDraft(null);
          onChange({ amount });
          setKeypadOpen(false);
        }}
      />

      {transferLine && (
        <AmountKeypadSheet
          open={transferKeypadOpen}
          currency={transferLine.currency}
          denominations={[]}
          value={transferLine.amount}
          label={`Transferencia ${transferLine.currency}`}
          pendingLabel={`Falta ${formatMontoEnMoneda(transferPending, transferLine.currency)}`}
          onClose={() => setTransferKeypadOpen(false)}
          onConfirm={(amount) => {
            setTransferDraft(null);
            onTransferAmountChange?.(amount);
            setTransferKeypadOpen(false);
          }}
        />
      )}
    </Box>
  );
}

export const PaymentCard = memo(PaymentCardComponent);
