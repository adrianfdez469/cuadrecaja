"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import { tallyBills } from "@/app/pos/utils/billMath";

interface BillPadProps {
  denominations: number[];
  bills: number[];
  onChange: (bills: number[]) => void;
}

/** Tap a denomination to add it; undo pops the last one tapped. */
export function BillPad({ denominations, bills, onChange }: BillPadProps) {
  const grouped = tallyBills(bills);

  return (
    <Stack gap={1}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0.75,
        }}
      >
        {denominations.map((denomination) => (
          <Button
            key={denomination}
            variant="outlined"
            onClick={() => onChange([...bills, denomination])}
            sx={{ minHeight: 44, fontWeight: 600 }}
          >
            {denomination}
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.5,
          minHeight: 44,
          p: 1,
          borderRadius: 2,
          bgcolor: "action.hover",
        }}
      >
        {grouped.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Tocá los billetes que recibís
          </Typography>
        ) : (
          grouped.map(({ denomination, count }) => (
            <Chip
              key={denomination}
              size="small"
              label={`${count}×${denomination}`}
              variant="outlined"
            />
          ))
        )}
        <Box flex={1} />
        <Button
          size="small"
          startIcon={<UndoIcon />}
          disabled={bills.length === 0}
          onClick={() => onChange(bills.slice(0, -1))}
          sx={{ textTransform: "none", minHeight: 44 }}
        >
          Deshacer
        </Button>
      </Box>
    </Stack>
  );
}
