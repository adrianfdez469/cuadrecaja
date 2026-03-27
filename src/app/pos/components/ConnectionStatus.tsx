"use client";
import React from "react";
import { Box } from "@mui/material";
import { Sale } from "@/store/salesStore";

interface Props {
  sales: Sale[];
  isOnline: boolean;
}

export default function ConnectionStatus({ sales, isOnline }: Props) {
  const hasPendingOrSyncing = sales.some(
    (s) => s.syncState === "not_synced" || s.syncState === "syncing"
  );

  if (hasPendingOrSyncing) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        bgcolor: isOnline ? "success.main" : "warning.main",
        color: "white",
        px: 1.5,
        py: 0.5,
        borderRadius: "16px",
        fontSize: "0.75rem",
        fontWeight: 600,
        transition: "all 0.3s ease",
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.9)",
          animation: isOnline ? "none" : "pulse 2s infinite",
          "@keyframes pulse": {
            "0%": { opacity: 1 },
            "50%": { opacity: 0.5 },
            "100%": { opacity: 1 },
          },
        }}
      />
      {isOnline ? "ON" : "OFF"}
    </Box>
  );
}
