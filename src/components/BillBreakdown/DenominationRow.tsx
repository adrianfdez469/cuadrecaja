import { FC } from 'react'
import { Box, Typography } from '@mui/material'
import NumberSpinner from '@/components/NumberSpinner'

interface Props {
  denomination: number
  count: number
  onChange: (count: number) => void
}

const DenominationRow: FC<Props> = ({ denomination, count, onChange }) => {
  const subtotal = denomination * count

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '80px 16px 160px 16px 1fr',
        alignItems: 'center',
        gap: 0.5,
        py: 0.25,
      }}
    >
      <Typography variant="body2" fontWeight={500} textAlign="right">
        {denomination}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">×</Typography>
      <Box sx={{ width: 160, '& .MuiFormControl-root': { width: '100%' } }}>
        <NumberSpinner
          size="small"
          value={count}
          min={0}
          step={1}
          onValueChange={(val) => onChange(val ?? 0)}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" textAlign="center">=</Typography>
      <Typography
        variant="body2"
        color={subtotal > 0 ? 'text.primary' : 'text.disabled'}
        fontWeight={subtotal > 0 ? 500 : 400}
      >
        {subtotal}
      </Typography>
    </Box>
  )
}

export default DenominationRow
