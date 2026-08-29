"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axiosClient from "@/lib/axiosClient";

interface VencidosBannerProps {
  tiendaId: string;
  /** Filtra la tabla de abajo a "Vencidos" en vez de navegar a otra pantalla. */
  onVerVencidos: () => void;
}

/**
 * Un solo canal para lo que ya venció, no dos (banner expandible + fila en la
 * tabla). "Próximos a vencer" no tiene su propio banner acá: ya es un valor
 * del filtro de Vencimiento debajo, y duplicarlo era el mismo aviso dos veces.
 */
export function VencidosBanner({
  tiendaId,
  onVerVencidos,
}: VencidosBannerProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!tiendaId) return;
    axiosClient
      .get<{ vencidos: unknown[] }>(
        `/api/productos_tienda/expirando?tiendaId=${tiendaId}`,
      )
      .then((res) => setCount(res.data.vencidos.length))
      .catch(() => {});
  }, [tiendaId]);

  if (count === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        mb: 2,
        bgcolor: "semantic.hue.negative.surface",
        borderRadius: "12px",
      }}
    >
      <ErrorOutlineIcon sx={{ color: "semantic.hue.negative.main" }} />
      <Typography sx={{ flex: 1, fontSize: "0.9375rem" }}>
        <Typography component="span" fontWeight={700}>
          Vencidos
        </Typography>{" "}
        ({count})
      </Typography>
      <Typography
        component="button"
        onClick={onVerVencidos}
        sx={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: "primary.main",
          bgcolor: "transparent",
          border: "none",
          cursor: "pointer",
          minHeight: 44,
          px: 1,
        }}
      >
        Ver productos
      </Typography>
    </Box>
  );
}
