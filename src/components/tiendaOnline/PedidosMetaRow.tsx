"use client";

import { Button, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderTime,
} from "@/components/tiendaOnline/orderPresentation";
import { touch } from "@/theme/tokens";

export interface PedidosMetaRowProps {
  lastLoadedAt: Date;
  online: boolean;
  busy: boolean;
  autoRefreshPaused: boolean;
  onRefresh: () => void;
}

/**
 * When the list was last loaded, and the only way to load it again by hand.
 *
 * The clock does NOT tick: it shows the absolute time of the last successful
 * load, not «hace 3 minutos» — a relative text needs a timer of its own just to
 * rewrite itself, and at 14:32 the merchant knows perfectly well how long ago
 * that was.
 *
 * At most ONE qualifier follows the time: no connection wins over the paused
 * automatic refresh, because it is the one that also explains the disabled
 * button next to it.
 *
 * The button never spins. It waits DISABLED: the row already says the time of
 * the last load and the list is still on screen, so there is nothing to announce.
 */
export function PedidosMetaRow({
  lastLoadedAt,
  online,
  busy,
  autoRefreshPaused,
  onRefresh,
}: Readonly<PedidosMetaRowProps>) {
  const qualifier = !online
    ? TIENDA_ONLINE_ORDER_COPY.sinConexion
    : autoRefreshPaused
      ? TIENDA_ONLINE_ORDER_COPY.autoRefreshPaused
      : null;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      alignItems="center"
      justifyContent="space-between"
      sx={{ flexWrap: "wrap" }}
    >
      <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
        {`${TIENDA_ONLINE_ORDER_COPY.updatedAtPrefix}${formatOrderTime(
          lastLoadedAt.toISOString(),
        )}`}
        {qualifier !== null && (
          <Typography
            component="span"
            variant="body2"
            sx={{
              color: online
                ? "semantic.text.secondary"
                : "semantic.hue.caution.main",
            }}
          >
            {` · ${qualifier}`}
          </Typography>
        )}
      </Typography>

      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={onRefresh}
        disabled={!online || busy}
        sx={{ minHeight: touch.min }}
      >
        {TIENDA_ONLINE_ORDER_COPY.actualizar}
      </Button>
    </Stack>
  );
}

export default PedidosMetaRow;
