"use client";

import { ReactNode } from "react";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { shape } from "@/theme";

export interface ActionSheetItem {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: ActionSheetItem[];
}

/**
 * El menú de acciones en mobile es una hoja que sube desde abajo, no un
 * `Menu` flotante anclado a un botón chiquito — mismo patrón que
 * `rediseno/inventario-stock-movil.html` dibuja para "Más acciones" y para
 * las acciones de un producto: manija arriba, título, filas de 56px.
 */
export function ActionSheet({ open, onClose, title, items }: ActionSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: shape.radius.lg,
          borderTopRightRadius: shape.radius.lg,
        },
      }}
    >
      <Box
        sx={{ display: "flex", justifyContent: "center", pt: 1.25, pb: 0.25 }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: shape.radius.pill,
            bgcolor: "divider",
          }}
        />
      </Box>
      <Typography
        sx={{
          px: 2.5,
          pt: 0.75,
          pb: 1.75,
          fontSize: "1.0625rem",
          fontWeight: 700,
        }}
      >
        {title}
      </Typography>
      <List disablePadding>
        {items.map((item) => (
          <ListItemButton
            key={item.key}
            onClick={() => {
              onClose();
              item.onClick();
            }}
            disabled={item.disabled}
            sx={{
              minHeight: 56,
              px: 2.5,
              gap: 1.75,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                color: item.danger ? "error.main" : "text.secondary",
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              slotProps={{
                primary: {
                  sx: {
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: item.danger ? "error.main" : "text.primary",
                  },
                },
              }}
            >
              {item.label}
            </ListItemText>
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}
