"use client";
import React from "react";
import { Box } from "@mui/material";
import { ICierrePeriodo } from "@/types/ICierre";
import { formatDate } from "@/utils/formatters";

interface Props {
  periodo: ICierrePeriodo | null;
  isMobile: boolean;
}

export default function PeriodoBadge({ periodo, isMobile }: Props) {
  if (!periodo?.fechaInicio) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "primary.main",
        color: "white",
        px: 2,
        py: 0.5,
        borderRadius: "20px",
        fontSize: "0.875rem",
        fontWeight: 600,
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.8)",
        }}
      />
      {!isMobile && <>Período:</>}
      {formatDate(periodo.fechaInicio)}
    </Box>
  );
}
