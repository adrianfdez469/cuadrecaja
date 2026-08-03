"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoneyField from "@/components/MoneyField";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { moneyRegex } from "@/utils/regex";
import type { ITransferDestination } from "@/schemas/transferDestination";

export interface QuickPayValues {
  cash: number;
  transferEnabled: boolean;
  transfer: number;
  transferDestId: string;
}

interface QuickPayFieldsProps {
  finalTotal: number;
  monedaBase: string;
  transferDestinations: ITransferDestination[];
  onChange: (values: QuickPayValues) => void;
}

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

export function QuickPayFields({
  finalTotal,
  monedaBase,
  transferDestinations,
  onChange,
}: QuickPayFieldsProps) {
  const [cash, setCash] = useState(0);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [transfer, setTransfer] = useState(0);
  const [transferDestId, setTransferDestId] = useState(() =>
    defaultDestId(transferDestinations),
  );
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);

  const report = (
    next: Partial<QuickPayValues>,
    base: {
      cash: number;
      transferEnabled: boolean;
      transfer: number;
      transferDestId: string;
    },
  ) => {
    onChange({ ...base, ...next });
  };

  const handleCashChange = (value: number) => {
    setCash(value);
    report(
      { cash: value },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleTransferToggle = () => {
    const next = !transferEnabled;
    setTransferEnabled(next);
    const nextTransfer = next ? transfer : 0;
    if (!next) setTransfer(0);
    report(
      { transferEnabled: next, transfer: nextTransfer },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleTransferChange = (value: number) => {
    setTransfer(value);
    report(
      { transfer: value },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleTransferDestChange = (id: string) => {
    setTransferDestId(id);
    report(
      { transferDestId: id },
      { cash, transferEnabled, transfer, transferDestId },
    );
  };

  const handleToggleBreakdown = () => {
    if (!showBreakdown) setBreakdownResetKey((k) => k + 1);
    setShowBreakdown((v) => !v);
  };

  return (
    <Box>
      <MoneyField
        fullWidth
        label="Monto recibido (efectivo)"
        placeholder={`Exacto: ${finalTotal.toFixed(2)} ${monedaBase}`}
        currencySymbol={<AttachMoneyIcon />}
        value={cash || ""}
        onChange={(e) => {
          if (showBreakdown) return;
          const v = e.target.value;
          if (moneyRegex.test(v)) handleCashChange(Number(v));
          else if (v === "") handleCashChange(0);
        }}
        inputProps={{ readOnly: showBreakdown }}
        sx={showBreakdown ? { bgcolor: "action.hover" } : {}}
      />

      <Button
        variant="text"
        size="small"
        onClick={handleToggleBreakdown}
        startIcon={showBreakdown ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mt: 0.5, textTransform: "none", color: "text.secondary" }}
      >
        {showBreakdown ? "Ocultar desglose" : "Desglosar billetes"}
      </Button>
      <Collapse in={showBreakdown}>
        {showBreakdown && (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              px: { xs: 0.5, sm: 1.5 },
              pb: 1,
            }}
          >
            <BillBreakdownInput
              currency={DEFAULT_CURRENCY}
              targetAmount={finalTotal}
              onChange={handleCashChange}
              resetKey={breakdownResetKey}
            />
          </Box>
        )}
      </Collapse>

      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Switch
            checked={transferEnabled}
            onChange={handleTransferToggle}
            size="small"
          />
        }
        label="Pagó por transferencia"
      />

      <Collapse in={transferEnabled}>
        <Box sx={{ mt: 1 }}>
          <MoneyField
            fullWidth
            label="Monto por transferencia"
            currencySymbol={<CreditCardIcon />}
            value={transfer || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (moneyRegex.test(v)) handleTransferChange(Number(v));
              else if (v === "") handleTransferChange(0);
            }}
          />

          {transfer > 0 && transferDestinations.length > 1 && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Destino</InputLabel>
              <Select
                value={transferDestId}
                label="Destino"
                onChange={(e) => handleTransferDestChange(e.target.value)}
              >
                {transferDestinations.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
