"use client";

import { Alert, AlertTitle, Box } from "@mui/material";
import { ChevronRight } from "@mui/icons-material";

interface PendingReceptionBannerProps {
  count: number;
  onClick: () => void;
}

export function PendingReceptionBanner({
  count,
  onClick,
}: PendingReceptionBannerProps) {
  if (count === 0) return null;

  return (
    <Alert
      severity="warning"
      onClick={onClick}
      icon={false}
      sx={{
        mb: 2,
        cursor: "pointer",
        alignItems: "center",
        "&:hover": { filter: "brightness(0.97)" },
        "& .MuiAlert-message": { width: "100%" },
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        width="100%"
      >
        <Box>
          <AlertTitle sx={{ mb: 0 }}>
            {count} movimiento{count !== 1 ? "s" : ""} pendiente
            {count !== 1 ? "s" : ""} de recepción
          </AlertTitle>
          Click para revisar y aceptar la mercancía recibida.
        </Box>
        <ChevronRight />
      </Box>
    </Alert>
  );
}
