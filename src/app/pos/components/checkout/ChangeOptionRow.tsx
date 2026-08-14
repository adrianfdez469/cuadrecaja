"use client";

import { memo, type ReactNode } from "react";
import { Box, Radio, Stack, alpha, useTheme } from "@mui/material";

interface ChangeOptionRowProps {
  selected: boolean;
  onSelect: () => void;
  /** The split itself, or the name of the typed one. */
  children: ReactNode;
  /** Trailing note on the header line — a warning, usually. */
  end?: ReactNode;
  /**
   * Content that unfolds under the header line. Kept outside the radio itself
   * so the fields it may contain get their own keystrokes: the header handles
   * Enter and Space, and swallowing those inside an input would break typing.
   */
  detail?: ReactNode;
}

/** One pickable way to hand the change over. */
function ChangeOptionRowComponent({
  selected,
  onSelect,
  children,
  end,
  detail,
}: ChangeOptionRowProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.08)
          : "transparent",
      }}
    >
      <Stack
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          p: 1.25,
          minHeight: 56,
          cursor: "pointer",
          borderRadius: 2,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        <Radio checked={selected} tabIndex={-1} size="small" />
        {children}
        <Box flex={1} />
        {end}
      </Stack>
      {detail}
    </Box>
  );
}

export const ChangeOptionRow = memo(ChangeOptionRowComponent);
