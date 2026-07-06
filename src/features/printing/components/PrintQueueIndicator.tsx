"use client";

import React, { useEffect, useState } from "react";
import { Badge, IconButton, Tooltip, CircularProgress } from "@mui/material";
import { Print, PrintDisabled } from "@mui/icons-material";
import { usePrintQueueStore } from "../store/printQueueStore";
import { usePrinter } from "../hooks/usePrinter";

interface PrintQueueIndicatorProps {
  tiendaId: string;
  onOpenSetup: () => void;
}

export const PrintQueueIndicator: React.FC<PrintQueueIndicatorProps> = ({
  tiendaId,
  onOpenSetup,
}) => {
  const pendingCount = usePrintQueueStore((s) => s.getPendingCount());
  const { flushQueue } = usePrinter(tiendaId);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (pendingCount > 0 && tiendaId) {
      void flushQueue().catch(() => {});
    }
  }, [pendingCount, tiendaId, flushQueue]);

  const handleClick = async () => {
    if (pendingCount > 0) {
      setFlushing(true);
      try {
        await flushQueue();
      } finally {
        setFlushing(false);
      }
    }
    onOpenSetup();
  };

  return (
    <Tooltip
      title={
        pendingCount > 0
          ? `${pendingCount} ticket(s) pendiente(s) de imprimir`
          : "Configurar impresora"
      }
    >
      <IconButton
        onClick={handleClick}
        color="inherit"
        size="small"
        data-tour="pos-toolbar-printer"
      >
        <Badge badgeContent={pendingCount} color="error">
          {flushing ? (
            <CircularProgress size={20} color="inherit" />
          ) : pendingCount > 0 ? (
            <PrintDisabled fontSize="small" />
          ) : (
            <Print fontSize="small" />
          )}
        </Badge>
      </IconButton>
    </Tooltip>
  );
};
