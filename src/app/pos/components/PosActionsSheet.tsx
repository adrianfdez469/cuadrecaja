"use client";

import { memo, type ReactNode } from "react";
import {
  Box,
  ButtonBase,
  CircularProgress,
  Drawer,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import FlagIcon from "@mui/icons-material/Flag";
import UndoIcon from "@mui/icons-material/Undo";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { usePosActionsController } from "@/hooks/usePosActionsController";
import { shape, touch } from "@/theme";

interface PosActionsSheetProps {
  open: boolean;
  onClose: () => void;
  onSync: () => void;
  onMySales: () => void;
  onStartingPoint: () => void;
  onSaleReturn?: () => void;
  onPrintQueue?: () => void;
  onRefresh: () => Promise<void>;
}

/**
 * The POS's own actions, named.
 *
 * They used to be seven bare icons crammed into one row — sync, sync-off,
 * flag, undo, register, printer — with nothing to say what any of them did or
 * what state it was in, and at 430px the row simply ran off the screen. Three
 * of them measured 30×30 against a 44px floor.
 *
 * Here each one gets its name, a line of its own state, and a 64px row. What
 * belongs to the app (navigation, store, alerts, user) stays in the bar at the
 * very top; this sheet is only what belongs to the point of sale, which is why
 * it opens from the work row and not from the app bar.
 */

const SHEET_PAPER_SX = {
  borderTopLeftRadius: `${shape.radius.lg}px`,
  borderTopRightRadius: `${shape.radius.lg}px`,
  pb: "calc(8px + env(safe-area-inset-bottom))",
} as const;

const HEAD_SX = {
  px: 2,
  pt: 2,
  pb: 1.5,
  color: "text.secondary",
} as const;

const ROW_SX = {
  width: "100%",
  minHeight: 64,
  px: 2,
  gap: 1.75,
  justifyContent: "flex-start",
  textAlign: "left",
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

const ICON_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "semantic.hue.neutral.main",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

function Row({
  icon,
  title,
  detail,
  right,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  right?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <ButtonBase sx={ROW_SX} onClick={onClick} component="div">
      <Box sx={ICON_SX}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" fontWeight={600} lineHeight={1.25}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </Box>
      {right}
    </ButtonBase>
  );
}

function PosActionsSheet({
  open,
  onClose,
  onSync,
  onMySales,
  onStartingPoint,
  onSaleReturn,
  onPrintQueue,
  onRefresh,
}: PosActionsSheetProps) {
  const {
    salesCount,
    pending,
    pendingTickets,
    refreshing,
    handleRefresh,
    hasAlternativas,
    showCurrencies,
    toggleCurrencies,
    showSaleReceipt,
    toggleShowSaleReceipt,
  } = usePosActionsController(onRefresh);

  const run = (action?: () => void) => () => {
    onClose();
    action?.();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: SHEET_PAPER_SX }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={HEAD_SX}
        component="div"
      >
        <Typography variant="caption" fontWeight={700} letterSpacing=".08em">
          ACCIONES DEL POS
        </Typography>
        <Typography variant="caption">
          {salesCount} {salesCount === 1 ? "venta" : "ventas"} hoy
        </Typography>
      </Stack>

      <Row
        icon={pending > 0 ? <SyncProblemIcon /> : <SyncAltIcon />}
        title="Sincronizar"
        detail={
          pending > 0
            ? `${pending} ${pending === 1 ? "venta" : "ventas"} sin subir`
            : "Todo subido"
        }
        onClick={run(onSync)}
      />

      <Row
        icon={<PointOfSaleIcon />}
        title="Mis ventas"
        detail="Lo vendido en este turno y el estado de la caja"
        onClick={run(onMySales)}
      />

      <Row
        icon={<FlagIcon />}
        title="Punto de partida"
        detail="Con cuánto se abrió la caja"
        onClick={run(onStartingPoint)}
      />

      {onSaleReturn && (
        <Row
          icon={<UndoIcon />}
          title="Devolución de venta"
          detail="Productos devueltos por el cliente"
          onClick={run(onSaleReturn)}
        />
      )}

      {onPrintQueue && (
        <Row
          icon={<PrintIcon />}
          title="Impresión"
          detail={
            pendingTickets > 0
              ? `${pendingTickets} ${pendingTickets === 1 ? "ticket pendiente" : "tickets pendientes"}`
              : "Cola de tickets e impresora"
          }
          onClick={run(onPrintQueue)}
        />
      )}

      <Row
        icon={<RefreshIcon />}
        title="Actualizar catálogo"
        detail="Vuelve a bajar productos, precios y existencias"
        right={refreshing ? <CircularProgress size={20} /> : undefined}
        onClick={() => {
          void handleRefresh();
        }}
      />

      {hasAlternativas && (
        <Row
          icon={<CurrencyExchangeIcon />}
          title="Precios en otras monedas"
          detail="Muestra las equivalencias bajo cada precio"
          right={
            <Switch
              checked={showCurrencies}
              onChange={toggleCurrencies}
              inputProps={{ "aria-label": "Precios en otras monedas" }}
            />
          }
          onClick={toggleCurrencies}
        />
      )}

      <Row
        icon={<FactCheckOutlinedIcon />}
        title="Pantalla de cobro registrado"
        detail="Muestra el cambio y «Nueva venta» al terminar en vez de saltarla"
        right={
          <Switch
            checked={showSaleReceipt}
            onChange={toggleShowSaleReceipt}
            inputProps={{ "aria-label": "Pantalla de cobro registrado" }}
          />
        }
        onClick={toggleShowSaleReceipt}
      />
    </Drawer>
  );
}

export default memo(PosActionsSheet);
