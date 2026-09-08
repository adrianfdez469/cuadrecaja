"use client";

import { Box, Chip, Typography } from "@mui/material";
import { CategoriaSugerida } from "../hooks/useGestionInventario";

interface CategorySuggestionsProps {
  sugerencias: CategoriaSugerida[];
  onApply: (ids: string[]) => void;
}

/**
 * Bridge between the search box and the category filter.
 *
 * The search box matches products only, so typing a category name would
 * otherwise find nothing. Rather than silently folding category matches into
 * the results — where a row gives no clue why it is listed and cannot be
 * dismissed on its own — the match is offered as an action that applies the
 * real category filter, which shows as a chip and clears with the rest.
 */
export function CategorySuggestions({
  sugerencias,
  onApply,
}: Readonly<CategorySuggestionsProps>) {
  if (sugerencias.length === 0) return null;

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      <Typography variant="caption" color="text.secondary">
        Filtrar por categoría:
      </Typography>
      {sugerencias.map((sug) => (
        <Chip
          key={sug.key}
          label={sug.nombre}
          size="small"
          variant="outlined"
          clickable
          onClick={() => onApply(sug.ids)}
          sx={{
            borderColor: sug.color,
            color: "text.primary",
            "& .MuiChip-label": { fontWeight: 500 },
          }}
        />
      ))}
    </Box>
  );
}
