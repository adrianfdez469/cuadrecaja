'use client'

import { FC, useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { Currency, DENOMINACIONES } from '@/constants/billDenominations'
import DenominationRow from './DenominationRow'
import BillBreakdownSummary from './BillBreakdownSummary'

interface Props {
  currency: Currency
  targetAmount?: number
  onChange: (total: number) => void
  onCounts?: (counts: Record<number, number>, total: number) => void
  resetKey?: number
  initialCounts?: Record<number, number>
  overLabel?: string
}

const BillBreakdownInput: FC<Props> = ({
  currency,
  targetAmount,
  onChange,
  onCounts,
  resetKey,
  initialCounts,
  overLabel,
}) => {
  const denominations = DENOMINACIONES[currency]
  const [counts, setCounts] = useState<Record<number, number>>(initialCounts ?? {})

  useEffect(() => {
    const next = initialCounts ?? {}
    setCounts(next)
    const total = denominations.reduce((acc, d) => acc + d * (next[d] ?? 0), 0)
    onChange(total)
    onCounts?.(next, total)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const handleChange = (denomination: number, count: number) => {
    const next = { ...counts, [denomination]: count }
    setCounts(next)
    const total = denominations.reduce((acc, d) => acc + d * (next[d] ?? 0), 0)
    onChange(total)
    onCounts?.(next, total)
  }

  const total = denominations.reduce((acc, d) => acc + d * (counts[d] ?? 0), 0)

  return (
    <Box sx={{ py: 1 }}>
      {denominations.map((d) => (
        <DenominationRow
          key={d}
          denomination={d}
          count={counts[d] ?? 0}
          onChange={(count) => handleChange(d, count)}
        />
      ))}
      <BillBreakdownSummary total={total} targetAmount={targetAmount} overLabel={overLabel} />
    </Box>
  )
}

export default BillBreakdownInput
