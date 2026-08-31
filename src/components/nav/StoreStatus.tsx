"use client";

import { ButtonBase, Box, Typography } from "@mui/material";

interface StoreStatusProps {
  nombre: string;
  /** Second line: what is wrong right now, or nothing at all. */
  status?: string;
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
 * which is the state it is in almost always.
 */
export function StoreStatus({
  nombre,
  status,
  onClick,
  disabled,
}: StoreStatusProps) {
  return (
    <ButtonBase
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      sx={{
        flex: 1,
        minWidth: 0,
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
          <Typography
            sx={{
              fontSize: "0.6875rem",
              lineHeight: 1.3,
              color: "text.secondary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {status}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
