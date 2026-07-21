import React, { FC, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  InputAdornment,
  OutlinedInput,
  Select,
  MenuItem,
  TextField,
  Stack,
  Collapse,
  Divider,
  Chip,
  Menu,
  IconButton,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { moneyRegex } from "@/utils/regex";
import { useMessageContext } from "@/context/MessageContext";
import { ITransferDestination } from "@/schemas/transferDestination";
import type {
  DiscountApplicationResult,
  DiscountApplicationResultItem,
} from "@/lib/discounts";
import BillBreakdownInput from "@/components/BillBreakdown/BillBreakdownInput";
import BillBreakdownDynamic from "@/components/BillBreakdown/BillBreakdownDynamic";
import {
  DEFAULT_CURRENCY,
  DENOMINACIONES,
} from "@/constants/billDenominations";
import { useAppContext } from "@/context/AppContext";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { calcularVuelto, convertToBase, convertFromBase } from "@/lib/currency";

export interface IMultimonedaExtras {
  monedaCobro: string;
  pagosDetalle: IPagoLinea[];
  vueltoDetalle: IVueltoLinea[];
  tasaSnapshot: ITasaSnapshot;
  discountTotal?: number;
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
    multimoneda?: IMultimonedaExtras,
  ) => Promise<void>;
  transferDestinations: ITransferDestination[];
  tiendaId: string;
  cierreId: string;
  products: { productoTiendaId: string; cantidad: number; precio: number }[];
}

type PagoMoneda = { cash: number; transfer: number; transferDestId: string };

const defaultDestId = (dests: ITransferDestination[]) =>
  dests.length === 0
    ? ""
    : dests.length === 1
      ? dests[0].id
      : (dests.find((d) => d.default)?.id ?? dests[0].id);

const PaymentModal: FC<IProps> = ({
  open,
  onClose,
  total,
  makePay,
  transferDestinations,
  tiendaId,
  cierreId,
  products,
}) => {
  const { monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();

  const monedasActivas = useMemo(
    () => monedasNegocio.filter((m) => m.activo),
    [monedasNegocio],
  );
  const hasExtraCurrencies = useMemo(
    () => monedasActivas.some((m) => m.monedaCode !== monedaBase),
    [monedasActivas, monedaBase],
  );

  const fmtBase = (amount: number) => `${amount.toFixed(2)} ${monedaBase}`;

  // ─── Discounts ────────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [applied, setApplied] = useState<DiscountApplicationResultItem[]>([]);
  const [showDiscount, setShowDiscount] = useState(false);
  const discountExpanded = showDiscount || applied.length > 0;

  const finalTotal = useMemo(
    () => Math.max(0, total - discountTotal),
    [total, discountTotal],
  );

  // ─── Payments ─────────────────────────────────────────────────────────────
  const [pagosMap, setPagosMap] = useState<Record<string, PagoMoneda>>({});
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownResetKey, setBreakdownResetKey] = useState(0);
  const [showPayBreakdown, setShowPayBreakdown] = useState<
    Record<string, boolean>
  >({});
  const [payBreakdownKeys, setPayBreakdownKeys] = useState<
    Record<string, number>
  >({});
  const [showTransfer, setShowTransfer] = useState<Record<string, boolean>>({});
  const [addPayAnchor, setAddPayAnchor] = useState<null | HTMLElement>(null);

  const monedas = Object.keys(pagosMap);

  const todasMonedas = useMemo(() => {
    const codes = new Set<string>([monedaBase]);
    for (const m of monedasActivas) codes.add(m.monedaCode);
    return Array.from(codes);
  }, [monedaBase, monedasActivas]);

  const monedasDisponibles = useMemo(
    () => todasMonedas.filter((code) => !pagosMap[code]),
    [todasMonedas, pagosMap],
  );

  const denominaciones = useMemo<Record<string, number[]>>(() => {
    // CUP gets static fallback so breakdown always works for base
    const map: Record<string, number[]> = {
      CUP: [...DENOMINACIONES.CUP].sort((a, b) => b - a),
    };
    for (const nm of monedasActivas) {
      if (nm.moneda?.denominaciones) {
        const vals = nm.moneda.denominaciones
          .filter((d) => d.activo)
          .map((d) => d.valor)
          .sort((a, b) => b - a);
        if (vals.length > 0) map[nm.monedaCode] = vals;
      }
    }
    return map;
  }, [monedasActivas]);

  const totalPagado = useMemo(
    () =>
      Object.entries(pagosMap).reduce(
        (sum, [moneda, { cash, transfer }]) =>
          sum +
          convertToBase(cash + transfer, moneda, tasasVigentes, monedaBase),
        0,
      ),
    [pagosMap, tasasVigentes, monedaBase],
  );

  const pagosLinea = useMemo<IPagoLinea[]>(
    () =>
      Object.entries(pagosMap).flatMap(
        ([moneda, { cash, transfer, transferDestId }]) => {
          const arr: IPagoLinea[] = [];
          if (cash > 0)
            arr.push({
              tipo: "cash",
              moneda,
              monto: cash,
              equivalenteBase: convertToBase(
                cash,
                moneda,
                tasasVigentes,
                monedaBase,
              ),
            });
          if (transfer > 0)
            arr.push({
              tipo: "transfer",
              moneda,
              monto: transfer,
              equivalenteBase: convertToBase(
                transfer,
                moneda,
                tasasVigentes,
                monedaBase,
              ),
              transferDestinationId: transferDestId,
            });
          return arr;
        },
      ),
    [pagosMap, tasasVigentes, monedaBase],
  );

  const falta = Math.round(totalPagado * 100) < Math.round(finalTotal * 100);
  const vueltoTotalBase = Math.max(0, totalPagado - finalTotal);

  // ─── Change distribution ───────────────────────────────────────────────────
  const [vueltoMap, setVueltoMap] = useState<Record<string, number>>({});
  const [vueltoLocked, setVueltoLocked] = useState(false);
  const [addVueltoAnchor, setAddVueltoAnchor] = useState<null | HTMLElement>(
    null,
  );

  // Net cash in drawer per currency (from previous sales in current period)
  const [drawerBalance, setDrawerBalance] = useState<Record<string, number>>(
    {},
  );

  const vueltoDistBase = useMemo(
    () =>
      Object.entries(vueltoMap).reduce(
        (s, [m, amt]) => s + convertToBase(amt, m, tasasVigentes, monedaBase),
        0,
      ),
    [vueltoMap, tasasVigentes, monedaBase],
  );

  // Currencies eligible for change: any supported currency with denominations not yet in vueltoMap
  const monedasEligiblesVuelto = useMemo(
    () =>
      todasMonedas.filter(
        (m) => !(m in vueltoMap) && (denominaciones[m]?.length ?? 0) > 0,
      ),
    [todasMonedas, vueltoMap, denominaciones],
  );

  // Auto-compute default change distribution
  useEffect(() => {
    if (falta) {
      setVueltoMap({});
      setVueltoLocked(false);
      return;
    }
    if (vueltoLocked) return;

    const mainCurrency = pagosLinea
      .filter((p) => p.tipo === "cash")
      .map((p) => ({ moneda: p.moneda, base: p.equivalenteBase }))
      .sort((a, b) => b.base - a.base)[0]?.moneda;

    if (!mainCurrency) {
      setVueltoMap({});
      return;
    }

    const dv = calcularVuelto(
      finalTotal,
      pagosLinea,
      mainCurrency,
      monedaBase,
      tasasVigentes,
      denominaciones,
    );
    const newMap: Record<string, number> = {};
    for (const v of dv) if (v.monto > 0) newMap[v.moneda] = v.monto;
    setVueltoMap(newMap);
  }, [
    falta,
    vueltoLocked,
    totalPagado,
    finalTotal,
    monedaBase,
    pagosLinea,
    tasasVigentes,
    denominaciones,
  ]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPagosMap({
      [monedaBase]: {
        cash: 0,
        transfer: 0,
        transferDestId: defaultDestId(transferDestinations),
      },
    });
    setShowBreakdown(false);
    setBreakdownResetKey((k) => k + 1);
    setVueltoMap({});
    setVueltoLocked(false);
    setShowPayBreakdown({});
    setPayBreakdownKeys({});
    if (cierreId) {
      fetch(`/api/cierre/${tiendaId}/${cierreId}/cash-balance`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((bal: Record<string, number>) => setDrawerBalance(bal))
        .catch(() => setDrawerBalance({}));
    }
  }, [open, monedaBase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync base cash when finalTotal resolves (discount) — only while single-currency
  useEffect(() => {
    if (!open || finalTotal <= 0) return;
    setPagosMap((prev) => {
      const keys = Object.keys(prev);
      if (keys.length !== 1 || keys[0] !== monedaBase) return prev;
      const base = prev[monedaBase];
      return {
        [monedaBase]: { ...base, cash: parseFloat(finalTotal.toFixed(2)) },
      };
    });
  }, [finalTotal, monedaBase, open]);

  // ─── Payment helpers ───────────────────────────────────────────────────────
  const suggestCash = (moneda: string, excludeMoneda?: string): number => {
    const otherPaid = Object.entries(pagosMap)
      .filter(([m]) => m !== excludeMoneda)
      .reduce(
        (s, [m, { cash, transfer }]) =>
          s + convertToBase(cash + transfer, m, tasasVigentes, monedaBase),
        0,
      );
    const rem = Math.max(0, finalTotal - otherPaid);
    if (rem <= 0) return 0;
    return parseFloat(
      convertFromBase(rem, moneda, tasasVigentes, monedaBase).toFixed(2),
    );
  };

  const updatePago = (moneda: string, partial: Partial<PagoMoneda>) =>
    setPagosMap((prev) => ({
      ...prev,
      [moneda]: { ...prev[moneda], ...partial },
    }));

  const addCurrency = (moneda: string) => {
    const cash = suggestCash(moneda);
    setPagosMap((prev) => ({
      ...prev,
      [moneda]: {
        cash,
        transfer: 0,
        transferDestId: defaultDestId(transferDestinations),
      },
    }));
    setAddPayAnchor(null);
  };

  const removeCurrency = (moneda: string) => {
    setPagosMap((prev) => {
      const n = { ...prev };
      delete n[moneda];
      return n;
    });
    if (moneda === monedaBase) setShowBreakdown(false);
    setShowPayBreakdown((prev) => {
      const n = { ...prev };
      delete n[moneda];
      return n;
    });
    setPayBreakdownKeys((prev) => {
      const n = { ...prev };
      delete n[moneda];
      return n;
    });
  };

  const togglePayBreakdown = (moneda: string) => {
    setShowPayBreakdown((prev) => {
      const next = !prev[moneda];
      if (next)
        setPayBreakdownKeys((k) => ({ ...k, [moneda]: (k[moneda] ?? 0) + 1 }));
      else updatePago(moneda, { cash: pagosMap[moneda]?.cash ?? 0 });
      return { ...prev, [moneda]: next };
    });
  };

  const toggleTransfer = (moneda: string) => {
    setShowTransfer((prev) => ({ ...prev, [moneda]: !prev[moneda] }));
  };

  const handleToggleBreakdown = () => {
    if (!showBreakdown) {
      setBreakdownResetKey((k) => k + 1);
    } else {
      const transfer = pagosMap[monedaBase]?.transfer ?? 0;
      updatePago(monedaBase, {
        cash: parseFloat(Math.max(0, finalTotal - transfer).toFixed(2)),
      });
    }
    setShowBreakdown((prev) => !prev);
  };

  // ─── Change helpers ────────────────────────────────────────────────────────
  const updateVuelto = (moneda: string, monto: number) => {
    setVueltoLocked(true);
    setVueltoMap((prev) => ({ ...prev, [moneda]: monto }));
  };

  const removeVueltoMoneda = (moneda: string) => {
    setVueltoLocked(true);
    setVueltoMap((prev) => {
      const n = { ...prev };
      delete n[moneda];
      return n;
    });
  };

  const addVueltoMoneda = (moneda: string) => {
    setVueltoLocked(true);
    const rem = Math.max(0, vueltoTotalBase - vueltoDistBase);
    const suggested =
      rem > 0
        ? parseFloat(
            convertFromBase(rem, moneda, tasasVigentes, monedaBase).toFixed(2),
          )
        : 0;
    setVueltoMap((prev) => ({ ...prev, [moneda]: suggested }));
    setAddVueltoAnchor(null);
  };

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleClose = () => {
    setPagosMap({});
    setVueltoMap({});
    setVueltoLocked(false);
    setShowBreakdown(false);
    setBreakdownResetKey((k) => k + 1);
    setShowPayBreakdown({});
    setPayBreakdownKeys({});
    setShowTransfer({});
    onClose();
  };

  const handlePayment = async () => {
    try {
      const pagosArr = pagosLinea;
      const vueltoArr: IVueltoLinea[] = Object.entries(vueltoMap).map(
        ([moneda, monto]) => ({ moneda, monto }),
      );
      handleClose();
      const totalcashBase = pagosArr
        .filter((p) => p.tipo === "cash")
        .reduce(
          (s, p) =>
            s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase),
          0,
        );
      const totalTransferBase = pagosArr
        .filter((p) => p.tipo === "transfer")
        .reduce(
          (s, p) =>
            s + convertToBase(p.monto, p.moneda, tasasVigentes, monedaBase),
          0,
        );
      const firstTransferDestId = pagosArr.find(
        (p) => p.tipo === "transfer",
      )?.transferDestinationId;
      const multimoneda: IMultimonedaExtras = {
        monedaCobro: monedaBase,
        pagosDetalle: pagosArr,
        vueltoDetalle: vueltoArr,
        tasaSnapshot: tasasVigentes,
        ...(discountTotal > 0 ? { discountTotal } : {}),
      };
      makePay(
        finalTotal,
        totalcashBase,
        totalTransferBase,
        firstTransferDestId,
        promoCode ? [promoCode] : [],
        multimoneda,
      ).catch((e) => console.error("Error pago:", e));
    } catch (error) {
      console.error("Error en handlePayment:", error);
      showMessage("Error inesperado al iniciar el pago", "error");
    }
  };

  // ─── Discounts ────────────────────────────────────────────────────────────
  const previewDiscount = async (codes?: string[]): Promise<void> => {
    try {
      const res = await fetch("/api/discounts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiendaId,
          products,
          ...(codes?.length ? { discountCodes: codes } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      const data = (await res.json()) as DiscountApplicationResult;
      setDiscountTotal(Number(data.discountTotal) || 0);
      setApplied(Array.isArray(data.applied) ? data.applied : []);
    } catch (e: unknown) {
      console.error("Error preview descuento", e);
      setDiscountTotal(0);
      setApplied([]);
      showMessage("No se pudo aplicar el código de descuento", "warning");
    }
  };

  useEffect(() => {
    if (open) previewDiscount(promoCode ? [promoCode] : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(products)]);

  // Drawer balance validation: available = accumulated from period + cash paid in this transaction
  const vueltoErrors = useMemo<Record<string, string | null>>(
    () =>
      Object.fromEntries(
        Object.entries(vueltoMap).map(([m, amt]) => {
          const available = (drawerBalance[m] ?? 0) + (pagosMap[m]?.cash ?? 0);
          if (amt > available + 0.001) {
            return [m, `Disponible en caja: ${available.toFixed(2)} ${m}`];
          }
          return [m, null];
        }),
      ),
    [vueltoMap, drawerBalance, pagosMap],
  );

  const hasVueltoErrors = useMemo(
    () => Object.values(vueltoErrors).some((e) => e !== null),
    [vueltoErrors],
  );

  const canConfirm =
    (finalTotal === 0 ? monedas.length > 0 : !falta && totalPagado > 0) &&
    !hasVueltoErrors;

  // ─── Render ───────────────────────────────────────────────────────────────
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
          width: { xs: "95vw", sm: 420 },
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* ── Header ── */}
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Cobrar:&nbsp;
          {discountTotal > 0 && (
            <span
              style={{
                textDecoration: "line-through",
                color: "#999",
                marginRight: 6,
              }}
            >
              {fmtBase(total)}
            </span>
          )}
          <span style={{ color: discountTotal > 0 ? "#2e7d32" : "inherit" }}>
            {fmtBase(finalTotal)}
          </span>
        </Typography>

        {/* ── Payment sections ── */}
        {monedas.map((moneda, idx) => {
          const isBase = moneda === monedaBase;
          const pago = pagosMap[moneda];
          const info = monedasActivas.find((m) => m.monedaCode === moneda);
          const admiteEfectivo = isBase || (info?.admiteEfectivo ?? true);
          const admiteTransfer = isBase || (info?.admiteTransferencia ?? false);
          const totalMoneda = pago.cash + pago.transfer;
          const eqBase =
            !isBase && totalMoneda > 0
              ? convertToBase(totalMoneda, moneda, tasasVigentes, monedaBase)
              : null;

          return (
            <Box key={moneda}>
              {idx > 0 && <Divider sx={{ my: 2 }} />}

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                mb={1.5}
              >
                <Chip
                  label={moneda}
                  size="small"
                  color={isBase ? "primary" : "default"}
                  variant={isBase ? "filled" : "outlined"}
                />
                {!isBase && (
                  <IconButton
                    size="small"
                    onClick={() => removeCurrency(moneda)}
                  >
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
                      startAdornment={
                        <InputAdornment position="start">
                          <AttachMoneyIcon />
                        </InputAdornment>
                      }
                      endAdornment={
                        admiteTransfer ? (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => toggleTransfer(moneda)}
                              title={
                                (showTransfer[moneda] ?? false)
                                  ? "Ocultar transferencia"
                                  : "Mostrar transferencia"
                              }
                            >
                              <CreditCardIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : undefined
                      }
                      label="Efectivo"
                      value={pago.cash || ""}
                      type="number"
                      onChange={(e) => {
                        const bdActive = isBase
                          ? showBreakdown
                          : (showPayBreakdown[moneda] ?? false);
                        if (bdActive) return;

                        const v = e.target.value;
                        if (moneyRegex.test(v))
                          updatePago(moneda, { cash: Number(v) });
                        else if (v === "") updatePago(moneda, { cash: 0 });
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        const inp = (
                          e.currentTarget as HTMLElement
                        ).querySelector("input");
                        if (inp) setTimeout(() => inp.select(), 0);
                      }}
                      inputProps={{
                        inputMode: "decimal",
                        readOnly: isBase
                          ? showBreakdown
                          : (showPayBreakdown[moneda] ?? false),
                      }}
                      sx={
                        (
                          isBase
                            ? showBreakdown
                            : (showPayBreakdown[moneda] ?? false)
                        )
                          ? { bgcolor: "action.hover" }
                          : {}
                      }
                    />
                  </FormControl>

                  {isBase ? (
                    <>
                      <Button
                        variant="text"
                        size="small"
                        onClick={handleToggleBreakdown}
                        startIcon={
                          showBreakdown ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )
                        }
                        sx={{
                          mt: 0.5,
                          mb: 0.5,
                          textTransform: "none",
                          color: "text.secondary",
                        }}
                      >
                        {showBreakdown
                          ? "Ocultar desglose"
                          : "Desglosar billetes"}
                      </Button>
                      <Collapse in={showBreakdown}>
                        {showBreakdown && (
                          <Box
                            sx={{
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                              px: { xs: 0.5, sm: 1.5 },
                              pb: 1,
                            }}
                          >
                            <BillBreakdownInput
                              currency={DEFAULT_CURRENCY}
                              targetAmount={finalTotal}
                              onChange={(t) =>
                                updatePago(monedaBase, { cash: t })
                              }
                              resetKey={breakdownResetKey}
                            />
                          </Box>
                        )}
                      </Collapse>
                    </>
                  ) : (
                    (denominaciones[moneda]?.length ?? 0) > 0 && (
                      <>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => togglePayBreakdown(moneda)}
                          startIcon={
                            (showPayBreakdown[moneda] ?? false) ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )
                          }
                          sx={{
                            mt: 0.5,
                            mb: 0.5,
                            textTransform: "none",
                            color: "text.secondary",
                          }}
                        >
                          {(showPayBreakdown[moneda] ?? false)
                            ? "Ocultar desglose"
                            : "Desglosar billetes"}
                        </Button>
                        <Collapse in={showPayBreakdown[moneda] ?? false}>
                          {(showPayBreakdown[moneda] ?? false) && (
                            <Box
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                px: { xs: 0.5, sm: 1.5 },
                                pb: 1,
                              }}
                            >
                              <BillBreakdownDynamic
                                denominations={denominaciones[moneda]}
                                targetAmount={pago.cash}
                                onChange={(t) =>
                                  updatePago(moneda, { cash: t })
                                }
                                resetKey={payBreakdownKeys[moneda] ?? 0}
                              />
                            </Box>
                          )}
                        </Collapse>
                      </>
                    )
                  )}
                </>
              )}

              {/* Transferencia (Collapse bajo Efectivo) */}
              {admiteTransfer && (
                <Collapse in={showTransfer[moneda] ?? false}>
                  <Box sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Transferencia</InputLabel>
                      <OutlinedInput
                        startAdornment={
                          <InputAdornment position="start">
                            <CreditCardIcon />
                          </InputAdornment>
                        }
                        label="Transferencia"
                        value={pago.transfer || ""}
                        type={"number"}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          const inp = (
                            e.currentTarget as HTMLElement
                          ).querySelector("input");
                          if (inp) setTimeout(() => inp.select(), 0);
                        }}
                        onChange={(e) => {
                          if (isBase) {
                            const v = e.target.value;
                            if (moneyRegex.test(v)) {
                              const newTransfer = Number(v);
                              const newCash = parseFloat(
                                Math.max(
                                  0,
                                  pago.cash + pago.transfer - newTransfer,
                                ).toFixed(2),
                              );
                              updatePago(moneda, {
                                transfer: newTransfer,
                                cash: newCash,
                              });
                            } else if (v === "") {
                              const total = parseFloat(
                                (pago.cash + pago.transfer).toFixed(2),
                              );
                              updatePago(moneda, {
                                transfer: 0,
                                cash: total,
                              });
                            }
                          } else {
                            const newTransfer = parseFloat(e.target.value) || 0;
                            const newCash = Math.max(
                              0,
                              pago.cash + pago.transfer - newTransfer,
                            );
                            updatePago(moneda, {
                              transfer: newTransfer,
                              cash: newCash,
                            });
                          }
                        }}
                        inputProps={{ inputMode: "decimal" }}
                      />
                    </FormControl>

                    {/* Transfer destination */}
                    {pago.transfer > 0 && transferDestinations.length > 0 && (
                      <FormControl fullWidth margin="normal">
                        <InputLabel>Destino</InputLabel>
                        <Select
                          value={pago.transferDestId}
                          onChange={(e) =>
                            updatePago(moneda, {
                              transferDestId: e.target.value,
                            })
                          }
                        >
                          {transferDestinations.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.nombre}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>
                </Collapse>
              )}

              {/* Equivalente en base */}
              {eqBase !== null && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mt={0.5}
                >
                  ≈ {eqBase.toFixed(2)} {monedaBase}
                </Typography>
              )}
            </Box>
          );
        })}

        {/* Add payment currency */}
        {hasExtraCurrencies && monedasDisponibles.length > 0 && (
          <Box mt={2}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) =>
                monedasDisponibles.length === 1
                  ? addCurrency(monedasDisponibles[0])
                  : setAddPayAnchor(e.currentTarget)
              }
              sx={{ textTransform: "none" }}
            >
              Agregar moneda
            </Button>
            <Menu
              anchorEl={addPayAnchor}
              open={Boolean(addPayAnchor)}
              onClose={() => setAddPayAnchor(null)}
            >
              {monedasDisponibles.map((code) => (
                <MenuItem key={code} onClick={() => addCurrency(code)}>
                  {code}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        )}

        {/* ── Change section ── */}
        {!falta && vueltoTotalBase >= 0.0001 && (
          <>
            <Divider sx={{ my: 2 }} />

            <Stack
              direction="row"
              alignItems="baseline"
              justifyContent="space-between"
              mb={1.5}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Cambio a dar
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {vueltoTotalBase.toFixed(4)} {monedaBase} equiv
              </Typography>
            </Stack>

            {Object.entries(vueltoMap).map(([moneda, monto], idx) => {
              const err = vueltoErrors[moneda];
              return (
                <Box key={moneda} sx={{ mt: idx > 0 ? 1.5 : 0 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Chip label={moneda} size="small" variant="outlined" />
                    <OutlinedInput
                      size="small"
                      type="number"
                      value={monto || ""}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        const inp = (
                          e.currentTarget as HTMLElement
                        ).querySelector("input");
                        if (inp) setTimeout(() => inp.select(), 0);
                      }}
                      onChange={(e) =>
                        updateVuelto(moneda, parseFloat(e.target.value) || 0)
                      }
                      inputProps={{ min: 0, step: 0.01, inputMode: "decimal" }}
                      sx={{ flex: 1 }}
                      error={!!err}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeVueltoMoneda(moneda)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  {err && (
                    <Typography
                      variant="caption"
                      color="error"
                      display="block"
                      mt={0.25}
                      ml={1}
                    >
                      {err}
                    </Typography>
                  )}
                </Box>
              );
            })}

            {/* Add change currency */}
            {monedasEligiblesVuelto.length > 0 && (
              <Box mt={1.5}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) =>
                    monedasEligiblesVuelto.length === 1
                      ? addVueltoMoneda(monedasEligiblesVuelto[0])
                      : setAddVueltoAnchor(e.currentTarget)
                  }
                  sx={{ textTransform: "none" }}
                >
                  Dar cambio en otra moneda
                </Button>
                <Menu
                  anchorEl={addVueltoAnchor}
                  open={Boolean(addVueltoAnchor)}
                  onClose={() => setAddVueltoAnchor(null)}
                >
                  {monedasEligiblesVuelto.map((code) => (
                    <MenuItem key={code} onClick={() => addVueltoMoneda(code)}>
                      {code}
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* ── Discounts ── */}
        <Button
          variant="text"
          size="small"
          onClick={() => setShowDiscount((v) => !v)}
          startIcon={discountExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            textTransform: "none",
            color: applied.length > 0 ? "success.main" : "text.secondary",
            mb: discountExpanded ? 1 : 2,
          }}
        >
          {applied.length > 0
            ? `Descuento aplicado: -${fmtBase(discountTotal)}`
            : "¿Tienes un código de descuento?"}
        </Button>
        <Collapse in={discountExpanded}>
          <Stack spacing={1} mb={2}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Código de descuento"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    previewDiscount(promoCode ? [promoCode] : undefined);
                }}
                size="small"
                fullWidth
              />
              <Button
                variant="contained"
                onClick={() =>
                  previewDiscount(promoCode ? [promoCode] : undefined)
                }
                sx={{ minWidth: 90 }}
                size="small"
              >
                Aplicar
              </Button>
            </Box>
            {applied.length > 0 && (
              <Box>
                {applied.map((d) => (
                  <Typography
                    key={d.discountRuleId}
                    variant="body2"
                    color="success.main"
                  >
                    {d.ruleName || "Descuento"}: -{fmtBase(d.amount)}
                  </Typography>
                ))}
                <Typography variant="body2" fontWeight={600} mt={0.5}>
                  Total descuentos: -({fmtBase(discountTotal)})
                </Typography>
              </Box>
            )}
          </Stack>
        </Collapse>

        {/* ── Summary ── */}
        <Stack spacing={0.5} mt={2} mb={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Total:</Typography>
            <Typography
              variant="h6"
              color={discountTotal > 0 ? "success.main" : "inherit"}
              fontWeight={600}
            >
              {fmtBase(finalTotal)}
            </Typography>
          </Stack>
          {falta ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6" color="error">
                Falta:
              </Typography>
              <Typography variant="h6" color="error">
                {(finalTotal - totalPagado).toFixed(2)} {monedaBase}
              </Typography>
            </Stack>
          ) : (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6" color="success.main">
                Cambio:
              </Typography>
              <Typography variant="h6" color="success.main">
                {vueltoTotalBase.toFixed(2)} {monedaBase}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* ── Actions ── */}
        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handlePayment}
          disabled={!canConfirm}
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
