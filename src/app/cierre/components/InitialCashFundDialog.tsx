"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloseIcon from "@mui/icons-material/Close";
import MoneyField from "@/components/MoneyField";
import {
  fetchInitialCashFundHistory,
  saveInitialCashFund,
} from "@/services/cierrePeriodService";
import { IInitialCashFundEntry } from "@/schemas/initialCashFund";
import { INegocioMoneda } from "@/schemas/moneda";
import { formatDateTime, formatMontoEnMoneda } from "@/utils/formatters";

interface Props {
  open: boolean;
  tiendaId: string;
  cierreId: string;
  monedasActivas: INegocioMoneda[];
  onClose: () => void;
  onSaved: () => void;
}

export default function InitialCashFundDialog({
  open,
  tiendaId,
  cierreId,
  monedasActivas,
  onClose,
  onSaved,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [history, setHistory] = useState<IInitialCashFundEntry[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const monedasConEfectivo = monedasActivas.filter((m) => m.admiteEfectivo);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setHistoryOpen(false);
    fetchInitialCashFundHistory(tiendaId, cierreId)
      .then((entries) => {
        setHistory(entries);
        const current = entries[0]?.amounts ?? {};
        setAmounts(
          monedasConEfectivo.reduce<Record<string, string>>((acc, m) => {
            acc[m.monedaCode] = String(current[m.monedaCode] ?? 0);
            return acc;
          }, {}),
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tiendaId, cierreId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedAmounts = Object.fromEntries(
        Object.entries(amounts).map(([monedaCode, value]) => [
          monedaCode,
          Math.max(0, Number(value) || 0),
        ]),
      );
      await saveInitialCashFund(tiendaId, cierreId, parsedAmounts);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Fondo inicial de caja
        {isMobile && (
          <IconButton onClick={onClose} disabled={saving}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Efectivo con el que se abre la caja en cada moneda. Se puede ajustar
            en cualquier momento mientras el período siga abierto.
          </Typography>

          {monedasConEfectivo.map((m) => (
            <MoneyField
              key={m.monedaCode}
              label={`Fondo inicial (${m.monedaCode})`}
              value={amounts[m.monedaCode] ?? "0"}
              onChange={(e) =>
                setAmounts((prev) => ({
                  ...prev,
                  [m.monedaCode]: e.target.value,
                }))
              }
              currencySymbol={m.moneda?.simbolo ?? m.monedaCode}
              disabled={loading}
              fullWidth
            />
          ))}

          {history.length > 0 && (
            <Box>
              <Button
                size="small"
                endIcon={historyOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setHistoryOpen((v) => !v)}
              >
                Historial de cambios ({history.length})
              </Button>
              <Collapse in={historyOpen}>
                <Stack
                  spacing={1}
                  divider={<Divider flexItem />}
                  sx={{ mt: 1 }}
                >
                  {history.map((entry) => (
                    <Box key={entry.id}>
                      <Typography variant="caption" color="text.secondary">
                        {entry.createdByName ?? "Usuario"} —{" "}
                        {formatDateTime(entry.createdAt)}
                      </Typography>
                      <Typography variant="body2">
                        {Object.entries(entry.amounts)
                          .map(([monedaCode, amount]) =>
                            formatMontoEnMoneda(amount, monedaCode),
                          )
                          .join(" · ") || "Sin montos"}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={onClose}
          disabled={saving}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          fullWidth={isMobile}
          size={isMobile ? "large" : "medium"}
          sx={{ minHeight: isMobile ? 56 : undefined }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
