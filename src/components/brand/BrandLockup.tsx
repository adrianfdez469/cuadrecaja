"use client";

import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

import { BrandMark } from "./BrandMark";
import { Wordmark } from "./Wordmark";

interface BrandLockupProps {
  /** Side of the mark's container, in px. */
  markSize?: number;
  /** Font size of the name, in px. */
  wordSize?: number;
  tone?: "default" | "inverse";
  sx?: SxProps<Theme>;
}

/**
 * Mark in its container, then the name.
 *
 * The public face of the product: the landing and the login are the only two
 * places where the name is written out. Inside the app the top bar carries the
 * bare mark instead, because there the store name is the data that matters.
 */
export function BrandLockup({
  markSize = 36,
  wordSize = 17,
  tone = "default",
  sx,
}: BrandLockupProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ...sx }}>
      <BrandMark size={markSize} boxed />
      <Wordmark size={wordSize} tone={tone} />
    </Box>
  );
}
