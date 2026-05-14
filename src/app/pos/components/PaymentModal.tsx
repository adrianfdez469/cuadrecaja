import React, { FC, useEffect, useMemo, useState } from "react";
import {
  Modal, Box, Typography, Button, FormControl, InputLabel, InputAdornment,
  OutlinedInput, Select, MenuItem, TextField, Stack, Collapse, Divider, Chip,
  Menu, IconButton,
} from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { moneyRegex } from '@/utils/regex';
import { useMessageContext } from "@/context/MessageContext";
import { formatCurrency } from "@/utils/formatters";
import { ITransferDestination } from "@/schemas/transferDestination";
import type { DiscountApplicationResult, DiscountApplicationResultItem } from "@/lib/discounts";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { useAppContext } from "@/context/AppContext";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { calcularVuelto, convertToBase, convertFromBase } from "@/lib/currency";

export interface IMultimonedaExtras {
  monedaCobro: string;
  pagosDetalle: IPagoLinea[];
  vueltoDetalle: IVueltoLinea[];
  tasaSnapshot: ITasaSnapshot;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  total: number;
  makePay: (
    total: number,
    totalcash: number,
    totaltransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras
  ) => Promise<void>;
  transferDestinations: ITransferDestination[];
  tiendaId: string;
  products: { productoTiendaId: string; cantidad: number; precio: number }[];
}

type PagoMoneda = { cash: number; transfer: number; transferDestId: string };

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0 ? "" :
    dests.length === 1 ? dests[0].id :
      dests.find(d => d.default)?.id ?? dests[0].id;

const PaymentModal: FC<IProps> = ({ open, onClose, total, makePay, transferDestinations, tiendaId, products }) => {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();

  const monedasActivas = monedasNegocio.filter(m => m.activo);
  const hasExtraCurrencies = monedasActivas.some(m => m.monedaCode !== monedaBase);

  // ─── Discounts ────────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);

  const finalTotal = useMemo(() => Math.max(0, total - discountTotal), [total, discountTotal]);

  // ─── Payments ─────────────────────────────────────────────────────────────
  // Keyed by moneda code; insertion order = display order
  const [pagosMap, setPagosMap] = useState<Record<string, PagoMoneda>>({});
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);

  const monedas = Object.keys(pagosMap);

  const todasMonedas = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

  const monedasDisponibles = useMemo(
    () => todasMonedas.filter(code => !pagosMap[code]),
    [todasMonedas, pagosMap],
  );

  const denominaciones = useMemo<Record<string, number[]>>(() => {
    const map: Record<string, number[]> = {};
    for (const nm of monedasActivas) {
      if (nm.moneda?.denominaciones) {
        map[nm.monedaCode] = nm.moneda.denominaciones
          .filter(d => d.activo).map(d => d.valor).sort((a, b) => b - a);
      }
    }
    return map;
  }, [monedasActivas]);

  const totalPagado = useMemo(
    () => Object.entries(pagosMap).reduce(
      (sum, [moneda, { cash, transfer }]) =>
        sum + convertToBase(cash + transfer, moneda, tasasVigentes, monedaBase),
      0,
    ),
    [pagosMap, tasasVigentes, monedaBase],
  );

  // Flat IPagoLinea[] for vuelto calculation and submission
  const pagosLinea = useMemo<IPagoLinea[]>(
    () => Object.entries(pagosMap).flatMap(([moneda, { cash, transfer, transferDestId }]) => {
      const arr: IPagoLinea[] = [];
      if (cash > 0) arr.push({ tipo: 'cash', moneda, monto: cash, equivalenteBase: convertToBase(cash, moneda, tasasVigentes, monedaBase) });
      if (transfer > 0) arr.push({ tipo: 'transfer', moneda, monto: transfer, equivalenteBase: convertToBase(transfer, moneda, tasasVigentes, monedaBase), transferDestinationId: transferDestId });
      return arr;
    }),
    [pagosMap, tasasVigentes, monedaBase],
  );

  const vuelto = useMemo(
    () => calcularVuelto(finalTotal, pagosLinea, monedaBase, monedaBase, tasasVigentes, denominaciones),
    [finalTotal, pagosLinea, monedaBase, tasasVigentes, denominaciones],
  );

  const falta = totalPagado < finalTotal;

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPagosMap({ [monedaBase]: { cash: 0, transfer: 0, transferDestId: defaultDestId(transferDestinations) } });
    setShowBreakdown(false);
    setBreakdownResetKey(k => k + 1);
  }, [open, monedaBase]);

  // Sync base cash when finalTotal resolves (discount) — only while single-currency
  useEffect(() => {
    if (!open || finalTotal <= 0) return;
    setPagosMap(prev => {
      const keys = Object.keys(prev);
      if (keys.length !== 1 || keys[0] !== monedaBase) return prev;
      const base = prev[monedaBase];
      return { [monedaBase]: { ...base, cash: finalTotal } };
    });
  }, [finalTotal, monedaBase, open]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const suggestCash = (moneda: string, excludeMoneda?: string): number => {
    const otherPaid = Object.entries(pagosMap)
      .filter(([m]) => m !== excludeMoneda)
      .reduce((s, [m, { cash, transfer }]) => s + convertToBase(cash + transfer, m, tasasVigentes, monedaBase), 0);
    const rem = Math.max(0, finalTotal - otherPaid);
    if (rem <= 0) return 0;
    return parseFloat(convertFromBase(rem, moneda, tasasVigentes, monedaBase).toFixed(2));
  };

  const updatePago = (moneda: string, partial: Partial<PagoMoneda>) => {
    setPagosMap(prev => ({ ...prev, [moneda]: { ...prev[moneda], ...partial } }));
  };

  const addCurrency = (moneda: string) => {
    const cash = suggestCash(moneda);
    setPagosMap(prev => ({
      ...prev,
      [moneda]: { cash, transfer: 0, transferDestId: defaultDestId(transferDestinations) },
    }));
    setAddMenuAnchor(null);
  };

  const removeCurrency = (moneda: string) => {
    setPagosMap(prev => {
      const next = { ...prev };
      delete next[moneda];
      return next;
    });
    if (moneda === monedaBase) setShowBreakdown(false);
  };

  const handleToggleBreakdown = () => {
    if (!showBreakdown) {
      setBreakdownResetKey(k => k + 1);
    } else {
      const transfer = pagosMap[monedaBase]?.transfer ?? 0;
      updatePago(monedaBase, { cash: Math.max(0, finalTotal - transfer) });
    }
    setShowBreakdown(prev => !prev);
  };

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleClose = () => {
    setPagosMap({});
    setShowBreakdown(false);
    setBreakdownResetKey(k => k + 1);
    onClose();
  };

  const handlePayment = async () => {
    try {
      const pagosArr = pagosLinea;
      handleClose();
      const totalcashBase = pagosArr.filter(p => p.tipo === 'cash')
        .reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase), 0);
      const totalTransferBase = pagosArr.filter(p => p.tipo === 'transfer')
        .reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase), 0);
      const firstTransferDestId = pagosArr.find(p => p.tipo === 'transfer')?.transferDestinationId;
      const multimoneda: IMultimonedaExtras = {
        monedaCobro: monedaBase,
        pagosDetalle: pagosArr,
        vueltoDetalle: vuelto,
        tasaSnapshot: tasasVigentes,
      };
      makePay(finalTotal, totalcashBase, totalTransferBase, firstTransferDestId, promoCode ? [promoCode] : [], multimoneda)
        .catch(e => console.error("Error pago:", e));
    } catch (error) {
      console.error("Error en handlePayment:", error);
      showMessage("Error inesperado al iniciar el pago", "error");
    }
  };

  // ─── Discounts ────────────────────────────────────────────────────────────
  const previewDiscount = async (codes?: string[]): Promise<void> => {
    try {
      const res = await fetch('/api/discounts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiendaId, products, ...(codes?.length ? { discountCodes: codes } : {}) })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const data = (await res.json()) as DiscountApplicationResult;
      setDiscountTotal(Number(data.discountTotal) || 0);
      setApplied(Array.isArray(data.applied) ? data.applied : []);
    } catch (e: unknown) {
      console.error('Error preview descuento', e);
      setDiscountTotal(0);
      setApplied([]);
      showMessage('No se pudo aplicar el código de descuento', 'warning');
    }
  };

  useEffect(() => {
    if (open) previewDiscount(promoCode ? [promoCode] : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(products)]);

  const canConfirm = finalTotal === 0
    ? monedas.length > 0
    : !falta && totalPagado > 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "background.paper",
          p: { xs: 2.5, sm: 4 },
          borderRadius: 2, boxShadow: 24,
          width: { xs: '95vw', sm: 420 },
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* ── Header ── */}
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Cobrar:&nbsp;
          {discountTotal > 0 && (
            <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 6 }}>
              {formatCurrency(total)}
            </span>
          )}
          <span style={{ color: discountTotal > 0 ? '#2e7d32' : 'inherit' }}>
            {formatCurrency(finalTotal)}
          </span>
        </Typography>

        {/* ── Payment sections ── */}
        {monedas.map((moneda, idx) => {
          const isBase = moneda === monedaBase;
          const pago = pagosMap[moneda];
          const info = monedasActivas.find(m => m.monedaCode === moneda);
          const admiteEfectivo = isBase || (info?.admiteEfectivo ?? true);
          const admiteTransfer = isBase || (info?.admiteTransferencia ?? false);
          const totalMoneda = pago.cash + pago.transfer;
          const eqBase = !isBase && totalMoneda > 0
            ? convertToBase(totalMoneda, moneda, tasasVigentes, monedaBase)
            : null;

          return (
            <Box key={moneda}>
              {idx > 0 && <Divider sx={{ my: 2 }} />}

              {/* Currency label + remove */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Chip
                  label={moneda}
                  size="small"
                  color={isBase ? "primary" : "default"}
                  variant={isBase ? "filled" : "outlined"}
                />
                {!isBase && (
                  <IconButton size="small" onClick={() => removeCurrency(moneda)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              {/* Efectivo */}
              {admiteEfectivo && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Efectivo</InputLabel>
                    <OutlinedInput
                      startAdornment={<InputAdornment position="start"><AttachMoneyIcon /></InputAdornment>}
                      label="Efectivo"
                      value={isBase ? pago.cash : (pago.cash || '')}
                      type={isBase ? undefined : 'number'}
                      onChange={(e) => {
                        if (isBase && !showBreakdown) {
                          const v = e.target.value;
                          if (moneyRegex.test(v)) updatePago(moneda, { cash: Number(v) });
                          else if (v === '') updatePago(moneda, { cash: 0 });
                        } else if (!isBase) {
                          updatePago(moneda, { cash: parseFloat(e.target.value) || 0 });
                        }
                      }}
                      inputProps={{ readOnly: isBase && showBreakdown }}
                      sx={isBase && showBreakdown ? { bgcolor: 'action.hover' } : {}}
                    />
                  </FormControl>

                  {isBase && (
                    <>
                      <Button
                        variant="text" size="small" onClick={handleToggleBreakdown}
                        startIcon={showBreakdown ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ mt: 0.5, mb: 0.5, textTransform: 'none', color: 'text.secondary' }}
                      >
                        {showBreakdown ? 'Ocultar desglose' : 'Desglosar billetes'}
                      </Button>
                      <Collapse in={showBreakdown}>
                        {showBreakdown && (
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, pb: 1 }}>
                            <BillBreakdownInput
                              currency={DEFAULT_CURRENCY}
                              targetAmount={finalTotal}
                              onChange={(t) => updatePago(monedaBase, { cash: t })}
                              resetKey={breakdownResetKey}
                            />
                          </Box>
                        )}
                      </Collapse>
                    </>
                  )}
                </>
              )}

              {/* Transferencia */}
              {admiteTransfer && (
                <FormControl fullWidth sx={{ mt: admiteEfectivo ? 2 : 0 }}>
                  <InputLabel>Transferencia</InputLabel>
                  <OutlinedInput
                    startAdornment={<InputAdornment position="start"><CreditCardIcon /></InputAdornment>}
                    label="Transferencia"
                    value={isBase ? pago.transfer : (pago.transfer || '')}
                    type={isBase ? undefined : 'number'}
                    onChange={(e) => {
                      if (isBase) {
                        const v = e.target.value;
                        if (moneyRegex.test(v)) updatePago(moneda, { transfer: Number(v) });
                        else if (v === '') updatePago(moneda, { transfer: 0 });
                      } else {
                        updatePago(moneda, { transfer: parseFloat(e.target.value) || 0 });
                      }
                    }}
                  />
                </FormControl>
              )}

              {/* Transfer destination */}
              {pago.transfer > 0 && transferDestinations.length > 0 && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Destino</InputLabel>
                  <Select
                    value={pago.transferDestId}
                    onChange={(e) => updatePago(moneda, { transferDestId: e.target.value })}
                  >
                    {transferDestinations.map(d => (
                      <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Equivalente en base */}
              {eqBase !== null && (
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  ≈ {eqBase.toFixed(2)} {monedaBase}
                </Typography>
              )}
            </Box>
          );
        })}

        {/* Add currency */}
        {hasExtraCurrencies && monedasDisponibles.length > 0 && (
          <Box mt={2}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => {
                if (monedasDisponibles.length === 1) {
                  addCurrency(monedasDisponibles[0]);
                } else {
                  setAddMenuAnchor(e.currentTarget);
                }
              }}
              sx={{ textTransform: 'none' }}
            >
              Agregar moneda
            </Button>
            <Menu
              anchorEl={addMenuAnchor}
              open={Boolean(addMenuAnchor)}
              onClose={() => setAddMenuAnchor(null)}
            >
              {monedasDisponibles.map(code => (
                <MenuItem key={code} onClick={() => addCurrency(code)}>{code}</MenuItem>
              ))}
            </Menu>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* ── Discounts ── */}
        <Stack spacing={1} mb={2}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Código de descuento"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.trim())}
              onKeyDown={(e) => { if (e.key === 'Enter') previewDiscount(promoCode ? [promoCode] : undefined); }}
              size="small" fullWidth
            />
            <Button variant="contained" onClick={() => previewDiscount(promoCode ? [promoCode] : undefined)} sx={{ minWidth: 90 }} size="small">
              Aplicar
            </Button>
          </Box>
          {applied.length > 0 && (
            <Box>
              {applied.map(d => (
                <Typography key={d.discountRuleId} variant="body2" color="success.main">
                  {d.ruleName || 'Descuento'}: -{formatCurrency(d.amount)}
                </Typography>
              ))}
              <Typography variant="body2" fontWeight={600} mt={0.5}>
                Total descuentos: -({formatCurrency(discountTotal)})
              </Typography>
            </Box>
          )}
        </Stack>

        {/* ── Summary ── */}
        <Stack spacing={0.5} mt={2} mb={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Total:</Typography>
            <Typography variant="h6" color={discountTotal > 0 ? 'success.main' : 'inherit'} fontWeight={600}>
              {formatCurrency(finalTotal)}
            </Typography>
          </Stack>
          {falta ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6" color="error">Falta:</Typography>
              <Typography variant="h6" color="error">
                {(finalTotal - totalPagado).toFixed(2)} {monedaBase}
              </Typography>
            </Stack>
          ) : vuelto.length === 0 ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6" color="success.main">Cambio:</Typography>
              <Typography variant="h6" color="success.main">{formatCurrency(0)}</Typography>
            </Stack>
          ) : (
            vuelto.map(v => (
              <Stack key={v.moneda} direction="row" justifyContent="space-between">
                <Typography variant="h6" color="success.main">
                  Cambio{vuelto.length > 1 ? ` (${v.moneda})` : ''}:
                </Typography>
                <Typography variant="h6" color="success.main">
                  {v.monto.toFixed(2)} {v.moneda}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>

        {/* ── Actions ── */}
        <Button
          variant="contained" color="primary" fullWidth sx={{ mt: 2 }}
          onClick={handlePayment} disabled={!canConfirm}
        >
          🚀 Confirmar Pago
        </Button>
        <Button variant="outlined" fullWidth sx={{ mt: 1 }} onClick={handleClose}>
          Cancelar
        </Button>
      </Box>
    </Modal>
  );
};

export default PaymentModal;
