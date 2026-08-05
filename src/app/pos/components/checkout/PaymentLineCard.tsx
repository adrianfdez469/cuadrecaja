"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { AmountChips } from "@/app/pos/components/checkout/AmountChips";
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
        {isCash ? (
          <PaymentsOutlinedIcon fontSize="small" color="action" />
        ) : (
          <CreditCardIcon fontSize="small" color="action" />
        )}
        <Typography variant="body2" fontWeight={700}>
          {isCash ? "Efectivo" : "Transferencia"}
        </Typography>
        <Chip
          label={line.currency}
          size="small"
          color={isBase ? "primary" : "default"}
          variant={isBase ? "filled" : "outlined"}
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
        <Box flex={1} />
        {isCash && canToggleTransfer && onToggleTransfer && (
          <IconButton
            size="small"
            onClick={onToggleTransfer}
            color={transferLine ? "primary" : "default"}
            aria-label={
              transferLine
                ? `Quitar transferencia en ${line.currency}`
                : `Agregar transferencia en ${line.currency}`
            }
            aria-pressed={Boolean(transferLine)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <CreditCardIcon fontSize="small" />
          </IconButton>
        )}
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

      {/*
        inputMode="none" keeps the on-screen keyboard down on mobile while a
        physical keyboard still types into it on desktop; tapping opens
        AmountKeypad. The field must NOT be readOnly — that would block the
        physical keyboard too and leave onChange dead.
      */}
      <Box
        component="input"
        inputMode="none"
        value={line.amount || ""}
        placeholder="0"
        aria-label={`Monto en ${line.currency}`}
        onClick={() => setKeypadOpen(true)}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange({ amount: Number(event.target.value) || 0 })
        }
        sx={{
          width: "100%",
          border: 0,
          borderBottom: "2px solid",
          borderColor: "divider",
          bgcolor: "transparent",
          color: "text.primary",
          font: "inherit",
          fontSize: "1.4rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          py: 0.5,
          outline: "none",
          "&:focus": { borderColor: "primary.main" },
        }}
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
            onOther={() => setKeypadOpen(true)}
          />
        </Box>
      )}

      {/* Standalone transfer-only currency: this line IS the transfer, its
          own destination selector lives here directly. */}
      {!isCash && line.amount > 0 && transferDestinations.length > 1 && (
        <FormControl
          fullWidth
          size="small"
          sx={{ mt: 1, "& .MuiOutlinedInput-root": { minHeight: 44 } }}
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
          counted as paid. */}
      {showTransferSection && transferLine && (
        <Box
          mt={1.25}
          pt={1.25}
          sx={{ borderTop: "1px dashed", borderColor: "divider" }}
        >
          <Stack direction="row" alignItems="center" gap={0.75} mb={0.75}>
            <CreditCardIcon fontSize="small" color="action" />
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
            >
              Transferencia
            </Typography>
          </Stack>

          <Box
            component="input"
            inputMode="none"
            value={transferLine.amount || ""}
            placeholder="0"
            aria-label={`Monto por transferencia en ${transferLine.currency}`}
            onClick={() => setTransferKeypadOpen(true)}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onTransferAmountChange?.(Number(event.target.value) || 0)
            }
            sx={{
              width: "100%",
              border: 0,
              borderBottom: "2px solid",
              borderColor: "divider",
              bgcolor: "transparent",
              color: "text.primary",
              font: "inherit",
              fontSize: "1.1rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              py: 0.5,
              outline: "none",
              "&:focus": { borderColor: "primary.main" },
            }}
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

          {transferLine.amount > 0 && transferDestinations.length > 1 && (
            <FormControl
              fullWidth
              size="small"
              sx={{ mt: 1, "& .MuiOutlinedInput-root": { minHeight: 44 } }}
            >
              <InputLabel>Destino</InputLabel>
              <Select
                label="Destino"
                value={transferLine.transferDestinationId ?? ""}
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
            currency={transferLine.currency}
            denominations={[]}
            value={transferLine.amount}
            label={`Transferencia ${transferLine.currency}`}
            pendingLabel={`Falta ${formatMontoEnMoneda(transferPending, transferLine.currency)}`}
            onClose={() => setTransferKeypadOpen(false)}
            onConfirm={(amount) => {
              onTransferAmountChange?.(amount);
              setTransferKeypadOpen(false);
            }}
          />
        </Box>
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
