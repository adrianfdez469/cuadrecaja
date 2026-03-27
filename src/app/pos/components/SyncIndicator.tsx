"use client";
import React from "react";
import { Box, CircularProgress } from "@mui/material";
import { Sale } from "@/store/salesStore";

interface Props {
  sales: Sale[];
}

export default function SyncIndicator({ sales }: Props) {
  const pendingOrSyncing = sales.filter(
    (s) => s.syncState === "not_synced" || s.syncState === "syncing"
  );
  const syncing = sales.filter((s) => s.syncState === "syncing");
  const isSyncing = syncing.length > 0;

  if (pendingOrSyncing.length === 0) return null;

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: isSyncing ? "primary.light" : "rgba(255, 152, 0, 0.2)",
        color: isSyncing ? "primary.contrastText" : "warning.main",
        border: isSyncing ? "none" : "1px solid",
        borderColor: "warning.main",
        px: 1.5,
        py: 0.5,
        borderRadius: "16px",
        fontSize: "0.75rem",
        fontWeight: 600,
        overflow: "hidden",
        "&::before": isSyncing
          ? {
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
              animation: "syncProgress 2s infinite",
            }
          : {},
        "@keyframes syncProgress": {
          "0%": { left: "-100%" },
          "100%": { left: "100%" },
        },
      }}
    >
      {isSyncing && (
        <CircularProgress
          size={12}
          sx={{ color: "primary.contrastText", zIndex: 1 }}
        />
      )}
      <Box sx={{ zIndex: 1 }}>
        {isSyncing
          ? `${pendingOrSyncing.length} sincronizando`
          : `${pendingOrSyncing.length} pendientes`}
      </Box>
    </Box>
  );
}
