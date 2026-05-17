import { Chip, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

interface TasasBannerProps {
  tasas: ITasaSnapshot;
  historical?: boolean;
  sx?: SxProps<Theme>;
}

export function TasasBanner({ tasas, historical = false, sx }: TasasBannerProps) {
  if (Object.keys(tasas).length === 0) return null;

  return (
    <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={sx}>
      <Typography variant="caption" color="text.secondary">
        {historical ? "Tasas al cierre:" : "Tasas vigentes:"}
      </Typography>
      {Object.entries(tasas).map(([code, rate]) => (
        <Chip
          key={code}
          label={`1 ${code} = ${Number.isInteger(rate) ? rate : rate.toFixed(2)} CUP`}
          size="small"
          variant="outlined"
          color={historical ? "warning" : "default"}
        />
      ))}
    </Stack>
  );
}
