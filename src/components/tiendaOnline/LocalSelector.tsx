"use client";

import { MenuItem, Stack, TextField } from "@mui/material";

import { SectionLabel } from "@/components/SectionLabel";
import { StatusPill } from "@/components/StatusPill";
import { TipoLocal } from "@/schemas/tienda";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";

import { publicationPresentation } from "./publicationPresentation";

export interface LocalSelectorProps {
  locales: ITiendaOnlineLocal[];
  selectedId: string;
  isMobile: boolean;
  onSelect: (tiendaId: string) => void;
}

const SELECT_MAX_WIDTH = 360;

/**
 * Which local this screen is about.
 *
 * Warehouses ARE listed, not hidden: hiding them would leave whoever is looking
 * for theirs convinced the application ate it. They come with their own pill
 * and, once chosen, an explanation.
 */
export function LocalSelector({
  locales,
  selectedId,
  isMobile,
  onSelect,
}: Readonly<LocalSelectorProps>) {
  const selected = locales.find((local) => local.id === selectedId);

  // A one-item dropdown is a control that does nothing.
  if (locales.length <= 1) {
    return <SectionLabel>{selected?.nombre ?? "Local"}</SectionLabel>;
  }

  return (
    <TextField
      select
      label="Local"
      value={selectedId}
      onChange={(event) => onSelect(event.target.value)}
      sx={{
        width: "100%",
        ...(isMobile ? {} : { maxWidth: SELECT_MAX_WIDTH }),
        "& .MuiInputBase-root": { minHeight: touch.comfortable },
      }}
    >
      {locales.map((local) => {
        const pill =
          local.tipo === TipoLocal.ALMACEN
            ? { label: "Almacén", hue: "neutral" as const }
            : publicationPresentation(local, local.publicarEnTienda);
        return (
          <MenuItem key={local.id} value={local.id}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ width: "100%" }}
            >
              <span>{local.nombre}</span>
              <StatusPill label={pill.label} hue={pill.hue} />
            </Stack>
          </MenuItem>
        );
      })}
    </TextField>
  );
}

export default LocalSelector;
