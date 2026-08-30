"use client";

import type { SxProps, Theme } from "@mui/material/styles";
import { Box } from "@mui/material";

import { BrandMark, Wordmark } from "@/components/brand";

interface AuthWordmarkProps {
  sx?: SxProps<Theme>;
}

/**
 * Centered wordmark for account flows (login entrance excluded).
 *
 * Brand icon (34px) + "Cuadre de Caja" (17px, 700 weight) stacked vertically,
 * centered. Used as the header for password reset, account activations, and
 * related flows.
 */
export function AuthWordmark({ sx }: AuthWordmarkProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        ...sx,
      }}
    >
      <BrandMark size={34} boxed />
      <Wordmark size={17} />
    </Box>
  );
}
