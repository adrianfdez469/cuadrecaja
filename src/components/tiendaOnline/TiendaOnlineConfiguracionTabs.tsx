"use client";

import { Tab, Tabs } from "@mui/material";

import {
  TIENDA_ONLINE_LABELS,
  TIENDA_ONLINE_TABS,
} from "@/constants/tiendaOnline";
import { touch } from "@/theme/tokens";

export type ITiendaOnlineTab =
  (typeof TIENDA_ONLINE_TABS)[keyof typeof TIENDA_ONLINE_TABS];

export interface TiendaOnlineConfiguracionTabsProps {
  value: ITiendaOnlineTab;
  onChange: (next: ITiendaOnlineTab) => void;
}

/**
 * The two tabs of the online-store configuration screen.
 *
 * NOT `InventarioTabs`: that one belongs to Inventario, carries its own badge of
 * pending receptions, and — the reason it cannot simply be copied — its
 * `MuiTab-root` sits below 44 px with `minHeight: 0` and `py: 1`. This version
 * pins `touch.min` explicitly, so no tap target of this screen is under the
 * floor.
 */
export function TiendaOnlineConfiguracionTabs({
  value,
  onChange,
}: Readonly<TiendaOnlineConfiguracionTabsProps>) {
  return (
    <Tabs
      value={value}
      onChange={(_event, next: ITiendaOnlineTab) => onChange(next)}
      variant="fullWidth"
      sx={{ minHeight: touch.min }}
    >
      <Tab
        value={TIENDA_ONLINE_TABS.locales}
        label={TIENDA_ONLINE_LABELS.tabLocales}
        sx={{ minHeight: touch.min }}
      />
      <Tab
        value={TIENDA_ONLINE_TABS.productos}
        label={TIENDA_ONLINE_LABELS.tabProductos}
        sx={{ minHeight: touch.min }}
      />
    </Tabs>
  );
}

export default TiendaOnlineConfiguracionTabs;
