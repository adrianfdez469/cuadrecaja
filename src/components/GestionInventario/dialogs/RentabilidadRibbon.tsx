"use client";

import { Box, Typography, alpha } from "@mui/material";

interface Props {
  costoBase: number;
  precioBase: number;
}

export function RentabilidadRibbon({ costoBase, precioBase }: Props) {
  if (costoBase <= 0 || precioBase <= 0) return null;

  const rentabilidad = ((precioBase - costoBase) / costoBase) * 100;
  const tone =
    rentabilidad > 0 ? "success" : rentabilidad < 0 ? "error" : "warning";

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={1.5}
      py={0.5}
      borderRadius={1}
      sx={{ bgcolor: (t) => alpha(t.palette[tone].main, 0.15) }}
    >
      <Typography variant="caption" color={`${tone}.main`} fontWeight={600}>
        Rentabilidad
      </Typography>
      <Typography variant="body2" color={`${tone}.main`} fontWeight={700}>
        {rentabilidad.toFixed(1)}%
      </Typography>
    </Box>
  );
}
