"use client";

import { memo, type ReactNode } from "react";
import { Box, ButtonBase } from "@mui/material";
import {
  SHEET_ROW_SX,
  SheetRadio,
} from "@/app/pos/components/checkout/BottomSheet";

interface ChangeOptionRowProps {
  selected: boolean;
  onSelect: () => void;
  /** The split itself, or the name of the typed one. */
  children: ReactNode;
  /** Trailing note on the row — a warning, usually. */
  end?: ReactNode;
  /**
   * Content that unfolds under the row. Kept outside the radio itself so the
   * fields it may contain get their own keystrokes.
   */
  detail?: ReactNode;
}

/** One pickable way to hand the change over: a 56px row with its radio. */
function ChangeOptionRowComponent({
  selected,
  onSelect,
  children,
  end,
  detail,
}: ChangeOptionRowProps) {
  return (
    <Box>
      <ButtonBase
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        sx={SHEET_ROW_SX}
      >
        <SheetRadio on={selected} />
        {children}
        <Box sx={{ ml: "auto" }}>{end}</Box>
      </ButtonBase>
      {detail}
    </Box>
  );
}

export const ChangeOptionRow = memo(ChangeOptionRowComponent);
