"use client";
import React, { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Sync } from "@mui/icons-material";
import { useMessageContext } from "@/context/MessageContext";

const MSG_ID = "refresh-msg";

interface Props {
  onRefresh: () => Promise<void>;
}

export default function RefreshButton({ onRefresh }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showMessage, removeMessage } = useMessageContext();

  const handleClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    showMessage("Sincronizando datos...", "info", undefined, true, MSG_ID);
    try {
      await onRefresh();
      removeMessage(MSG_ID);
      showMessage("Datos actualizados correctamente", "success");
    } catch {
      removeMessage(MSG_ID);
      showMessage("Error al sincronizar los datos", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Tooltip title="Actualizar datos">
      <IconButton onClick={handleClick} size="medium" color="inherit">
        <Sync
          sx={{
            transition: "transform 0.8s ease",
            ...(isRefreshing && {
              animation: "spin 0.8s linear infinite",
            }),
            "@keyframes spin": {
              "0%": { transform: "rotate(0deg)" },
              "100%": { transform: "rotate(360deg)" },
            },
          }}
        />
      </IconButton>
    </Tooltip>
  );
}
