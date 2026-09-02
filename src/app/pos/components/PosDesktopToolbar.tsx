"use client";

import { memo } from "react";
import {
  Badge,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
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

/**
 * `PosActionsSheet`'s options, redrawn for a mouse: where there is room
 * beside the search field, a sheet that hides seven actions behind one tap
 * is a worse fit than the row `InventarioFiltersBar` already uses for its
 * own desktop toolbar — named actions become loose icon buttons, and the
 * ones a phone folds into "more actions" simply have room to stand on their
 * own. Same controller as the sheet, so the badge counts, the refresh
 * spinner and the currency toggle never drift between the two.
 */

const BUTTON_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "background.paper",
  color: "text.secondary",
} as const;

const ACTIVE_BUTTON_SX = {
  ...BUTTON_SX,
  borderColor: "primary.main",
  color: "primary.main",
  bgcolor: "semantic.hue.accent.surface",
} as const;

const BADGE_SX = {
  "& .MuiBadge-badge": {
    fontSize: "0.625rem",
    fontWeight: 700,
    minWidth: 16,
    height: 16,
    padding: "0 3px",
  },
} as const;

interface PosDesktopToolbarProps {
  onSync: () => void;
  onMySales: () => void;
  onStartingPoint: () => void;
  onSaleReturn?: () => void;
  onPrintQueue?: () => void;
  onRefresh: () => Promise<void>;
}

function PosDesktopToolbarComponent({
  onSync,
  onMySales,
  onStartingPoint,
  onSaleReturn,
  onPrintQueue,
  onRefresh,
}: PosDesktopToolbarProps) {
  const {
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

  return (
    <Stack direction="row" spacing={1} data-tour="pos-toolbar-actions">
      <Tooltip title={pending > 0 ? `${pending} sin subir` : "Sincronizar"}>
        <IconButton onClick={onSync} sx={BUTTON_SX}>
          <Badge badgeContent={pending} color="warning" sx={BADGE_SX}>
            {pending > 0 ? <SyncProblemIcon /> : <SyncAltIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title="Mis ventas">
        <IconButton onClick={onMySales} sx={BUTTON_SX}>
          <PointOfSaleIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Punto de partida">
        <IconButton onClick={onStartingPoint} sx={BUTTON_SX}>
          <FlagIcon />
        </IconButton>
      </Tooltip>

      {onSaleReturn && (
        <Tooltip title="Devolución de venta">
          <IconButton onClick={onSaleReturn} sx={BUTTON_SX}>
            <UndoIcon />
          </IconButton>
        </Tooltip>
      )}

      {onPrintQueue && (
        <Tooltip title="Impresión">
          <IconButton onClick={onPrintQueue} sx={BUTTON_SX}>
            <Badge badgeContent={pendingTickets} color="warning" sx={BADGE_SX}>
              <PrintIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Actualizar catálogo">
        <IconButton
          onClick={() => {
            void handleRefresh();
          }}
          disabled={refreshing}
          sx={BUTTON_SX}
        >
          {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
        </IconButton>
      </Tooltip>

      {hasAlternativas && (
        <Tooltip title="Precios en otras monedas">
          <IconButton
            onClick={toggleCurrencies}
            aria-pressed={showCurrencies}
            sx={showCurrencies ? ACTIVE_BUTTON_SX : BUTTON_SX}
          >
            <CurrencyExchangeIcon />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip
        title={
          showSaleReceipt
            ? "Mostrando la pantalla de cobro registrado"
            : "Mostrar pantalla de cobro registrado"
        }
      >
        <IconButton
          onClick={toggleShowSaleReceipt}
          aria-pressed={showSaleReceipt}
          sx={showSaleReceipt ? ACTIVE_BUTTON_SX : BUTTON_SX}
        >
          <FactCheckOutlinedIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

export const PosDesktopToolbar = memo(PosDesktopToolbarComponent);
