"use client";

import { Box, Chip, Stack } from "@mui/material";
import { SALES_CUTOFF_SHORTCUTS_LABEL } from "@/constants/cierre";
import { getRelativeDate } from "@/utils/formatters";
import type { SalesCutoffChoice } from "@/lib/cierre/salesCutoff";

interface Props {
  /** Local midnight of each distinct day with sales, oldest first. */
  days: Date[];
  onChoose: (choice: SalesCutoffChoice) => void;
}

/**
 * The quick ways to move the cut.
 *
 * The chips carry NO selected state, and that is deliberate: pressing one is an
 * action, and the answer is that the cut line jumps and the rows change sides —
 * a far stronger signal than a highlighted chip. Deriving "which chip is active"
 * from the stored instant would need one more pure function and would put the
 * focus ring out of sync with the choice (E-041). The cut, and only the cut, is
 * the source of truth for where the boundary is.
 *
 * "Todo el período" REMOVES the cut rather than parking it at the end: it leaves
 * the screen exactly as if nothing had ever been prepared, with no banner
 * announcing that zero sales are deferred.
 */
export default function SalesCutoffShortcuts({
  days,
  onChoose,
}: Readonly<Props>) {
  return (
    <Box component="section" aria-label={SALES_CUTOFF_SHORTCUTS_LABEL}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip
          label="Todo el período"
          onClick={() => onChoose({ kind: "clear" })}
          sx={{ height: 44 }}
        />
        <Chip
          label="Nada"
          onClick={() => onChoose({ kind: "nothing" })}
          sx={{ height: 44 }}
        />
        {days.map((dayStart) => (
          <Chip
            key={dayStart.getTime()}
            label={getRelativeDate(dayStart)}
            onClick={() => onChoose({ kind: "day", dayStart })}
            sx={{ height: 44 }}
          />
        ))}
      </Stack>
    </Box>
  );
}
