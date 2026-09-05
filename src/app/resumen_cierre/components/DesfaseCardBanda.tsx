"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { StatusPill } from "@/components/StatusPill";
import { DESFASE_CARD_CUERPO, DESFASE_LABEL } from "./desfaseCopy";

interface Props {
  canRecalculate: boolean;
  onRecalculate: () => void;
}

/**
 * Full-width band of a mobile card whose stored figures are stale. Sits
 * between the dates and the figures: it warns before the numbers are read,
 * not after. Stops propagation so tapping it never opens the drawer behind.
 */
export default function DesfaseCardBanda({
  canRecalculate,
  onRecalculate,
}: Readonly<Props>) {
  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{
        bgcolor: "semantic.hue.caution.surface",
        borderRadius: 1,
        px: 1.5,
        py: 1.25,
      }}
    >
      <Stack spacing={1}>
        <StatusPill
          label={DESFASE_LABEL}
          hue="caution"
          icon={<WarningAmberIcon />}
        />
        <Typography variant="body2" sx={{ color: "semantic.hue.caution.main" }}>
          {DESFASE_CARD_CUERPO}
        </Typography>
        {canRecalculate && (
          <Button
            variant="outlined"
            color="warning"
            fullWidth
            onClick={onRecalculate}
            sx={{ minHeight: 44 }}
          >
            Recalcular
          </Button>
        )}
      </Stack>
    </Box>
  );
}
