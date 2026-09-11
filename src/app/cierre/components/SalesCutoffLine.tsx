"use client";

import { Box, Typography } from "@mui/material";
import { SALES_CUTOFF_LINE_LABEL } from "@/constants/cierre";
import { formatDateTime } from "@/utils/formatters";
import { shape } from "@/theme/tokens";

interface Props {
  cutoffAt: Date;
}

/**
 * The line that says where the close ends: everything above it enters,
 * everything below it goes to the next period.
 *
 * It is an item of the list and not a border of a row, because it exists even
 * when there is no row on one of its sides — a cut that leaves nothing inside
 * opens the list, and one that leaves nothing outside closes it.
 *
 * NOT tappable, on purpose: what the operator moves are the sales and the
 * shortcuts, so it carries no `role="button"` and no pointer cursor.
 */
export default function SalesCutoffLine({ cutoffAt }: Readonly<Props>) {
  return (
    <Box
      role="separator"
      aria-label={SALES_CUTOFF_LINE_LABEL}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        minHeight: 32,
        px: 1,
      }}
    >
      <Box sx={{ flex: 1, height: 2, bgcolor: "semantic.hue.info.main" }} />
      <Typography
        variant="caption"
        sx={{
          px: 1.25,
          py: 0.5,
          borderRadius: `${shape.radius.pill}px`,
          bgcolor: "semantic.hue.info.surface",
          color: "semantic.hue.info.main",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {`Corte · ${formatDateTime(cutoffAt)}`}
      </Typography>
      <Box sx={{ flex: 1, height: 2, bgcolor: "semantic.hue.info.main" }} />
    </Box>
  );
}
