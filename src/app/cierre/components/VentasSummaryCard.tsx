"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { formatCurrency } from "@/utils/formatters";

export interface VentasSummaryRow {
  id: string;
  label: string;
  value: number;
  icon: ReactNode;
}

interface Props {
  title: string;
  rows: VentasSummaryRow[];
}

/**
 * "Resumen de Ventas por Usuario" / "por Tipo" — a small list card, reused for
 * both since they're the same shape: an icon, a label and a bold total.
 */
export default function VentasSummaryCard({ title, rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <Typography
        sx={{ px: 2.5, py: 2.25, fontSize: "1.0625rem", fontWeight: 700 }}
      >
        {title}
      </Typography>
      {rows.map((row, i) => (
        <Box
          key={row.id}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            minHeight: 56,
            px: 2.5,
            borderTop: i > 0 ? 1 : 0,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              minWidth: 0,
            }}
          >
            <Box
              sx={{ display: "flex", flex: "0 0 auto", color: "text.disabled" }}
            >
              {row.icon}
            </Box>
            <Typography
              sx={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.label}
            </Typography>
          </Box>
          <Typography
            sx={{
              flex: "0 0 auto",
              fontSize: "1.0625rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(row.value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
