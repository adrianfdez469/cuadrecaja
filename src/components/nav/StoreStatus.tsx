"use client";

import {
  ButtonBase,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { IStoreStatus } from "@/hooks/useStoreStatus";
import { SyncStatusLine } from "@/components/nav/SyncStatusLine";
import { touch } from "@/theme";

interface StoreStatusProps {
  nombre: string;
  /** Second line: what is wrong right now, or nothing at all. */
  status?: IStoreStatus;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Which store you are ringing up for, and whether it can reach the server.
 *
 * The store name and the connection state used to live apart — the name in the
 * top bar, the connection as a green «●ON» pill inside the POS toolbar, next to
 * a period badge. That put a permanent, always-green indicator in the one place
 * a cashier looks at constantly, so it stopped being read at all.
 *
 * Here the second line appears only when there is something to say: no
 * connection, or sales still waiting to go up. Silence means everything is fine,
 * which is the state it is in almost always — and it is what lets the line be
 * loud when it does appear (see `.agents/designs/estado-sin-conexion.md`).
 */
export function StoreStatus({
  nombre,
  status,
  onClick,
  disabled,
}: StoreStatusProps) {
  const theme = useTheme();
  // The only thing hanging off a breakpoint here: at 320px the two units do
  // not both fit on one line beside the store name.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <ButtonBase
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      sx={{
        flex: 1,
        minWidth: 0,
        // The block is a target that navigates to /home, and it was 21px tall
        // with one line and 37px with two — under the floor in both states.
        // Its parent centres it, so it takes the height of its text unless it
        // is told otherwise. The Toolbar is 56/64px, so this costs nothing.
        minHeight: touch.min,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        px: 0.5,
        py: 0.25,
        borderRadius: 1,
        textAlign: "left",
      }}
    >
      <Box sx={{ width: "100%", minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 600,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {nombre}
        </Typography>
        {status && (
          <SyncStatusLine status={status} abbreviatePending={isMobile} />
        )}
      </Box>
    </ButtonBase>
  );
}
