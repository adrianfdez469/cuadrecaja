import React, { FC, useEffect, useMemo, useState } from "react";
import {
  Modal, Box, Typography, Button, FormControl, InputLabel, InputAdornment,
  OutlinedInput, Select, MenuItem, TextField, Stack, Collapse, Divider, Chip,
} from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { moneyRegex } from '@/utils/regex'
import { useMessageContext } from "@/context/MessageContext";
import { formatCurrency } from "@/utils/formatters";
import { ITransferDestination } from "@/schemas/transferDestination";
import type { DiscountApplicationResult, DiscountApplicationResultItem } from "@/lib/discounts";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { useAppContext } from "@/context/AppContext";
import { MultiCurrencyPayment } from "@/components/MultiCurrencyPayment/MultiCurrencyPayment";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { calcularVuelto, convertToBase } from "@/lib/currency";

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

const PaymentModal: FC<IProps> = ({ open, onClose, total, makePay, transferDestinations, tiendaId, products }) => {
  const { monedasNegocio, tasasVigentes, monedaBase, monedaFuerte } = useAppContext();
  const { showMessage } = useMessageContext();

  const monedasActivas = monedasNegocio.filter((m) => m.activo);
  // Business has extra currencies configured
  const hasExtraCurrencies = monedasActivas.some((m) => m.monedaCode !== monedaBase);

  // ─── Discounts ───────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);

  // ─── Currency selector (top) ─────────────────────────────────────────────
  // Default = monedaBase of the business; original UI shown when cobro == monedaBase
  const [monedaCobro, setMonedaCobro] = useState(monedaBase);

  // All selectable currencies: base + activas extras
  const todasMonedas = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

  // Mono vs multi mode: original UI only when cobro currency == monedaBase
  const isMultiMode = hasExtraCurrencies && monedaCobro !== monedaBase;

  // ─── Multi-currency state ─────────────────────────────────────────────────
  const [pagosMulti, setPagosMulti] = useState<IPagoLinea[]>([]);

  const denominaciones = useMemo<Record<string, number[]>>(() => {
    const map: Record<string, number[]> = {};
    for (const nm of monedasActivas) {
      if (nm.moneda?.denominaciones) {
        map[nm.monedaCode] = nm.moneda.denominaciones
          .filter((d) => d.activo)
          .map((d) => d.valor)
          .sort((a, b) => b - a);
      }
    }
    return map;
  }, [monedasActivas]);

  const totalPagadoMulti = useMemo(
    () => pagosMulti.reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase), 0),
    [pagosMulti, tasasVigentes, monedaBase],
  );

  const finalTotal = useMemo(() => Math.max(0, total - discountTotal), [total, discountTotal]);

  const vueltoMulti = useMemo(
    () => calcularVuelto(finalTotal, pagosMulti, monedaCobro, monedaBase, tasasVigentes, denominaciones),
    [finalTotal, pagosMulti, monedaCobro, monedaBase, tasasVigentes, denominaciones],
  );

  // When switching to a non-default currency, pre-populate one payment line in that currency
  useEffect(() => {
    if (isMultiMode) {
      const info = monedasActivas.find((m) => m.monedaCode === monedaCobro);
      setPagosMulti([{
        tipo: info?.admiteEfectivo !== false ? 'cash' : 'transfer',
        moneda: monedaCobro,
        monto: 0,
        equivalenteBase: 0,
      }]);
    } else {
      setPagosMulti([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monedaCobro]);

  // ─── Mono-currency state (original UI) ────────────────────────────────────
  const [cashOverride, setCashOverride] = useState<number | null>(null);
  const [transferReceived, setTransferReceived] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);
  const [transferDestinationId, setTransferDestinationId] = useState(
    transferDestinations.length === 0 ? "" :
      transferDestinations.length === 1 ? transferDestinations[0].id :
        transferDestinations.find(d => d.default)?.id || transferDestinations[0].id
  );

  const cashReceived = useMemo(() => {
    if (cashOverride !== null) return cashOverride;
    if (showBreakdown) return 0;
    return Math.max(0, finalTotal - transferReceived);
  }, [cashOverride, showBreakdown, finalTotal, transferReceived]);

  // Reset monedaCobro when negocio config changes
  useEffect(() => {
    setMonedaCobro(monedaBase);
  }, [monedaBase]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleClose = () => {
    setCashOverride(null);
    setTransferReceived(0);
    setShowBreakdown(false);
    setBreakdownResetKey((k) => k + 1);
    setPagosMulti([]);
    onClose();
  };

  const handlePayment = async () => {
    try {
      handleClose();
      if (isMultiMode) {
        const multimoneda: IMultimonedaExtras = {
          monedaCobro,
          pagosDetalle: pagosMulti,
          vueltoDetalle: vueltoMulti,
          tasaSnapshot: tasasVigentes,
        };
        const totalcashBase = pagosMulti
          .filter((p) => p.tipo === 'cash')
          .reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase), 0);
        const totalTransferBase = pagosMulti
          .filter((p) => p.tipo === 'transfer')
          .reduce((s, p) => s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase), 0);
        const firstTransferDestId = pagosMulti.find((p) => p.tipo === 'transfer')?.transferDestinationId;
        makePay(finalTotal, totalcashBase, totalTransferBase, firstTransferDestId, promoCode ? [promoCode] : [], multimoneda)
          .catch((e) => console.error("❌ Error pago multimoneda:", e));
      } else {
        makePay(finalTotal, cashReceived, transferReceived, transferDestinationId, promoCode ? [promoCode] : [])
          .catch((e) => console.error("❌ Error pago:", e));
      }
    } catch (error) {
      console.error("Error en handlePayment:", error);
      showMessage("❌ Error inesperado al iniciar el pago", "error");
    }
  };

  const handleToggleBreakdown = () => {
    setShowBreakdown((prev) => {
      if (!prev) setBreakdownResetKey((k) => k + 1);
      setCashOverride(null);
      return !prev;
    });
  };

  const handleCashReceived = (cash: string) => {
    if (moneyRegex.test(cash)) setCashOverride(Number.parseInt(cash));
    else if (cash === "") setCashOverride(0);
  };

  const handleTransferReceived = (transfer: string) => {
    if (moneyRegex.test(transfer)) {
      setTransferReceived(Number.parseInt(transfer));
      if (!showBreakdown) setCashOverride(null);
    } else if (transfer === "") {
      setTransferReceived(0);
      if (!showBreakdown) setCashOverride(null);
    }
  };

  const previewDiscount = async (codes?: string[]): Promise<void> => {
    try {
      const res = await fetch('/api/discounts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiendaId, products,
          ...(codes && codes.length > 0 ? { discountCodes: codes } : {})
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error previsualizando descuento');
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

  const canConfirmMono = cashReceived + transferReceived >= finalTotal;
  const canConfirmMulti = totalPagadoMulti >= finalTotal && pagosMulti.length > 0;
  const canConfirm = isMultiMode ? canConfirmMulti : canConfirmMono;

  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "background.paper",
          p: { xs: 2.5, sm: 4 },
          borderRadius: 2,
          boxShadow: 24,
          width: { xs: '95vw', sm: 420 },
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* ── Total header ── */}
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

        {hasExtraCurrencies && todasMonedas.length > 1 && (
            <FormControl size="small" fullWidth sx={{ mb: 2 }}>
              <InputLabel>Cobrar en</InputLabel>
              <Select value={monedaCobro} label="Cobrar en" onChange={(e) => setMonedaCobro(e.target.value)}>
                {todasMonedas.map((code) => (
                    <MenuItem key={code} value={code}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        {code}
                        {code === monedaBase && (
                            <Chip label="Por defecto" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                        )}
                      </Stack>
                    </MenuItem>
                ))}
              </Select>
            </FormControl>
        )}

        {/* ── Payment section ── */}
        {isMultiMode ? (
          /* Multi-currency UI */
          <MultiCurrencyPayment
            totalBase={finalTotal}
            monedaBase={monedaBase}
            monedaCobro={monedaCobro}
            monedasDisponibles={monedasActivas}
            tasas={tasasVigentes}
            denominaciones={denominaciones}
            pagos={pagosMulti}
            onPagosChange={setPagosMulti}
            transferDestinations={transferDestinations}
          />
        ) : (
          /* Original mono-currency UI */
          <>
            <FormControl fullWidth>
              <InputLabel>Efectivo</InputLabel>
              <OutlinedInput
                startAdornment={<InputAdornment position="start"><AttachMoneyIcon /></InputAdornment>}
                label="Efectivo"
                value={cashReceived}
                onChange={(e) => !showBreakdown && handleCashReceived(e.target.value)}
                inputProps={{ readOnly: showBreakdown }}
                sx={showBreakdown ? { bgcolor: 'action.hover' } : {}}
              />
            </FormControl>

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
                    onChange={(t) => setCashOverride(t)}
                    resetKey={breakdownResetKey}
                  />
                </Box>
              )}
            </Collapse>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Transferencia</InputLabel>
              <OutlinedInput
                startAdornment={<InputAdornment position="start"><CreditCardIcon /></InputAdornment>}
                label="Transferencia"
                value={transferReceived}
                onChange={(e) => handleTransferReceived(e.target.value)}
              />
            </FormControl>

            {transferReceived > 0 && transferDestinations.length > 0 && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Local</InputLabel>
                <Select value={transferDestinationId} onChange={(e) => setTransferDestinationId(e.target.value)}>
                  {transferDestinations.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Divider sx={{ mb: 2 }} />

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
                    {applied.map((d) => (
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

            <Stack spacing={0.5} mt={2} mb={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6" color={discountTotal > 0 ? 'success.main' : 'inherit'} fontWeight={600}>
                  {formatCurrency(finalTotal)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6" color="success.main">Cambio:</Typography>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(Math.max(0, cashReceived + transferReceived - finalTotal))}
                </Typography>
              </Stack>
            </Stack>
          </>
        )}

        {/* ── Action buttons ── */}
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
