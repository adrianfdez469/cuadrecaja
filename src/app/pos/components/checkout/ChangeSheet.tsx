"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SelectableTextField from "@/components/SelectableTextField";
import type { ChangeDistribution } from "@/app/pos/utils/changeMath";

interface ChangeSheetProps {
  open: boolean;
  distribution: ChangeDistribution;
  errors: Record<string, string | null>;
  /** Currencies with denominations that are not in the distribution yet. */
  eligibleCurrencies: string[];
  changeTotalBase: number;
  distributedBaseAmount: number;
  base: string;
  onClose: () => void;
  onChange: (currency: string, amount: number) => void;
  onAdd: (currency: string) => void;
  onRemove: (currency: string) => void;
}

export function ChangeSheet({
  open,
  distribution,
  errors,
  eligibleCurrencies,
  changeTotalBase,
  distributedBaseAmount,
  base,
  onClose,
  onChange,
  onAdd,
  onRemove,
}: ChangeSheetProps) {
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);
  const entries = Object.entries(distribution);
  // The totals box must not read as "done" while a per-currency split is
  // invalid — the footer would be saying the opposite at the same time.
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      <Stack
        gap={1.25}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
        >
          <Typography variant="caption" color="text.secondary">
            REPARTIR CAMBIO
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {changeTotalBase.toFixed(2)} {base} a dar
          </Typography>
        </Stack>

        {entries.map(([currency, amount]) => (
          <Stack key={currency} gap={0.25}>
            <Stack direction="row" gap={1} alignItems="center">
              <Chip label={currency} size="small" variant="outlined" />
              <SelectableTextField
                size="small"
                value={amount || ""}
                onChange={(event) =>
                  onChange(currency, parseFloat(event.target.value) || 0)
                }
                inputProps={{ inputMode: "decimal" }}
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": { minHeight: 44 },
                }}
                error={Boolean(errors[currency])}
              />
              <IconButton
                size="small"
                onClick={() => onRemove(currency)}
                aria-label={`Quitar cambio en ${currency}`}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            {errors[currency] && (
              <Typography variant="caption" color="error" ml={1}>
                {errors[currency]}
              </Typography>
            )}
          </Stack>
        ))}

        {eligibleCurrencies.length > 0 && (
          <>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={(event) =>
                eligibleCurrencies.length === 1
                  ? onAdd(eligibleCurrencies[0])
                  : setAddAnchor(event.currentTarget)
              }
              sx={{
                textTransform: "none",
                alignSelf: "flex-start",
                minHeight: 44,
              }}
            >
              Dar cambio en otra moneda
            </Button>
            <Menu
              anchorEl={addAnchor}
              open={Boolean(addAnchor)}
              onClose={() => setAddAnchor(null)}
            >
              {eligibleCurrencies.map((currency) => (
                <MenuItem
                  key={currency}
                  onClick={() => {
                    onAdd(currency);
                    setAddAnchor(null);
                  }}
                >
                  {currency}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ p: 1.25, borderRadius: 2, bgcolor: "action.hover" }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            color={hasErrors ? "error.main" : "text.primary"}
          >
            Repartido
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            color={hasErrors ? "error.main" : "text.primary"}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {distributedBaseAmount.toFixed(2)} / {changeTotalBase.toFixed(2)}
          </Typography>
        </Stack>

        <Button variant="contained" onClick={onClose} sx={{ minHeight: 48 }}>
          Listo
        </Button>
      </Stack>
    </Drawer>
  );
}
