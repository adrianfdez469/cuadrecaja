"use client";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState, useEffect, useMemo } from "react";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { IProveedor } from "@/schemas/proveedor";
import { ILocal } from "@/schemas/tienda";
import {
  cretateBatchMovimientos,
  getEfectivoDisponibleCaja,
} from "@/services/movimientoService";
import { getProveedores } from "@/services/proveedorService";
import { getLocales } from "@/services/localesService";
import { convertToBase, convertFromBase } from "@/lib/currency";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { FormaPagoCompraEnum } from "@/schemas/movimiento";
import { FORMA_PAGO_COMPRA_LABELS } from "@/constants/formaPagoCompra";
import { formatAdvertenciasCaja, formatCurrency } from "@/utils/formatters";
import useConfirmDialog from "@/components/confirmDialog";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  onClose: () => void;
  onCreated: () => void;
}

type TipoMovimiento =
  | "COMPRA"
  | "AJUSTE_ENTRADA"
  | "AJUSTE_SALIDA"
  | "MERMA"
  | "CONSIGNACION_ENTRADA"
  | "CONSIGNACION_DEVOLUCION"
  | "TRASPASO_SALIDA";

const TIPOS_BASE: {
  value: TipoMovimiento;
  label: string;
  esEntrada: boolean;
}[] = [
  { value: "COMPRA", label: "Compra (entrada con costo)", esEntrada: true },
  { value: "AJUSTE_ENTRADA", label: "Ajuste entrada", esEntrada: true },
  { value: "AJUSTE_SALIDA", label: "Ajuste salida", esEntrada: false },
  {
    value: "MERMA",
    label: "Merma (pérdida real: rotura, vencimiento, robo)",
    esEntrada: false,
  },
  {
    value: "CONSIGNACION_ENTRADA",
    label: "Consignación entrada",
    esEntrada: true,
  },
  {
    value: "CONSIGNACION_DEVOLUCION",
    label: "Consignación devolución",
    esEntrada: false,
  },
  {
    value: "TRASPASO_SALIDA",
    label: "Envío de mercancía (traspaso)",
    esEntrada: false,
  },
];

export function CreateMovimientoDialog({
  open,
  producto,
  onClose,
  onCreated,
}: Props) {
  const { user, monedasNegocio, tasasVigentes, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const [tipo, setTipo] = useState<TipoMovimiento>("COMPRA");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [selectedProveedor, setSelectedProveedor] = useState<IProveedor | null>(
    null,
  );
  const [destinos, setDestinos] = useState<ILocal[]>([]);
  const [destinationId, setDestinationId] = useState<string>("");
  const [monedaCompra, setMonedaCompra] = useState<string>(monedaBase);
  const [formaPago, setFormaPago] =
    useState<(typeof FormaPagoCompraEnum.options)[number]>("EFECTIVO_CAJA");
  const [saving, setSaving] = useState(false);

  const monedasParaCompra = useMemo(() => {
    const lista = [monedaBase];
    for (const nm of monedasNegocio) {
      if (nm.activo && nm.monedaCode !== monedaBase) lista.push(nm.monedaCode);
    }
    return lista;
  }, [monedaBase, monedasNegocio]);

  useEffect(() => {
    if (open && producto) {
      const defaultTipo: TipoMovimiento = producto.proveedorId
        ? "CONSIGNACION_ENTRADA"
        : "COMPRA";
      setTipo(defaultTipo);
      setCantidad("");
      setCostoUnitario(String(producto.costo));
      setMotivo("");
      setSelectedProveedor(producto.proveedor ?? null);
      setDestinationId("");
      // El costo del producto (producto.costo) está guardado en su propia
      // moneda (monedaCostoCode) — la moneda seleccionada debe arrancar ahí,
      // nunca en monedaBase a secas, o el número se reinterpreta mal.
      setMonedaCompra(producto.monedaCostoCode ?? monedaBase);
      setFormaPago("EFECTIVO_CAJA");
    }
  }, [open, producto, monedaBase]);

  useEffect(() => {
    if (
      open &&
      (tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION")
    ) {
      getProveedores()
        .then(setProveedores)
        .catch(() => {});
    }
    if (open && tipo === "TRASPASO_SALIDA") {
      getLocales()
        .then((locales) =>
          setDestinos(locales.filter((l) => l.id !== user.localActual.id)),
        )
        .catch(() => {});
    }
    if (tipo !== "COMPRA" && tipo !== "CONSIGNACION_ENTRADA") {
      setMonedaCompra(monedaBase);
    }
  }, [open, tipo, monedaBase, user?.localActual?.id]);

  const handleMonedaCompraChange = (nuevaMoneda: string) => {
    // Al cambiar la moneda, convertir el número ya ingresado en vez de
    // reinterpretarlo tal cual en la nueva moneda (eso multiplicaba/dividía
    // el costo por la tasa de cambio sin que el usuario lo notara).
    const costoRaw = parseFloat(costoUnitario) || 0;
    if (costoRaw > 0 && nuevaMoneda !== monedaCompra) {
      const enBase = convertToBase(
        costoRaw,
        monedaCompra,
        tasasVigentes,
        monedaBase,
      );
      const enNuevaMoneda = convertFromBase(
        enBase,
        nuevaMoneda,
        tasasVigentes,
        monedaBase,
      );
      setCostoUnitario(String(Number(enNuevaMoneda.toFixed(2))));
    }
    setMonedaCompra(nuevaMoneda);
  };

  if (!producto) return null;

  const esConsignacion =
    tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION";
  const esTraspaso = tipo === "TRASPASO_SALIDA";
  const mostrarCosto = tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA";
  const mostrarMoneda = mostrarCosto && monedasParaCompra.length > 1;
  const isExtraCurrency = mostrarCosto && monedaCompra !== monedaBase;

  const handleSave = async () => {
    const qty = parseFloat(cantidad.replace(",", "."));
    if (!qty || qty <= 0) {
      showMessage("Ingresa una cantidad válida", "warning");
      return;
    }
    if (esConsignacion && !selectedProveedor) {
      showMessage(
        "Selecciona un proveedor para movimientos de consignación",
        "warning",
      );
      return;
    }
    if (esTraspaso && !destinationId) {
      showMessage("Selecciona el local destino", "warning");
      return;
    }
    const costoRaw = parseFloat(costoUnitario) || 0;

    if (tipo === "COMPRA" && formaPago === "EFECTIVO_CAJA" && costoRaw > 0) {
      const montoCompra = costoRaw * qty;
      try {
        const disponible = await getEfectivoDisponibleCaja(user.localActual.id);
        const disponibleMoneda = disponible[monedaCompra] ?? 0;
        if (montoCompra > disponibleMoneda) {
          confirmDialog(
            `La compra (${formatCurrency(montoCompra)} ${monedaCompra}) supera el efectivo disponible en caja (${formatCurrency(disponibleMoneda)} ${monedaCompra}). Se tomarán ${formatCurrency(disponibleMoneda)} ${monedaCompra} de caja y el resto se registrará como fondeo externo. ¿Continuar?`,
            () => ejecutarGuardado(qty, costoRaw),
            undefined,
            { severity: "warning" },
          );
          return;
        }
      } catch (e) {
        console.error("Error al verificar efectivo disponible:", e);
        // Si falla la verificación, no bloqueamos la compra — el backend
        // igual aplica el tope de forma segura al crear el movimiento.
      }
    }

    await ejecutarGuardado(qty, costoRaw);
  };

  const ejecutarGuardado = async (qty: number, costoRaw: number) => {
    setSaving(true);
    try {
      const { advertenciasCaja } = await cretateBatchMovimientos(
        {
          tipo,
          tiendaId: user.localActual.id,
          usuarioId: user.id,
          motivo: motivo || undefined,
          ...(esConsignacion &&
            selectedProveedor && { proveedorId: selectedProveedor.id }),
          ...(esTraspaso && { destinationId }),
          ...(tipo === "COMPRA" && { formaPago }),
        },
        [
          {
            productoId: producto.productoId,
            cantidad: qty,
            // Costo en la moneda seleccionada — sin conversión a monedaBase
            ...(mostrarCosto &&
              costoRaw && {
                costoUnitario: costoRaw,
                costoTotal: costoRaw * qty,
                monedaCompra,
              }),
            // Auditoría
            ...(mostrarCosto &&
              costoRaw && {
                monedaOriginal: monedaCompra,
                montoOriginal: costoRaw * qty,
                tasaUsada: tasasVigentes[monedaCompra] ?? 1,
              }),
          },
        ],
      );
      if (advertenciasCaja?.length) {
        showMessage(formatAdvertenciasCaja(advertenciasCaja), "warning");
      } else {
        showMessage("Movimiento registrado", "success");
      }
      onCreated();
    } catch (e) {
      console.error(e);
      showMessage("Error al registrar el movimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          Registrar movimiento — {producto.producto.nombre}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <Alert severity="info">
              Stock actual: <strong>{producto.existencia}</strong>
              {producto.proveedor && (
                <>
                  {" "}
                  · Proveedor: <strong>{producto.proveedor.nombre}</strong>
                </>
              )}
            </Alert>

            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de movimiento</InputLabel>
              <Select
                label="Tipo de movimiento"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoMovimiento);
                  if (!selectedProveedor && producto.proveedor) {
                    setSelectedProveedor(producto.proveedor);
                  }
                }}
              >
                {TIPOS_BASE.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {esConsignacion && (
              <Autocomplete
                size="small"
                options={proveedores}
                getOptionLabel={(p) => p.nombre}
                value={selectedProveedor}
                onChange={(_, val) => setSelectedProveedor(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor *"
                    placeholder="Seleccionar proveedor..."
                  />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            )}

            {esTraspaso && (
              <FormControl size="small" fullWidth>
                <InputLabel>Local destino *</InputLabel>
                <Select
                  label="Local destino *"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                >
                  {destinos.length === 0 && (
                    <MenuItem disabled value="">
                      <Typography variant="body2" color="text.secondary">
                        Sin locales disponibles
                      </Typography>
                    </MenuItem>
                  )}
                  {destinos.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              autoFocus
            />

            {mostrarCosto && (
              <TextField
                label={`Costo unitario${isExtraCurrency ? ` (${monedaCompra})` : ""}`}
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
                size="small"
                inputProps={{ inputMode: "decimal" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                helperText={
                  isExtraCurrency && costoUnitario
                    ? `≈ ${convertToBase(parseFloat(costoUnitario) || 0, monedaCompra, tasasVigentes, monedaBase).toFixed(2)} ${monedaBase}`
                    : undefined
                }
              />
            )}

            {mostrarMoneda && (
              <FormControl size="small" fullWidth>
                <InputLabel>Moneda de compra</InputLabel>
                <Select
                  label="Moneda de compra"
                  value={monedaCompra}
                  onChange={(e) => handleMonedaCompraChange(e.target.value)}
                >
                  {monedasParaCompra.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {tipo === "COMPRA" && (
              <FormControl size="small" fullWidth>
                <InputLabel>Forma de pago</InputLabel>
                <Select
                  label="Forma de pago"
                  value={formaPago}
                  onChange={(e) =>
                    setFormaPago(
                      e.target
                        .value as (typeof FormaPagoCompraEnum.options)[number],
                    )
                  }
                >
                  {/* MIXTO no es seleccionable — el backend lo asigna solo
                    cuando la compra en EFECTIVO_CAJA supera el disponible */}
                  {FormaPagoCompraEnum.options
                    .filter((opt) => opt !== "MIXTO")
                    .map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {FORMA_PAGO_COMPRA_LABELS[opt]}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Motivo (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              size="small"
              placeholder={
                tipo === "MERMA"
                  ? "Ej: se venció, se rompió, robo..."
                  : "Descripción del movimiento..."
              }
              helperText={
                tipo === "MERMA"
                  ? "Se valoriza sola al costo vigente del producto — resta de la ganancia, no afecta la caja"
                  : undefined
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </DialogActions>
      </Dialog>
      {ConfirmDialogComponent}
    </>
  );
}
