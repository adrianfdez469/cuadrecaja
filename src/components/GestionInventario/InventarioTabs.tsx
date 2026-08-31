"use client";

import { Badge, Tab, Tabs } from "@mui/material";

interface InventarioTabsProps {
  value: number;
  onChange: (value: number) => void;
  pendingReceptionCount: number;
}

/**
 * Compacta bajo el título en vez de una barra propia arriba de la página —
 * `rediseno/inventario-stock.html` y `rediseno/movimientos-stock.html`
 * dibujan las mismas dos pestañas ahí, no como bloque separado.
 */
export function InventarioTabs({
  value,
  onChange,
  pendingReceptionCount,
}: InventarioTabsProps) {
  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v)}
      sx={{
        minHeight: 0,
        // El scroller de Tabs recorta overflow vertical por defecto, lo que
        // corta la mitad superior del Badge del tab "Movimientos".
        "& .MuiTabs-scroller": { overflow: "visible !important" },
        "& .MuiTab-root": { minHeight: 0, py: 1, px: 1.25 },
      }}
    >
      <Tab label="Inventario" value={0} />
      <Tab
        value={1}
        // Reserva espacio a la derecha del texto para que el Badge no quede
        // recortado por el propio botón del Tab (overflow: hidden del ripple).
        sx={pendingReceptionCount > 0 ? { pr: 2.5 } : undefined}
        label={
          <Badge badgeContent={pendingReceptionCount} color="error">
            Movimientos
          </Badge>
        }
      />
    </Tabs>
  );
}
