import { FC } from "react";
import { alpha, Box, Typography } from "@mui/material";
import NumberSpinner from "@/components/NumberSpinner";

interface Props {
  denomination: number;
  count: number;
  onChange: (count: number) => void;
}

const numericSx = {
  fontVariantNumeric: "tabular-nums",
  fontSize: { xs: "0.75rem", sm: "0.875rem" },
} as const;

const DenominationRow: FC<Props> = ({ denomination, count, onChange }) => {
  const subtotal = denomination * count;
  const hasCount = count > 0;

  return (
    <Box
      sx={{
        display: "grid",
        alignItems: "center",
        gap: { xs: 0.25, sm: 0.5 },
        py: { xs: 0.125, sm: 0.25 },
        px: { xs: 0.5, sm: 0.75 },
        borderRadius: 1,
        transition: "background-color 0.15s ease",
        gridTemplateColumns: {
          xs: "40px 1fr minmax(52px, auto)",
          sm: "48px 16px 1fr 16px 64px",
        },
        ...(hasCount && {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        }),
      }}
    >
      <Typography
        variant="body2"
        fontWeight={500}
        textAlign="right"
        sx={numericSx}
      >
        {denomination}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        textAlign="center"
        sx={{ display: { xs: "none", sm: "block" } }}
      >
        ×
      </Typography>
      <Box sx={{ "& .MuiFormControl-root": { width: "100%" } }}>
        <NumberSpinner
          compact
          size="small"
          value={count}
          min={0}
          step={1}
          onValueChange={(val) => onChange(val ?? 0)}
        />
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        textAlign="center"
        sx={{ display: { xs: "none", sm: "block" } }}
      >
        =
      </Typography>
      <Typography
        variant="body2"
        color={hasCount ? "text.primary" : "text.disabled"}
        fontWeight={hasCount ? 500 : 400}
        textAlign="right"
        noWrap
        title={String(subtotal)}
        sx={numericSx}
      >
        {subtotal}
      </Typography>
    </Box>
  );
};

export default DenominationRow;
