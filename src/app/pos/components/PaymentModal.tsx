import React, { FC, useEffect, useMemo, useState } from "react";
import { Modal, Box, Typography, Button, FormControl, InputLabel, InputAdornment, OutlinedInput, Select, MenuItem, TextField, Stack, Collapse } from "@mui/material";
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

interface IProps {
  open: boolean;
  onClose: () => void;
  total: number;
  // Ahora permite enviar códigos de descuento opcionales
  makePay: (total: number, totalchash: number, totaltransfer: number, transferDestinationId?: string, discountCodes?: string[]) => Promise<void>
  transferDestinations: ITransferDestination[]
  // Datos necesarios para previsualizar descuentos
  tiendaId: string;
  products: { productoTiendaId: string; cantidad: number; precio: number }[];
}

const PaymentModal: FC<IProps> = ({ open, onClose, total, makePay, transferDestinations, tiendaId, products }) => {
  // null = auto-calculado (finalTotal - transferReceived); number = override manual o desglose
  const [cashOverride, setCashOverride] = useState<number | null>(null);
  const [transferReceived, setTransferReceived] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);
  const { showMessage } = useMessageContext();
  const [transferDestinationId, setTransferDestinationId] = useState(
    transferDestinations.length === 0 ? "" :
      transferDestinations.length === 1 ? transferDestinations[0].id :
        transferDestinations.find(destination => destination.default)?.id || transferDestinations[0].id
  );
  // Descuentos
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);
  const finalTotal = useMemo(() => Math.max(0, total - discountTotal), [total, discountTotal]);
  // Derivado: si override nulo y breakdown cerrado → auto = finalTotal - transfer
  const cashReceived = useMemo(() => {
    if (cashOverride !== null) return cashOverride;
    if (showBreakdown) return 0;
    return Math.max(0, finalTotal - transferReceived);
  }, [cashOverride, showBreakdown, finalTotal, transferReceived]);

  const handlePayment = async () => {
    try {
      // Cerrar el modal inmediatamente
      handleClose();

      // Ejecutar el pago de forma asíncrona
      // No mostramos notificaciones aquí porque handleMakePay se encarga de eso
      makePay(finalTotal, cashReceived, transferReceived, transferDestinationId, promoCode ? [promoCode] : [])
        .then(() => {
        })
        .catch((error) => {
          console.error("❌ Error procesando pago:", error);
          // handleMakePay ya maneja las notificaciones de error
        });

    } catch (error) {
      console.error("Error en handlePayment:", error);
      showMessage("❌ Error inesperado al iniciar el pago", "error");
    }
  };

  const handleClose = () => {
    setCashOverride(null);
    setTransferReceived(0);
    setShowBreakdown(false);
    setBreakdownResetKey((k) => k + 1);
    onClose();
  }

  const handleToggleBreakdown = () => {
    setShowBreakdown((prev) => {
      if (!prev) setBreakdownResetKey((k) => k + 1);
      setCashOverride(null);
      return !prev;
    });
  };

  const validateMoneyInput = (money: string) => {
    return moneyRegex.test(money);
  }

  const handleCashReceived = (cash: string) => {
    if (validateMoneyInput(cash)) {
      setCashOverride(Number.parseInt(cash));
    } else if (cash === "") {
      setCashOverride(0);
    }
  }

  const handleTransferReceived = (trasnfer: string) => {
    if (validateMoneyInput(trasnfer)) {
      setTransferReceived(Number.parseInt(trasnfer));
      if (!showBreakdown) setCashOverride(null);
    } else if (trasnfer === "") {
      setTransferReceived(0);
      if (!showBreakdown) setCashOverride(null);
    }
  }

  // useEffect(() => {
  //   if (transferDestinations.length > 0 && !transferDestinationId) {
  //     const defaultDest = transferDestinations.find(d => d.default) ?? transferDestinations[0];
  //     setTransferDestinationId(defaultDest.id);
  //   }
  // }, [transferDestinations])

  const previewDiscount = async (codes?: string[]): Promise<void> => {
    try {
      // Permitir previsualización incluso sin código para aplicar reglas automáticas
      const res = await fetch('/api/discounts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiendaId,
          products,
          ...(codes && codes.length > 0 ? { discountCodes: codes } : {})
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error previsualizando descuento');
      const data = (await res.json()) as DiscountApplicationResult;
      setDiscountTotal(Number(data.discountTotal) || 0);
      setApplied(Array.isArray(data.applied) ? data.applied : []);
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error('Error preview descuento', e.message);
      } else {
        console.error('Error preview descuento', e);
      }
      setDiscountTotal(0);
      setApplied([]);
      showMessage('No se pudo aplicar el código de descuento', 'warning');
    }
  };

  // Previsualizar automáticamente al abrir el modal o si cambian los productos
  useEffect(() => {
    if (open) {
      previewDiscount(promoCode ? [promoCode] : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(products)]);

  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "white",
          p: 4,
          borderRadius: 2,
          boxShadow: 24,
          width: { xs: '95vw', sm: 420 },
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Cobrar:
          {discountTotal > 0 && (
            <>
              <span style={{ textDecoration: 'line-through', color: '#999', marginLeft: '8px' }}>
                {formatCurrency(total)}
              </span>
              {' '}
            </>
          )}
          <span style={{ color: discountTotal > 0 ? '#2e7d32' : 'inherit' }}>
            {formatCurrency(finalTotal)}
          </span>
        </Typography>


        <FormControl fullWidth>
          <InputLabel htmlFor="outlined-adornment-amount">Efectivo</InputLabel>
          <OutlinedInput
            id="outlined-adornment-cash"
            startAdornment={<InputAdornment position="start"><AttachMoneyIcon /></InputAdornment>}
            label="Efectivo"
            value={cashReceived}
            onChange={(e) => !showBreakdown && handleCashReceived(e.target.value)}
            inputProps={{ readOnly: showBreakdown }}
            sx={showBreakdown ? { bgcolor: 'action.hover' } : {}}
          />
        </FormControl>

        <Button
          variant="text"
          size="small"
          onClick={handleToggleBreakdown}
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

        <FormControl fullWidth sx={{ marginTop: 2 }}>
          <InputLabel htmlFor="outlined-adornment-amount">Transferencia</InputLabel>
          <OutlinedInput
            id="outlined-adornment-transfer"
            startAdornment={<InputAdornment position="start"><CreditCardIcon /></InputAdornment>}
            label="Transferencia"
            value={transferReceived}
            onChange={(e) => handleTransferReceived(e.target.value)}
          />
        </FormControl>

        {transferReceived > 0 && transferDestinations.length > 0 &&
          <FormControl fullWidth margin="normal">
            <InputLabel>Local</InputLabel>
            <Select
              value={transferDestinationId}
              onChange={(e) => setTransferDestinationId(e.target.value as string)}
            >
              {transferDestinations.map((destination) => (
                <MenuItem key={destination.id} value={destination.id}>
                  {destination.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }

        <Stack spacing={1} mb={2} sx={{ marginTop: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Código de descuento"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  previewDiscount(promoCode ? [promoCode] : undefined);
                }
              }}
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => previewDiscount(promoCode ? [promoCode] : undefined)}
              sx={{ minWidth: '100px' }}
              size="small"
            >
              Aplicar
            </Button>
          </Box>
          {/* Listado de descuentos aplicados, uno debajo del otro */}
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
          <Typography variant="h6" mt={2}>
            Total:
            {discountTotal > 0 && (
              <>
                <span style={{ textDecoration: 'line-through', color: '#999', marginLeft: '8px' }}>
                  {formatCurrency(total)}
                </span>
                {' '}
              </>
            )}
            <span style={{ color: discountTotal > 0 ? '#2e7d32' : 'inherit', fontWeight: discountTotal > 0 ? 600 : 'inherit' }}>
              {formatCurrency(finalTotal)}
            </span>
          </Typography>
          <Typography variant="h6" color="green" mt={1}>
            Cambio: {formatCurrency(cashReceived + transferReceived - finalTotal)}
          </Typography>
        </Stack>



        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handlePayment}
          disabled={cashReceived + transferReceived < finalTotal}
        >
          🚀 Confirmar Pago
        </Button>

        <Button
          variant="outlined"
          fullWidth
          sx={{ mt: 1 }}
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </Box>
    </Modal>
  );
};

export default PaymentModal;
