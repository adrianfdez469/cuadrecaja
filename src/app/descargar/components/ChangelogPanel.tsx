"use client";

import { Box, Typography } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";

import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { shape } from "@/theme/tokens";

/** The three kinds of change a release note can be. */
const ENTRY_KINDS: Record<string, { label: string; hue: PillHue }> = {
  arreglo: { label: "Arreglo", hue: "caution" },
  caracteristica: { label: "Nueva", hue: "accent" },
};

const DEFAULT_KIND = { label: "Mejora", hue: "positive" as PillHue };

interface ChangelogPanelProps {
  entries: Array<Record<string, string>>;
}

/**
 * What changed in this release.
 *
 * Each note used to carry an icon, a chip and a divider — three markers for one
 * label. The pill alone says what kind of change it is, and a hairline between
 * rows does the separating.
 */
export function ChangelogPanel({ entries }: ChangelogPanelProps) {
  return (
    <Box
      sx={{
        p: 3,
        bgcolor: "semantic.surface.raised",
        border: "1px solid",
        borderColor: "semantic.surface.border",
        borderRadius: `${shape.radius.md}px`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
        <HistoryIcon sx={{ fontSize: 21, color: "text.primary" }} />
        <Typography sx={{ fontSize: "1.1875rem", fontWeight: 700 }}>
          Novedades de la versión
        </Typography>
      </Box>

      {entries.length === 0 ? (
        <Typography
          sx={{ pt: 2, fontSize: "0.875rem", color: "text.secondary" }}
        >
          No hay información detallada para esta versión.
        </Typography>
      ) : (
        entries.map((entry, index) => {
          const [type] = Object.keys(entry);
          const { label, hue } = ENTRY_KINDS[type] ?? DEFAULT_KIND;

          return (
            <Box
              key={`${type}-${index}`}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                py: 2,
                borderTop: "1px solid",
                borderColor: "semantic.surface.border",
              }}
            >
              <StatusPill
                label={label}
                hue={hue}
                sx={{ mt: "2px", flexShrink: 0 }}
              />
              <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.55 }}>
                {entry[type]}
              </Typography>
            </Box>
          );
        })
      )}
    </Box>
  );
}
