"use client";

import { Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { touch } from "@/theme";
import { CLIENTES_COPY, CLIENTES_DOM } from "@/constants/clientes";

/**
 * The band both surfaces show when the results came from the cache instead of the server.
 *
 * The copy names "the last time it could be consulted" on purpose: without a connection the
 * balance is a photograph, not the live figure (ADR 0115). The icon is an element child, so
 * the notice's OWN text stays exactly `CLIENTES_COPY.selectorDesdeCache`.
 */
export function ClienteCacheNotice({ sx }: Readonly<{ sx?: SxProps<Theme> }>) {
  return (
    <Typography
      variant="body2"
      className={CLIENTES_DOM.cacheNotice}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        minHeight: touch.min,
        px: 2,
        py: 1,
        color: "semantic.sync.offline.main",
        bgcolor: "semantic.sync.offline.surface",
        ...sx,
      }}
    >
      <CloudOffIcon fontSize="small" />
      {CLIENTES_COPY.selectorDesdeCache}
    </Typography>
  );
}

export default ClienteCacheNotice;
