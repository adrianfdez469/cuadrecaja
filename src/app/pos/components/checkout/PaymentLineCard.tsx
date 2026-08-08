"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
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
        <Chip
          label={line.currency}
          color="primary"
          variant="filled"
          sx={{ height: 28, fontSize: "0.9rem", fontWeight: 700, px: 0.5 }}
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
          />
        </Box>
      )}

      {/* Self-labeled, full-width, and always visible when this currency
          admits transfer — a small icon among three others in the header
          was too easy to miss. Same switch-based pattern the panel this
          replaced used, so it's familiar rather than novel. */}
      {isCash && canToggleTransfer && onToggleTransfer && (
        <FormControlLabel
          labelPlacement="start"
          onChange={onToggleTransfer}
          sx={{
            mt: 1,
            ml: 0,
            width: "100%",
            justifyContent: "space-between",
          }}
          control={<Switch checked={Boolean(transferLine)} />}
          label={
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Transferencia
            </Typography>
          }
        />
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
          while the switch-off animates the section closed — `transferLine`
          is gone from state the instant the switch flips, but Collapse
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
                <Box
                  component="input"
                  inputMode="none"
                  value={t.amount || ""}
                  placeholder="0"
                  aria-label={`Monto por transferencia en ${t.currency}`}
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
                    fontSize: "1.4rem",
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
