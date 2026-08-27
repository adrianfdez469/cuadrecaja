"use client";

import { Box, Button, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { BigFigure } from "@/app/pos/components/checkout/BigFigure";
import type { SaleReceipt } from "@/app/pos/components/checkout/saleReceipt";
import { useAppContext } from "@/context/AppContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSalesStore } from "@/store/salesStore";
import { convertFromBase } from "@/lib/currency";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { formatAmount } from "@/utils/numberFormat";
import { shape, touch } from "@/theme";

interface SaleDoneViewProps {
  receipt: SaleReceipt;
  /** Back to selling. The primary action, where «Confirmar cobro» just was. */
  onNewSale: () => void;
  /** Reprints the ticket. Absent where printing is not set up or allowed. */
  onPrint?: () => void;
}

/**
 * The close of the sale. The first thing read is the change, not a thank-you:
 * it is the only thing the cashier still has to do with their hands. Under it,
 * what was charged and how; and if the server is out of reach, the fact that
 * the sale is safe and waiting, said here and not in a toast.
 *
 * «Nueva venta» sits exactly where «Confirmar cobro» was, so the thumb does
 * not move between sales.
 */

const ROOT_SX = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
} as const;

const BAR_SX = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  px: 1.25,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

const CLOSE_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.primary",
} as const;

const TITLE_SX = {
  fontSize: "0.9375rem",
  fontWeight: 700,
  lineHeight: 1.25,
} as const;
const SUBTITLE_SX = {
  fontSize: "0.6875rem",
  lineHeight: 1.3,
  color: "text.secondary",
} as const;

const BODY_SX = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 1.75,
  px: 3,
  py: 3,
  textAlign: "center",
} as const;

const TICK_SX = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  bgcolor: "semantic.hue.positive.main",
  color: "semantic.hue.positive.contrast",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& svg": { fontSize: 40 },
} as const;

const CHARGED_SX = {
  fontSize: "1.375rem",
  fontWeight: 700,
  lineHeight: 1.25,
  fontVariantNumeric: "tabular-nums",
} as const;

const DETAIL_SX = {
  fontSize: "0.8125rem",
  lineHeight: 1.45,
  color: "text.secondary",
  fontVariantNumeric: "tabular-nums",
} as const;

const NOTE_SX = {
  fontSize: "0.78125rem",
  lineHeight: 1.45,
  color: "text.secondary",
  maxWidth: "30ch",
} as const;

const ACTIONS_SX = {
  flex: "0 0 auto",
  px: 2,
  pt: 1,
  pb: "calc(18px + env(safe-area-inset-bottom))",
  display: "flex",
  flexDirection: "column",
  gap: 1.125,
} as const;

const PRIMARY_SX = {
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  fontSize: "1.0625rem",
  fontWeight: 700,
} as const;

const SECONDARY_SX = {
  minHeight: 52,
  borderRadius: `${shape.radius.md}px`,
  borderWidth: 1.5,
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "text.primary",
  borderColor: "divider",
  "&:hover": { borderWidth: 1.5, borderColor: "text.secondary" },
} as const;

const methodTitle = (kind: "cash" | "transfer", currency: string) =>
  `${kind === "cash" ? "Efectivo" : "Transferencia"} ${currency}`;

const timeOf = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function SaleDoneView({
  receipt,
  onNewSale,
  onPrint,
}: SaleDoneViewProps) {
  const { user, tasasVigentes } = useAppContext();
  const { isOnline } = useNetworkStatus();
  const pendingSales = useSalesStore(
    (state) => state.sales.filter((sale) => !sale.synced).length,
  );

  const { amountBase, base, tipTotalBase, change, lines, confirmedAt } =
    receipt;

  const changeEntries = Object.entries(change).filter(
    ([, amount]) => amount > 0,
  );
  const [mainChangeCurrency, mainChangeAmount] = changeEntries[0] ?? [];
  const otherChange = changeEntries
    .slice(1)
    .map(([currency, amount]) => `+ ${formatMontoEnMoneda(amount, currency)}`);

  // «Efectivo CUP · recibido 2.900.000,00 de 2.893.000,00 · vuelto entregado
  // en CUP · propina 400,00 USD» — each piece only when it applies.
  const detailParts: string[] = lines.map((line) => {
    const received = `${methodTitle(line.kind, line.currency)} · recibido ${formatAmount(line.amount)}`;
    if (lines.length > 1) return received;
    const owed =
      line.currency === base
        ? amountBase
        : convertFromBase(amountBase, line.currency, tasasVigentes, base);
    return `${received} de ${formatAmount(owed)}`;
  });
  if (changeEntries.length > 0) {
    detailParts.push(
      `vuelto entregado en ${changeEntries.map(([currency]) => currency).join(" y ")}`,
    );
  } else {
    detailParts.push("pago exacto");
  }
  if (tipTotalBase > 0) {
    detailParts.push(`propina ${formatMontoEnMoneda(tipTotalBase, base)}`);
  }

  const subtitle = [timeOf(confirmedAt), user?.nombre]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box sx={ROOT_SX}>
      <Box sx={BAR_SX}>
        <IconButton aria-label="Cerrar" onClick={onNewSale} sx={CLOSE_SX}>
          <CloseIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, pl: 0.25 }}>
          <Typography noWrap sx={TITLE_SX}>
            Cobro registrado
          </Typography>
          <Typography noWrap sx={SUBTITLE_SX}>
            {subtitle}
          </Typography>
        </Box>
      </Box>

      <Box sx={BODY_SX} role="status">
        <Box sx={TICK_SX}>
          <CheckIcon />
        </Box>

        <Typography component="h3" sx={CHARGED_SX}>
          Cobrado {formatMontoEnMoneda(amountBase, base)}
        </Typography>

        {mainChangeCurrency && (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <BigFigure
              amount={mainChangeAmount}
              currency={mainChangeCurrency}
              codeSuffix="de vuelto"
              conversions={otherChange.length > 0 ? otherChange : undefined}
            />
          </Box>
        )}

        <Typography sx={DETAIL_SX}>{detailParts.join(" · ")}</Typography>

        {!isOnline && (
          <Typography sx={NOTE_SX}>
            Sin conexión: la venta queda guardada y se sube al sincronizar.{" "}
            {pendingSales}{" "}
            {pendingSales === 1 ? "venta pendiente" : "ventas pendientes"}.
          </Typography>
        )}
      </Box>

      <Box sx={ACTIONS_SX}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          onClick={onNewSale}
          sx={PRIMARY_SX}
        >
          Nueva venta
        </Button>
        {onPrint && (
          <Button
            variant="outlined"
            fullWidth
            onClick={onPrint}
            sx={SECONDARY_SX}
          >
            Imprimir
          </Button>
        )}
      </Box>
    </Box>
  );
}
