"use client";

import { FC, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatCurrency } from "@/utils/formatters";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import {
  fetchCashBreakdown,
  saveCashBreakdown,
} from "@/services/cierrePeriodService";
import { IBillCount } from "@/schemas/billBreakdown";

interface Props {
  open: boolean;
  onClose: () => void;
  expectedCash: number;
  tiendaId: string;
  cierreId: string;
  onBreakdownChange: (total: number | null) => void;
}

function itemsToCountMap(items: IBillCount[]): Record<number, number> {
  return items.reduce<Record<number, number>>(
    (acc, { denomination, count }) => {
      acc[denomination] = count;
      return acc;
    },
    {},
  );
}

function countMapToItems(counts: Record<number, number>): IBillCount[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([denomination, count]) => ({
      denomination: Number(denomination),
      count,
    }));
}

const CashVerificationDialog: FC<Props> = ({
  open,
  onClose,
  expectedCash,
  tiendaId,
  cierreId,
  onBreakdownChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [resetKey, setResetKey] = useState(0);
  const [initialCounts, setInitialCounts] = useState<Record<number, number>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCashBreakdown(tiendaId, cierreId)
      .then((saved) => {
        if (saved?.items?.length) {
          const counts = itemsToCountMap(saved.items);
          setInitialCounts(counts);
          onBreakdownChange(saved.total);
        } else {
          setInitialCounts({});
        }
        setResetKey((k) => k + 1);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cierreId]);

  const handleCounts = (counts: Record<number, number>, total: number) => {
    onBreakdownChange(total > 0 ? total : null);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveCashBreakdown(
        tiendaId,
        cierreId,
        DEFAULT_CURRENCY,
        countMapToItems(counts),
        total,
      );
    }, 800);
  };

  const handleClose = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
        Verificar efectivo en caja
        {isMobile && (
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box py={3} display="flex" justifyContent="center">
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total en efectivo del período
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatCurrency(expectedCash)}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Introduce la cantidad de cada billete para verificar el cuadre:
            </Typography>
            <BillBreakdownInput
              currency={DEFAULT_CURRENCY}
              targetAmount={expectedCash}
              onChange={() => {}}
              onCounts={handleCounts}
              initialCounts={initialCounts}
              resetKey={resetKey}
              overLabel="Excedente"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          variant="outlined"
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CashVerificationDialog;
