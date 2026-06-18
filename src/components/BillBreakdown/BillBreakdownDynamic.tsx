"use client";

import { FC, useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import DenominationRow from "./DenominationRow";

interface Props {
  denominations: number[];
  targetAmount?: number;
  onChange: (total: number) => void;
  onCounts?: (
    counts: Record<number, number>,
    total: number,
    isUserChange?: boolean,
  ) => void;
  resetKey?: number;
  initialCounts?: Record<number, number>;
}

const BillBreakdownDynamic: FC<Props> = ({
  denominations,
  targetAmount,
  onChange,
  onCounts,
  resetKey,
  initialCounts,
}) => {
  const [counts, setCounts] = useState<Record<number, number>>(
    initialCounts ?? {},
  );

  useEffect(() => {
    const next = initialCounts ?? {};
    setCounts(next);
    const total = denominations.reduce((acc, d) => acc + d * (next[d] ?? 0), 0);
    onChange(total);
    onCounts?.(next, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleChange = (denomination: number, count: number) => {
    const next = { ...counts, [denomination]: count };
    setCounts(next);
    const total = denominations.reduce((acc, d) => acc + d * (next[d] ?? 0), 0);
    onChange(total);
    onCounts?.(next, total, true);
  };

  const total = denominations.reduce((acc, d) => acc + d * (counts[d] ?? 0), 0);
  const diff = targetAmount !== undefined ? total - targetAmount : null;

  return (
    <Box
      sx={{
        py: { xs: 0.5, sm: 1 },
        width: "100%",
        maxWidth: { xs: "100%", sm: 500 },
        mx: "auto",
      }}
    >
      {denominations.map((d) => (
        <DenominationRow
          key={d}
          denomination={d}
          count={counts[d] ?? 0}
          onChange={(count) => handleChange(d, count)}
        />
      ))}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        pt={1}
        mt={0.5}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      >
        <Typography
          variant="h5"
          fontWeight={600}
          sx={{ fontSize: { xs: "1.1rem", sm: "1.5rem" } }}
        >
          Total: {total.toFixed(2)}
        </Typography>
        {diff !== null && total > 0 && (
          <Typography
            variant="body2"
            color={diff >= 0 ? "success.main" : "error.main"}
            fontWeight={500}
            sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
          >
            {diff === 0
              ? "Exacto ✓"
              : diff > 0
                ? `Sobra: ${diff.toFixed(2)}`
                : `Faltan: ${Math.abs(diff).toFixed(2)}`}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default BillBreakdownDynamic;
