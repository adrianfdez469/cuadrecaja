"use client";

import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type { IStoreStatus } from "@/hooks/useStoreStatus";

/**
 * The connection state, said the same way in the two places that say it: under
 * the store name in the top bar, and at the head of the basket panel.
 * See `.agents/designs/estado-sin-conexion.md`.
 *
 * Two independent units, never one string joined by « · ». They are different
 * claims — «this till is not talking to the server» and «these sales are only
 * here» — and the second can be true on its own, with a perfectly good
 * connection, which is the case the single grey sentence used to hide.
 *
 * Same ink for both: a queue of sales is not a failure, it is the design
 * working. What tells them apart is the glyph and the word, which is also what
 * keeps the state legible without relying on colour alone.
 */

const UNIT_SX = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  minWidth: 0,
} as const;

// In front of the text, not behind it: the row ellipsizes from the right, so
// a trailing glyph is the first thing a narrow bar would eat.
const ICON_SX = { fontSize: "0.875rem", flexShrink: 0 } as const;

// 12px/600, up from the 11px/400 grey it replaces. Costs 1.3px of height in a
// 56px Toolbar and buys the step from «rubric» to «statement».
const TEXT_SX = {
  fontSize: "0.75rem",
  fontWeight: 600,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

interface SyncStatusLineProps {
  status: IStoreStatus;
  /** `row` in the top bar, where the units share a line; `column` in the panel. */
  direction?: "row" | "column";
  /**
   * The top bar at 320px, and only with both units up: the queue drops its
   * words and keeps its glyph and its number. What gets dropped is the label,
   * never the explanation — a lone `3` beside an upload cloud reads, a clipped
   * «Sin» does not.
   */
  abbreviatePending?: boolean;
  sx?: SxProps<Theme>;
}

export function SyncStatusLine({
  status,
  direction = "row",
  abbreviatePending = false,
  sx,
}: Readonly<SyncStatusLineProps>) {
  const { offline, pendingSales } = status;
  const pendingLabel = `${pendingSales} ventas sin subir`;
  const abbreviate = abbreviatePending && offline && pendingSales > 0;

  return (
    <Box
      // Polite: the cashier is told, without being interrupted mid-sale.
      role="status"
      sx={{
        display: "flex",
        flexDirection: direction,
        gap: direction === "row" ? 1 : 0,
        alignItems: direction === "row" ? "center" : "flex-end",
        minWidth: 0,
        ...sx,
      }}
    >
      {offline && (
        <Box sx={UNIT_SX}>
          <CloudOffIcon
            sx={{ ...ICON_SX, color: "semantic.sync.offline.main" }}
          />
          <Typography sx={{ ...TEXT_SX, color: "semantic.sync.offline.main" }}>
            Sin conexión
          </Typography>
        </Box>
      )}

      {pendingSales > 0 && (
        // The number never goes mute: abbreviated or not, the unit carries the
        // whole sentence for a screen reader and for the pointer.
        <Box sx={UNIT_SX} title={pendingLabel} aria-label={pendingLabel}>
          <CloudUploadIcon
            sx={{ ...ICON_SX, color: "semantic.sync.pending.main" }}
          />
          <Typography sx={{ ...TEXT_SX, color: "semantic.sync.pending.main" }}>
            {abbreviate ? pendingSales : `${pendingSales} sin subir`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
