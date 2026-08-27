"use client";

import { Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

/**
 * «Catálogo · 30 productos», «En la venta · 5 artículos».
 *
 * The small line that names a list in the POS. The redesign draws it as
 * 10px monospace tracked out .14em — not the 12px sans eyebrow of the
 * management screens (`SectionLabel`): here it sits between 60px rows of
 * 14.5px names and has to read as a caption of the list, not as a heading
 * competing with the first product.
 */

const HEADING_SX = {
  display: "block",
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: "0.625rem",
  fontWeight: 400,
  lineHeight: 1.4,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "text.secondary",
  m: 0,
  pt: 0.75,
  pb: 1,
  px: 0.25,
} as const;

interface PosListHeadingProps {
  children: string;
  sx?: SxProps<Theme>;
}

export function PosListHeading({ children, sx }: PosListHeadingProps) {
  return (
    // A paragraph, not a div: the rows under it are divs, and a row's «no
    // rule on the first line» is written as `:first-of-type`.
    <Typography component="p" sx={sx ? { ...HEADING_SX, ...sx } : HEADING_SX}>
      {children}
    </Typography>
  );
}
