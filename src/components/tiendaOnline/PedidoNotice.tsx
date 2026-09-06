"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { shape } from "@/theme/tokens";

/** The three hues this block is painted in. `accent` is never one of them. */
export type PedidoNoticeHue = "caution" | "positive" | "negative";

export interface PedidoNoticeProps {
  /** Bold first line. Omitted when the notice is a single sentence. */
  title?: string;
  /**
   * `caution` by default, which is what the four F-011 notices ask for and why
   * their look does not change. F-012 needs `positive` for an accepted report
   * and `negative` for one that did not reach the online store.
   */
  hue?: PedidoNoticeHue;
  children: ReactNode;
}

/**
 * The tinted block the two order screens use for a fact worth noticing.
 *
 * It was `PedidoCautionNotice` until F-012 needed the other two hues: a
 * component named after one of them while painting green is a name that lies.
 * The shape is unchanged, and so is every existing call site, which takes the
 * default.
 *
 * It carries NO dismiss control, on purpose: every fact it states is still true
 * after somebody closes it, and it disappears when the fact does.
 */
export function PedidoNotice({
  title,
  hue = "caution",
  children,
}: Readonly<PedidoNoticeProps>) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: `semantic.hue.${hue}.surface`,
        color: `semantic.hue.${hue}.main`,
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

export default PedidoNotice;
