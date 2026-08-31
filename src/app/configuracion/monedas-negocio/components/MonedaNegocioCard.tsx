"use client";

import { Box, Button, Stack, Switch, Typography } from "@mui/material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import { CurrencyCode } from "./CurrencyCode";
import { StatusPill } from "@/components/StatusPill";
import type { INegocioMoneda } from "@/schemas/moneda";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}

function ToggleRow({ label, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ minHeight: 52, borderTop: 1, borderColor: "divider" }}
    >
      <Typography
        variant="body2"
        color={disabled ? "text.secondary" : "text.primary"}
      >
        {label}
      </Typography>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </Stack>
  );
}

interface Props {
  code: string;
  base?: boolean;
  moneda?: INegocioMoneda;
  onToggle?: (campo: "admiteEfectivo" | "admiteTransferencia") => void;
  onUsarComoBase?: () => void;
  onDeshabilitar?: () => void;
}

/** One business currency, as a card — `rediseno/monedas-negocio-movil.html`: labeled toggle rows, full-width actions. */
export function MonedaNegocioCard({
  code,
  base = false,
  moneda,
  onToggle,
  onUsarComoBase,
  onDeshabilitar,
}: Props) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <CurrencyCode code={code} base={base} />
        {base && <StatusPill label="Base" hue="accent" />}
      </Stack>

      <Box>
        <ToggleRow
          label="Efectivo"
          checked={base ? true : (moneda?.admiteEfectivo ?? false)}
          disabled={base}
          onChange={() => onToggle?.("admiteEfectivo")}
        />
        <ToggleRow
          label="Transferencia"
          checked={base ? true : (moneda?.admiteTransferencia ?? false)}
          disabled={base}
          onChange={() => onToggle?.("admiteTransferencia")}
        />
      </Box>

      {!base && (
        <Stack
          spacing={1.25}
          sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}
        >
          <Button
            variant="outlined"
            startIcon={<CurrencyExchangeIcon />}
            onClick={onUsarComoBase}
            fullWidth
          >
            Usar como base
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={onDeshabilitar}
            fullWidth
          >
            Deshabilitar
          </Button>
        </Stack>
      )}
    </Box>
  );
}
