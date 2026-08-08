"use client";

import { Box, Chip, Stack, useTheme } from "@mui/material";
import type { Theme } from "@mui/material";
import { ICategory } from "@/schemas/categoria";

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

export function CategoryPillsBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPillsBarProps) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        flexShrink: 0,
        overflowX: "auto",
        px: 1,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Chip
        label="Todas"
        variant={selectedCategoryId === null ? "filled" : "outlined"}
        color={selectedCategoryId === null ? "primary" : "default"}
        onClick={() => onSelectCategory(null)}
        aria-pressed={selectedCategoryId === null}
        sx={{ height: 36, cursor: "pointer", flexShrink: 0 }}
      />
      {categories.map((category, index) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <Chip
            key={category.id}
            {...(index === 0 ? { "data-tour": "pos-category-first" } : {})}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {!isSelected && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: category.color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box
                  sx={{
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {category.nombre}
                </Box>
              </Box>
            }
            variant={isSelected ? "filled" : "outlined"}
            onClick={() => onSelectCategory(isSelected ? null : category.id)}
            aria-pressed={isSelected}
            sx={{
              height: 36,
              cursor: "pointer",
              flexShrink: 0,
              ...(isSelected && {
                bgcolor: category.color,
                color: getSafeContrastText(category.color, theme),
                borderColor: category.color,
                "&:hover": { bgcolor: category.color, opacity: 0.9 },
              }),
            }}
          />
        );
      })}
    </Stack>
  );
}
