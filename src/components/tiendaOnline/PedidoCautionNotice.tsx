"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { shape } from "@/theme/tokens";

export interface PedidoCautionNoticeProps {
  /** Bold first line. Omitted when the notice is a single sentence. */
  title?: string;
  children: ReactNode;
}

/**
 * The tinted block the two order screens use for the three things that are worth
 * noticing and are not failures: orders with no local, lines that do not match
 * the stored rate, and a total that is still partial.
 *
 * `caution` and not `info`, and not `negative`: nothing is broken and nothing
 * was lost — something is incomplete, which is what this hue means here.
 *
 * It carries NO dismiss control, on purpose: every fact it states is still true
 * after somebody closes it, and it disappears when the fact does.
 */
export function PedidoCautionNotice({
  title,
  children,
}: Readonly<PedidoCautionNoticeProps>) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: "semantic.hue.caution.surface",
        color: "semantic.hue.caution.main",
      }}
    >
      {title && (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      )}
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

export default PedidoCautionNotice;
