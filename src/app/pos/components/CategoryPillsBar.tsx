"use client";

import { memo } from "react";
import { Chip, Stack } from "@mui/material";
import type { IPosCategoria } from "@/schemas/producto";
import { shape } from "@/theme";

/**
 * The category filter, as one row of pills.
 *
 * Each pill used to be painted in its own category's colour — a dot when
 * idle, the whole chip when selected — so the row could show seven saturated
 * hues at once, and "selected" was said by a different colour every time.
 * Nothing else on the screen could then use colour to mean anything.
 *
 * The redesign spends violet on selection and nothing else, here as
 * everywhere: idle pills are the neutral wash, the selected one is violet.
 * The category's own colour is still its identity in configuration and in the
 * reports; it just stops competing with the price of every product.
 */

const ROOT_SX = {
  flexShrink: 0,
  overflowX: "auto",
  px: 1.5,
  pb: 1.25,
  // No scrollbar track stealing height from a 36px row on desktop.
  "&::-webkit-scrollbar": { display: "none" },
  scrollbarWidth: "none",
} as const;

// 36px and 13.5px, regular weight while idle: the theme's chip is 12px and
// semibold because it labels a status on a table row, and here it is a
// filter the cashier reads and taps at arm's length.
const PILL_SX = {
  height: 36,
  cursor: "pointer",
  flexShrink: 0,
  borderRadius: `${shape.radius.pill}px`,
  maxWidth: 180,
  fontSize: "0.84375rem",
  fontWeight: 400,
  "& .MuiChip-label": { px: 1.75 },
} as const;

const PILL_SELECTED_SX = { ...PILL_SX, fontWeight: 700 } as const;

interface CategoryPillsBarProps {
  categories: IPosCategoria[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

function CategoryPillsBarComponent({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPillsBarProps) {
  const allSelected = selectedCategoryId === null;

  return (
    <Stack direction="row" spacing={0.75} sx={ROOT_SX}>
      <Chip
        label="Todas"
        color={allSelected ? "primary" : "default"}
        onClick={() => onSelectCategory(null)}
        aria-pressed={allSelected}
        sx={allSelected ? PILL_SELECTED_SX : PILL_SX}
      />
      {categories.map((category, index) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <Chip
            key={category.id}
            {...(index === 0 ? { "data-tour": "pos-category-first" } : {})}
            label={category.nombre}
            color={isSelected ? "primary" : "default"}
            onClick={() => onSelectCategory(isSelected ? null : category.id)}
            aria-pressed={isSelected}
            sx={isSelected ? PILL_SELECTED_SX : PILL_SX}
          />
        );
      })}
    </Stack>
  );
}

export const CategoryPillsBar = memo(CategoryPillsBarComponent);
