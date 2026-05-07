import { FC } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { formatCurrency } from '@/utils/formatters'

interface Props {
  total: number
  targetAmount?: number
  overLabel?: string
}

const BillBreakdownSummary: FC<Props> = ({ total, targetAmount, overLabel = 'Cambio' }) => {
  const hasTarget = targetAmount !== undefined

  const getStatus = () => {
    if (!hasTarget) return null
    if (total === 0) return null
    const diff = total - targetAmount
    if (diff === 0) return { color: 'success.main', icon: <CheckCircleOutlineIcon fontSize="small" />, label: 'Cuadre perfecto ✓' }
    if (diff > 0) return { color: 'success.main', icon: <CheckCircleOutlineIcon fontSize="small" />, label: `${overLabel}: ${formatCurrency(diff)}` }
    return { color: 'error.main', icon: <ErrorOutlineIcon fontSize="small" />, label: `Faltan ${formatCurrency(Math.abs(diff))}` }
  }

  const status = getStatus()

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pt: 1,
        mt: 0.5,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="h5" fontWeight={600}>
        Total: {formatCurrency(total)}
      </Typography>
      {status && (
        <Chip
          size="small"
          icon={status.icon}
          label={status.label}
          sx={{
            color: status.color,
            borderColor: status.color,
            '& .MuiChip-icon': { color: status.color },
          }}
          variant="outlined"
        />
      )}
    </Box>
  )
}

export default BillBreakdownSummary
