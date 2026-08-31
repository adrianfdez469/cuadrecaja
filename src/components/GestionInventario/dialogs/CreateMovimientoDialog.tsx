"use client";

import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useState, useEffect, useMemo, useRef } from "react";
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
import { IFormaPagoCompra } from "@/schemas/movimiento";
import {
  formatAdvertenciasCaja,
  formatCurrency,
  formatQuantity,
} from "@/utils/formatters";
import {
  parseQuantityText,
  sanitizeQuantityDraft,
} from "@/utils/quantityInput";
import { generateUUID } from "@/utils/uuid";
import { shape } from "@/theme";
import useConfirmDialog from "@/components/confirmDialog";
import { FormaPagoCompraSelect } from "@/components/GestionInventario/FormaPagoCompraSelect";
import MoneyField from "@/components/MoneyField";
import SelectableTextField from "@/components/SelectableTextField";
import { StockActualAlert } from "./StockActualAlert";
import { isMovementAllowedOnConsignment } from "@/utils/tipoMovimiento";

interface Props {
  open: boolean;
  producto: IProductoTiendaV2 | null;
  /**
   * Every ProductoTienda row of the store. Consigned goods have one row per
   * supplier, so picking another supplier means acting on another row — this
   * list is what lets the dialog show and validate that row's stock.
   */
  productosTienda: IProductoTiendaV2[];
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
  productosTienda,
  onClose,
  onCreated,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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
  const [formaPago, setFormaPago] = useState<IFormaPagoCompra>("EXTERNO");
  const [saving, setSaving] = useState(false);
  // Identifies the batch on the server. Preserved across retries of the same
  // save — including the one the user triggers after a network error — and
  // renewed only once the movement is recorded.
  const idempotencyKeyRef = useRef<string | null>(null);
  // Whether the user typed a cost. While untouched, switching supplier also
  // brings that supplier's cost in; once edited, their number is never
  // overwritten.
  const costoTouchedRef = useRef(false);

  const monedasParaCompra = useMemo(() => {
    const lista = [monedaBase];
    for (const nm of monedasNegocio) {
      if (nm.activo && nm.monedaCode !== monedaBase) lista.push(nm.monedaCode);
    }
    return lista;
  }, [monedaBase, monedasNegocio]);

  /**
   * The store row the movement will actually hit once a supplier is selected:
   * same product, that supplier. Missing means the supplier holds none of this
   * product here, which reads as stock 0.
   */
  const filaProveedorSeleccionado = useMemo(() => {
    if (!producto || !selectedProveedor) return null;
    return (
      productosTienda.find(
        (pt) =>
          pt.productoId === producto.productoId &&
          pt.proveedorId === selectedProveedor.id,
      ) ?? null
    );
  }, [producto, productosTienda, selectedProveedor]);

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
      setFormaPago("EXTERNO");
      costoTouchedRef.current = false;
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
  const esSalida =
    TIPOS_BASE.find((t) => t.value === tipo)?.esEntrada === false;
  const mostrarCosto = tipo === "COMPRA" || tipo === "CONSIGNACION_ENTRADA";
  const mostrarMoneda = mostrarCosto && monedasParaCompra.length > 1;
  const isExtraCurrency = mostrarCosto && monedaCompra !== monedaBase;

  // A consigned row holds the supplier's goods: purchases and adjustments are
  // not offered on it at all.
  const esFilaConsignada = !!producto.proveedorId;
  const tiposDisponibles = esFilaConsignada
    ? TIPOS_BASE.filter((t) => isMovementAllowedOnConsignment(t.value))
    : TIPOS_BASE;

  // With a supplier selected, the figures on screen belong to that supplier's
  // row — not to the row the dialog was opened from.
  const usaFilaProveedor = esConsignacion && !!selectedProveedor;
  const proveedorSinFila = usaFilaProveedor && !filaProveedorSeleccionado;
  const existenciaActual = usaFilaProveedor
    ? (filaProveedorSeleccionado?.existencia ?? 0)
    : producto.existencia;

  const permiteDecimal = !!producto.producto.permiteDecimal;
  const cantidadNum = parseQuantityText(cantidad, permiteDecimal) ?? 0;
  const cantidadExcedeStock = esSalida && cantidadNum > existenciaActual;

  /**
   * Switching supplier switches the store row the movement acts on, so the
   * cost travels with it — unless the user already typed one, which always
   * wins.
   */
  const handleProveedorChange = (nuevoProveedor: IProveedor | null) => {
    setSelectedProveedor(nuevoProveedor);
    if (!nuevoProveedor || costoTouchedRef.current) return;
    const fila = productosTienda.find(
      (pt) =>
        pt.productoId === producto.productoId &&
        pt.proveedorId === nuevoProveedor.id,
    );
    if (!fila) return;
    setCostoUnitario(String(fila.costo));
    setMonedaCompra(fila.monedaCostoCode ?? monedaBase);
  };

  const handleSave = async () => {
    // Guarda contra doble submit: el botón se deshabilita por `saving`, pero
    // en redes lentas dos clicks pueden entrar antes del re-render.
    if (saving) return;

    const qty = parseQuantityText(cantidad, permiteDecimal);
    if (!qty || qty <= 0) {
      showMessage("Ingresa una cantidad válida", "warning");
      return;
    }
    if (esSalida && qty > existenciaActual) {
      showMessage(
        `No hay suficiente stock: disponible ${formatQuantity(existenciaActual)}`,
        "warning",
      );
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
      // Bloquear el botón ya desde la verificación de caja: es una petición
      // más, y dejarlo habilitado durante ella permitía registrar dos veces.
      setSaving(true);
      try {
        const disponible = await getEfectivoDisponibleCaja(user.localActual.id);
        const disponibleMoneda = disponible[monedaCompra] ?? 0;
        if (montoCompra > disponibleMoneda) {
          confirmDialog(
            `La compra (${formatCurrency(montoCompra)} ${monedaCompra}) supera el efectivo disponible en caja (${formatCurrency(disponibleMoneda)} ${monedaCompra}). Se tomarán ${formatCurrency(disponibleMoneda)} ${monedaCompra} de caja y el resto se registrará como fondeo externo. ¿Continuar?`,
            () => ejecutarGuardado(qty, costoRaw),
            () => setSaving(false),
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
    idempotencyKeyRef.current ??= generateUUID();
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
            // The dialog acts on one inventory row, and a consigned product
            // lives in its own ProductoTienda (one per supplier). Without the
            // supplier the server resolves the store-owned row instead — the
            // transfer/adjustment then reads the wrong stock and is rejected.
            // COMPRA stays out: purchased goods are always own stock, and the
            // consignment types already carry the supplier at batch level.
            ...(!esConsignacion &&
              tipo !== "COMPRA" &&
              producto.proveedorId && { proveedorId: producto.proveedorId }),
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
        idempotencyKeyRef.current,
      );
      if (advertenciasCaja?.length) {
        showMessage(formatAdvertenciasCaja(advertenciasCaja), "warning");
      } else {
        showMessage("Movimiento registrado", "success");
      }
      // Batch recorded: the next save needs a fresh key.
      idempotencyKeyRef.current = null;
      // onCreated cierra el diálogo de inmediato y recarga el inventario en
      // segundo plano — no se espera el listado fresco para cerrar.
      onCreated();
    } catch (e) {
      console.error(e);
      const errorMessage =
        e.response?.data?.error || "Error al registrar el movimiento";
      showMessage(errorMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={saving ? undefined : onClose}
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : 900,
            borderRadius: isMobile ? 0 : `${shape.radius.md}px`,
          },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(19,20,23,.35)",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Registrar movimiento — {producto.producto.nombre}
          {isMobile && (
            <IconButton onClick={onClose} disabled={saving}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <StockActualAlert
              existencia={existenciaActual}
              proveedorNombre={
                usaFilaProveedor
                  ? selectedProveedor.nombre
                  : producto.proveedor?.nombre
              }
              sinFilaProveedor={proveedorSinFila}
              esSalida={esSalida}
            />

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
                {tiposDisponibles.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
              {esFilaConsignada && (
                <FormHelperText>
                  La mercancía es del proveedor: no admite compras ni ajustes.
                </FormHelperText>
              )}
            </FormControl>

            {esConsignacion && (
              <Autocomplete
                size="small"
                options={proveedores}
                getOptionLabel={(p) => p.nombre}
                value={selectedProveedor}
                onChange={(_, val) => handleProveedorChange(val)}
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

            <SelectableTextField
              label="Cantidad"
              value={cantidad}
              onChange={(e) =>
                setCantidad(
                  sanitizeQuantityDraft(e.target.value, permiteDecimal),
                )
              }
              size="small"
              inputProps={{
                inputMode: permiteDecimal ? "decimal" : "numeric",
                min: 0,
                ...(esSalida && { max: existenciaActual }),
              }}
              autoFocus
              error={cantidadExcedeStock}
              helperText={
                cantidadExcedeStock
                  ? `Máx. disponible: ${formatQuantity(existenciaActual)}`
                  : undefined
              }
            />

            {mostrarCosto && (
              <MoneyField
                label={`Costo unitario${isExtraCurrency ? ` (${monedaCompra})` : ""}`}
                value={costoUnitario}
                onChange={(e) => {
                  costoTouchedRef.current = true;
                  setCostoUnitario(e.target.value);
                }}
                size="small"
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
              <FormaPagoCompraSelect
                value={formaPago}
                onChange={setFormaPago}
              />
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
        <DialogActions
          sx={{
            gap: 1,
            py: 1.5,
            px: 2,
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={onClose}
            disabled={saving}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : 56 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || cantidadExcedeStock}
            fullWidth={isMobile}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            sx={{ minHeight: 56 }}
          >
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </DialogActions>
      </Dialog>
      {ConfirmDialogComponent}
    </>
  );
}
