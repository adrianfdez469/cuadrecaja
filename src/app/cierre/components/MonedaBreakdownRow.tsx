'use client'

import { FC, useEffect, useRef, useState } from 'react'
import { Box, Collapse, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { Chip } from '@mui/material'
import { formatCurrency } from '@/utils/formatters'
import BillBreakdownDynamic from '@/components/BillBreakdown/BillBreakdownDynamic'
import { IBillCount } from '@/schemas/billBreakdown'
import { fetchMonedaBreakdown, saveMonedaBreakdown } from '@/services/cierrePeriodService'

interface Props {
  monedaCode: string
  totalEfectivo: number
  totalTransfer: number
  equivalenteBase: number
  tiendaId: string
  cierreId: string
  isOpen: boolean
  denominations: number[]   // always required — caller resolves from monedasNegocio
}

function itemsToCountMap(items: IBillCount[]): Record<number, number> {
  return items.reduce<Record<number, number>>((acc, { denomination, count }) => {
    acc[denomination] = count
    return acc
  }, {})
}

function countMapToItems(counts: Record<number, number>): IBillCount[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([denomination, count]) => ({ denomination: Number(denomination), count }))
}

const MonedaBreakdownRow: FC<Props> = ({
  monedaCode, totalEfectivo, totalTransfer, equivalenteBase,
  tiendaId, cierreId, isOpen, denominations,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [initialCounts, setInitialCounts] = useState<Record<number, number>>({})
  const [breakdownTotal, setBreakdownTotal] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasDenominations = denominations.length > 0

  // Load status message on mount without requiring the user to expand
  useEffect(() => {
    fetchMonedaBreakdown(tiendaId, cierreId, monedaCode)
      .then((saved) => { if (saved?.items?.length) setBreakdownTotal(saved.total) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cierreId, monedaCode])

  // Load full breakdown when the user expands the row
  useEffect(() => {
    if (!expanded) return
    fetchMonedaBreakdown(tiendaId, cierreId, monedaCode)
      .then((saved) => {
        if (saved?.items?.length) {
          setInitialCounts(itemsToCountMap(saved.items))
          setBreakdownTotal(saved.total)
        } else {
          setInitialCounts({})
          setBreakdownTotal(null)
        }
        setResetKey((k) => k + 1)
      })
      .catch((err) => {
        console.error('[MonedaBreakdown] fetch error:', err)
        setResetKey((k) => k + 1)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, cierreId, monedaCode])

  // isUserChange distinguishes user input (save) from programmatic resets (display only)
  const handleCounts = (counts: Record<number, number>, total: number, isUserChange = false) => {
    setBreakdownTotal(total > 0 ? total : null)
    if (!isOpen || !isUserChange) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveMonedaBreakdown(tiendaId, cierreId, monedaCode, countMapToItems(counts), total)
        .catch((err) => console.error('[MonedaBreakdown] save error:', err))
    }, 800)
  }

  const diff = breakdownTotal !== null ? breakdownTotal - totalEfectivo : null

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Chip label={monedaCode} size="small" color="primary" variant="outlined" />
        <Stack direction="row" gap={3} flexWrap="wrap" alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Efectivo</Typography>
            <Typography variant="body2" fontWeight="medium">{totalEfectivo.toFixed(2)} {monedaCode}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Transferencia</Typography>
            <Typography variant="body2" fontWeight="medium">{totalTransfer.toFixed(2)} {monedaCode}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">≈ Base</Typography>
            <Typography variant="body2" fontWeight="medium" color="success.main">{formatCurrency(equivalenteBase)}</Typography>
          </Box>
          {hasDenominations && (
            <Tooltip title={expanded ? 'Ocultar desglose de billetes' : 'Verificar efectivo en caja'}>
              <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {breakdownTotal !== null && diff !== null && (
        <Typography
          variant="caption"
          color={diff === 0 ? 'success.main' : diff > 0 ? 'warning.main' : 'error.main'}
          display="block"
          mt={0.5}
        >
          {diff === 0
            ? `Cuadre perfecto ✓ — ${breakdownTotal.toFixed(2)} ${monedaCode}`
            : diff > 0
              ? `Excedente: ${diff.toFixed(2)} ${monedaCode} (contado: ${breakdownTotal.toFixed(2)})`
              : `Faltan: ${Math.abs(diff).toFixed(2)} ${monedaCode} (contado: ${breakdownTotal.toFixed(2)})`}
        </Typography>
      )}

      <Collapse in={expanded}>
        <Box sx={{ mt: 1.5, pl: 1, borderLeft: '3px solid', borderColor: 'primary.light' }}>
          <BillBreakdownDynamic
            denominations={denominations}
            targetAmount={totalEfectivo}
            onChange={() => {}}
            onCounts={handleCounts}
            initialCounts={initialCounts}
            resetKey={resetKey}
          />
        </Box>
      </Collapse>
    </Box>
  )
}

export default MonedaBreakdownRow
