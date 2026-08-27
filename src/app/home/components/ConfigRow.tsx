"use client";

import type { ReactNode } from "react";
import { ButtonBase, Typography } from "@mui/material";
import { shape } from "@/theme";

interface ConfigRowProps {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}

/**
 * One entry in «Configuración del sistema».
 *
 * These were cards with a filled violet circle each, which gave settings the
 * same visual weight as the operations above them — nine saturated circles for
 * links you open once a month. The redesign drops them to a quiet bordered row
 * on the page ground: grey label, grey icon, and no fill until you hover.
 */
export function ConfigRow({ title, icon, onClick }: ConfigRowProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-start",
        gap: 1.25,
        minHeight: 48,
        px: 1.75,
        borderRadius: `${shape.radius.md}px`,
        border: 1,
        borderColor: "divider",
        bgcolor: "transparent",
        color: "text.secondary",
        fontSize: "0.875rem",
        fontWeight: 600,
        "& .MuiSvgIcon-root": { fontSize: 19, color: "text.disabled" },
        "@media (hover: hover)": {
          "&:hover": { bgcolor: "background.paper", color: "text.primary" },
        },
      }}
    >
      {icon}
      <Typography sx={{ fontSize: "inherit", fontWeight: "inherit" }}>
        {title}
      </Typography>
    </ButtonBase>
  );
}
