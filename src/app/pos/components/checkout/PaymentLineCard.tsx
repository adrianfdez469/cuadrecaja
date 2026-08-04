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
import type { ITransferDestination } from "@/schemas/transferDestination";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface PaymentLineCardProps {
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
}: PaymentLineCardProps) {
  const [keypadOpen, setKeypadOpen] = useState(false);

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
        {onRemove && (
          <IconButton
            size="small"
            onClick={onRemove}
            aria-label={`Quitar ${isCash ? "efectivo" : "transferencia"} en ${line.currency}`}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {/*
        inputMode="none" keeps the OS keyboard down on mobile while still
        accepting a physical keyboard on desktop; tapping opens AmountKeypad.
      */}
      <Box
        component="input"
        readOnly
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
          ≈ {equivalentBase.toFixed(2)} {base}
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

      {!isCash && line.amount > 0 && transferDestinations.length > 1 && (
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
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

      <AmountKeypad
        open={keypadOpen}
        currency={line.currency}
        denominations={denominations}
        value={line.amount}
        label={`${isCash ? "Efectivo" : "Transferencia"} ${line.currency}`}
        pendingLabel={`Falta ${pending.toFixed(2)}`}
        onClose={() => setKeypadOpen(false)}
        onConfirm={(amount) => {
          onChange({ amount });
          setKeypadOpen(false);
        }}
      />
    </Paper>
  );
}
