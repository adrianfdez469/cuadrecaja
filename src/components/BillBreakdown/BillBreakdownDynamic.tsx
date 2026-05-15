'use client'

import { FC, useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import DenominationRow from './DenominationRow'

interface Props {
  denominations: number[];
  targetAmount?: number;
  onChange: (total: number) => void;
  resetKey?: number;
}

const BillBreakdownDynamic: FC<Props> = ({ denominations, targetAmount, onChange, resetKey }) => {
  const [counts, setCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    setCounts({});
    onChange(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleChange = (denomination: number, count: number) => {
    const next = { ...counts, [denomination]: count };
    setCounts(next);
    const total = denominations.reduce((acc, d) => acc + d * (next[d] ?? 0), 0);
    onChange(total);
  };

  const total = denominations.reduce((acc, d) => acc + d * (counts[d] ?? 0), 0);
  const diff = targetAmount !== undefined ? total - targetAmount : null;

  return (
    <Box sx={{ py: 1 }}>
      {denominations.map(d => (
        <DenominationRow
          key={d}
          denomination={d}
          count={counts[d] ?? 0}
          onChange={(count) => handleChange(d, count)}
        />
      ))}
      <Stack direction="row" justifyContent="space-between" alignItems="center" pt={1} mt={0.5} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight={600}>Total: {total.toFixed(2)}</Typography>
        {diff !== null && total > 0 && (
          <Typography variant="body2" color={diff >= 0 ? 'success.main' : 'error.main'} fontWeight={500}>
            {diff === 0 ? 'Exacto ✓' : diff > 0 ? `Sobra: ${diff.toFixed(2)}` : `Faltan: ${Math.abs(diff).toFixed(2)}`}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default BillBreakdownDynamic;
