"use client";

import {
  Box, Button, Chip, Divider, FormControl, IconButton, InputAdornment,
  InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Add, AttachMoney, CreditCard, Delete } from '@mui/icons-material';
import { useMemo } from 'react';
import { calcularVuelto, convertFromBase, convertToBase } from '@/lib/currency';
import type { INegocioMoneda } from '@/schemas/moneda';
import type { ITasaSnapshot } from '@/schemas/tasaCambio';
import type { IPagoLinea, IVueltoLinea } from '@/schemas/pago';

export interface MultiCurrencyPaymentProps {
  totalBase: number;
  monedaBase: string;
  monedaCobro: string;
  monedasDisponibles: INegocioMoneda[];
  tasas: ITasaSnapshot;
  denominaciones: Record<string, number[]>;
  pagos: IPagoLinea[];
  onPagosChange: (pagos: IPagoLinea[]) => void;
  transferDestinations: { id: string; nombre: string; default: boolean }[];
}

export function MultiCurrencyPayment({
  totalBase,
  monedaBase,
  monedaCobro,
  monedasDisponibles,
  tasas,
  denominaciones,
  pagos,
  onPagosChange,
  transferDestinations,
}: MultiCurrencyPaymentProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalPagadoBase = useMemo(
    () => pagos.reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasas, monedaBase), 0),
    [pagos, tasas, monedaBase],
  );

  const vuelto: IVueltoLinea[] = useMemo(
    () => calcularVuelto(totalBase, pagos, monedaCobro, monedaBase, tasas, denominaciones),
    [totalBase, pagos, monedaCobro, monedaBase, tasas, denominaciones],
  );

  const totalEnMonedaCobro = useMemo(
    () => convertFromBase(totalBase, monedaCobro, tasas, monedaBase),
    [totalBase, monedaCobro, tasas, monedaBase],
  );

  const falta = totalPagadoBase < totalBase;

  const todasMonedas = useMemo(() => {
    const lista: INegocioMoneda[] = [{ monedaCode: monedaBase, admiteEfectivo: true, admiteTransferencia: true, activo: true, negocioId: '', id: '' }];
    for (const m of monedasDisponibles) {
      if (m.monedaCode !== monedaBase && m.activo) lista.push(m);
    }
    return lista;
  }, [monedaBase, monedasDisponibles]);

  // Remaining amount (in monedaBase) after the already-entered payments
  const remaining = useMemo(
    () => Math.max(0, totalBase - totalPagadoBase),
    [totalBase, totalPagadoBase],
  );

  const suggestMonto = (moneda: string, excludeIdx?: number): number => {
    const otherPaid = pagos
      .filter((_, i) => i !== excludeIdx)
      .reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasas, monedaBase), 0);
    const rem = Math.max(0, totalBase - otherPaid);
    if (rem <= 0) return 0;
    return parseFloat(convertFromBase(rem, moneda, tasas, monedaBase).toFixed(2));
  };

  const addPago = () => {
    const primeraMoneda = todasMonedas.find((m) => m.admiteEfectivo) ?? todasMonedas[0];
    const monto = suggestMonto(primeraMoneda.monedaCode);
    onPagosChange([
      ...pagos,
      { tipo: 'cash', moneda: primeraMoneda.monedaCode, monto, equivalenteBase: convertToBase(monto, primeraMoneda.monedaCode, tasas, monedaBase) },
    ]);
  };

  const updatePago = (idx: number, partial: Partial<IPagoLinea>) => {
    const updated = pagos.map((p, i) => {
      if (i !== idx) return p;
      const merged = { ...p, ...partial };
      // When only the currency changes, suggest the remaining amount in the new currency
      if ('moneda' in partial && !('monto' in partial)) {
        merged.monto = suggestMonto(merged.moneda, idx);
      }
      merged.equivalenteBase = convertToBase(merged.monto, merged.moneda, tasas, monedaBase);
      return merged;
    });
    onPagosChange(updated);
  };

  const removePago = (idx: number) => onPagosChange(pagos.filter((_, i) => i !== idx));

  const monedaInfo = (code: string) => todasMonedas.find((m) => m.monedaCode === code);

  return (
    <Stack gap={1.5}>
      {/* Total en moneda de cobro */}
      <Typography variant="h5" fontWeight="bold">
        Total:&nbsp;{totalEnMonedaCobro.toFixed(2)} {monedaCobro}
      </Typography>
      {monedaCobro !== monedaBase && (
        <Typography variant="caption" color="text.secondary" display="block" mt={-0.5}>
          = {totalBase.toFixed(2)} {monedaBase}
        </Typography>
      )}

      <Divider />

      {/* Líneas de pago */}
      <Typography variant="subtitle2" color="text.secondary">Pagos recibidos</Typography>

      {pagos.map((p, idx) => {
        const info = monedaInfo(p.moneda);
        const tipoOpts: { value: IPagoLinea['tipo']; label: string; icon: React.ReactNode }[] = [];
        if (info?.admiteEfectivo) tipoOpts.push({ value: 'cash', label: 'Efectivo', icon: <AttachMoney fontSize="small" /> });
        if (info?.admiteTransferencia) tipoOpts.push({ value: 'transfer', label: 'Transfer', icon: <CreditCard fontSize="small" /> });

        const eqBase = p.monto > 0 && p.moneda !== monedaBase
          ? convertToBase(p.monto, p.moneda, tasas, monedaBase)
          : null;

        return isMobile ? (
          /* ── Mobile: stacked layout ── */
          <Box
            key={idx}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}
          >
            {/* Row 1: moneda + tipo */}
            <Stack direction="row" gap={1} mb={1.5}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Moneda</InputLabel>
                <Select value={p.moneda} label="Moneda" onChange={(e) => updatePago(idx, { moneda: e.target.value, tipo: 'cash' })}>
                  {todasMonedas.map((m) => (
                    <MenuItem key={m.monedaCode} value={m.monedaCode}>{m.monedaCode}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={p.tipo} label="Tipo" onChange={(e) => updatePago(idx, { tipo: e.target.value as IPagoLinea['tipo'] })}>
                  {tipoOpts.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      <Stack direction="row" alignItems="center" gap={0.5}>{o.icon}{o.label}</Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* Row 2: monto + equivalente */}
            <Stack direction="row" gap={1} alignItems="center" mb={1.5}>
              <TextField
                size="small"
                label={`Monto (${p.moneda})`}
                type="number"
                value={p.monto || ''}
                onChange={(e) => updatePago(idx, { monto: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ flex: 1 }}
              />
              {eqBase !== null && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  ≈ {eqBase.toFixed(2)} {monedaBase}
                </Typography>
              )}
            </Stack>

            {/* Row 3: destination */}
            {p.tipo === 'transfer' && transferDestinations.length > 0 && (
              <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                <InputLabel>Destino</InputLabel>
                <Select
                  value={p.transferDestinationId ?? ''}
                  label="Destino"
                  onChange={(e) => updatePago(idx, { transferDestinationId: e.target.value })}
                >
                  {transferDestinations.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Row 4: delete button full width */}
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Delete />}
              onClick={() => removePago(idx)}
              fullWidth
            >
              Eliminar pago
            </Button>
          </Box>
        ) : (
          /* ── Desktop: row layout ── */
          <Stack key={idx} direction="row" gap={1} alignItems="flex-start">
            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Moneda</InputLabel>
              <Select value={p.moneda} label="Moneda" onChange={(e) => updatePago(idx, { moneda: e.target.value, tipo: 'cash' })}>
                {todasMonedas.map((m) => (
                  <MenuItem key={m.monedaCode} value={m.monedaCode}>{m.monedaCode}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Tipo</InputLabel>
              <Select value={p.tipo} label="Tipo" onChange={(e) => updatePago(idx, { tipo: e.target.value as IPagoLinea['tipo'] })}>
                {tipoOpts.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    <Stack direction="row" alignItems="center" gap={0.5}>{o.icon}{o.label}</Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label={`Monto (${p.moneda})`}
              type="number"
              value={p.monto || ''}
              onChange={(e) => updatePago(idx, { monto: parseFloat(e.target.value) || 0 })}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ flex: 1 }}
            />

            {p.tipo === 'transfer' && transferDestinations.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Destino</InputLabel>
                <Select
                  value={p.transferDestinationId ?? ''}
                  label="Destino"
                  onChange={(e) => updatePago(idx, { transferDestinationId: e.target.value })}
                >
                  {transferDestinations.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {eqBase !== null && (
              <Tooltip title={`= ${eqBase.toFixed(2)} ${monedaBase}`}>
                <Chip label={`≈${eqBase.toFixed(0)} ${monedaBase}`} size="small" sx={{ mt: 1 }} />
              </Tooltip>
            )}

            <IconButton size="small" color="error" onClick={() => removePago(idx)} sx={{ mt: 0.5 }}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}

      <Button startIcon={<Add />} onClick={addPago} size="small" sx={{ alignSelf: 'flex-start' }}>
        Agregar pago
      </Button>

      <Divider />

      {/* Resumen */}
      <Stack spacing={0.5}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">Total recibido:</Typography>
          <Typography variant="h6" fontWeight={600}>{totalPagadoBase.toFixed(2)} {monedaBase}</Typography>
        </Stack>
        {falta ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6" color="error">Falta:</Typography>
            <Typography variant="h6" color="error">{(totalBase - totalPagadoBase).toFixed(2)} {monedaBase}</Typography>
          </Stack>
        ) : vuelto.length === 0 ? (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6" color="success.main">Cambio:</Typography>
            <Typography variant="h6" color="success.main">0.00</Typography>
          </Stack>
        ) : (
          vuelto.map((v) => (
            <Stack key={v.moneda} direction="row" justifyContent="space-between">
              <Typography variant="h6" color="success.main">
                Cambio{vuelto.length > 1 ? ` (${v.moneda})` : ''}:
              </Typography>
              <Typography variant="h6" color="success.main">{v.monto.toFixed(2)} {v.moneda}</Typography>
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}

export type { IPagoLinea, IVueltoLinea };
