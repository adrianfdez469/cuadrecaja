"use client";

import { memo } from "react";
import { Box, Chip, Stack, useTheme } from "@mui/material";
import type { Theme } from "@mui/material";
import { ICategory } from "@/schemas/categoria";

const ROOT_SX = {
  flexShrink: 0,
  overflowX: "auto",
  px: 1,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;
const PILL_SX = { height: 36, cursor: "pointer", flexShrink: 0 } as const;
const PILL_LABEL_SX = {
  display: "flex",
  alignItems: "center",
  gap: 0.75,
} as const;
const PILL_DOT_SX = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
} as const;
const PILL_TEXT_SX = {
  maxWidth: 140,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

interface CategoryPillsBarProps {
  categories: ICategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

// theme.palette.getContrastText throws on a color string it can't parse.
// The UI's own color picker always produces valid hex, but nothing enforces
// that at the data layer (direct DB edits, imports, etc.), so a bad stored
// value must degrade instead of crashing the whole POS product-browsing view.
function getSafeContrastText(color: string, theme: Theme): string {
  try {
    return theme.palette.getContrastText(color);
  } catch {
    return theme.palette.text.primary;
  }
}

function CategoryPillsBarComponent({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPillsBarProps) {
  const theme = useTheme();

  return (
    <Stack direction="row" spacing={1} sx={ROOT_SX}>
      <Chip
        label="Todas"
        variant={selectedCategoryId === null ? "filled" : "outlined"}
        color={selectedCategoryId === null ? "primary" : "default"}
        onClick={() => onSelectCategory(null)}
        aria-pressed={selectedCategoryId === null}
        sx={PILL_SX}
      />
      {categories.map((category, index) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <Chip
            key={category.id}
            {...(index === 0 ? { "data-tour": "pos-category-first" } : {})}
            label={
              <Box sx={PILL_LABEL_SX}>
                {!isSelected && (
                  <Box sx={PILL_DOT_SX} bgcolor={category.color} />
                )}
                <Box sx={PILL_TEXT_SX}>{category.nombre}</Box>
              </Box>
            }
            variant={isSelected ? "filled" : "outlined"}
            onClick={() => onSelectCategory(isSelected ? null : category.id)}
            aria-pressed={isSelected}
            sx={
              isSelected
                ? {
                    ...PILL_SX,
                    bgcolor: category.color,
                    color: getSafeContrastText(category.color, theme),
                    borderColor: category.color,
                    "&:hover": { bgcolor: category.color, opacity: 0.9 },
                  }
                : PILL_SX
            }
          />
        );
      })}
    </Stack>
  );
}

export const CategoryPillsBar = memo(CategoryPillsBarComponent);
