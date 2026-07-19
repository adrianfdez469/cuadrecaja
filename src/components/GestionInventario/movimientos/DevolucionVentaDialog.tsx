"use client";

import { FC, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { useMessageContext } from "@/context/MessageContext";
import {
  buscarVentas,
  registrarDevolucionVenta,
} from "@/services/devolucionVentaService";
import {
  IVentaBuscada,
  IVentaBuscadaProducto,
} from "@/schemas/devolucionVenta";
import { formatCurrency } from "@/utils/formatters";

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
  tiendaId: string;
  onSuccess: () => Promise<void>;
}

export const DevolucionVentaDialog: FC<IProps> = ({
  dialogOpen,
  closeDialog,
  tiendaId,
  onSuccess,
}) => {
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(
    dayjs().subtract(30, "day"),
  );
  const [fechaFin, setFechaFin] = useState<Dayjs | null>(dayjs());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [ventas, setVentas] = useState<IVentaBuscada[]>([]);
  const [buscado, setBuscado] = useState(false);

  const [returnTarget, setReturnTarget] = useState<{
    ventaId: string;
    producto: IVentaBuscadaProducto;
  } | null>(null);
  const [cantidadDevolver, setCantidadDevolver] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (!saving) {
      closeDialog();
      setVentas([]);
      setBuscado(false);
      setReturnTarget(null);
      setCantidadDevolver("");
      setMotivo("");
    }
  };

  const handleBuscar = async () => {
    setLoading(true);
    setReturnTarget(null);
    try {
      const data = await buscarVentas(tiendaId, {
        fechaInicio: fechaInicio?.toISOString(),
        fechaFin: fechaFin?.toISOString(),
        search: search.trim() || undefined,
      });
      setVentas(data.ventas);
      setBuscado(true);
    } catch {
      showMessage("No se pudieron buscar las ventas", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirDevolucion = (
    ventaId: string,
    producto: IVentaBuscadaProducto,
  ) => {
    setReturnTarget({ ventaId, producto });
    setCantidadDevolver(String(producto.cantidadDisponible));
    setMotivo("");
  };

  const handleConfirmarDevolucion = async () => {
    if (!returnTarget) return;
    const cantidad = Number(cantidadDevolver);
    if (!cantidad || cantidad <= 0) {
      showMessage("Ingresa una cantidad válida", "error");
      return;
    }
    if (cantidad > returnTarget.producto.cantidadDisponible) {
      showMessage(
        `Solo quedan ${returnTarget.producto.cantidadDisponible} unidad(es) disponibles`,
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      await registrarDevolucionVenta(tiendaId, returnTarget.ventaId, {
        ventaProductoId: returnTarget.producto.ventaProductoId,
        cantidad,
        motivo: motivo || undefined,
      });
      showMessage("Devolución registrada exitosamente", "success");
      setReturnTarget(null);
      onSuccess();
      handleBuscar();
    } catch (error) {
      const msg =
        error?.response?.data?.error || "No se pudo registrar la devolución";
      showMessage(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      fullWidth
      maxWidth={isMobile ? "xs" : "md"}
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ pb: 1 }}>Devolución de venta</DialogTitle>
      <DialogContent sx={{ px: isMobile ? 2 : 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Buscá la venta original (aunque su período ya haya cerrado) para
          registrar que un cliente devolvió un producto. El producto vuelve al
          inventario y se resta de la ganancia y la caja de hoy.
        </Typography>

        <Stack direction={isMobile ? "column" : "row"} spacing={2} mb={2}>
          <DatePicker
            label="Desde"
            value={fechaInicio}
            onChange={setFechaInicio}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
          <DatePicker
            label="Hasta"
            value={fechaFin}
            onChange={setFechaFin}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
          <TextField
            label="Producto"
            placeholder="Nombre del producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
          />
        </Stack>

        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleBuscar}
          disabled={loading}
          sx={{ mb: 2 }}
        >
          {loading ? "Buscando..." : "Buscar ventas"}
        </Button>

        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && buscado && ventas.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No se encontraron ventas con esos filtros.
          </Typography>
        )}

        <Stack spacing={1.5}>
          {ventas.map((venta) => (
            <Card key={venta.id} variant="outlined">
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
                  <Typography variant="body2" color="text.secondary">
                    {dayjs(venta.createdAt).format("DD/MM/YYYY HH:mm")}
                    {venta.usuarioNombre && ` · ${venta.usuarioNombre}`}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(venta.total)}
                  </Typography>
                </Box>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.75}>
                  {venta.productos.map((p) => (
                    <Box
                      key={p.ventaProductoId}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1}
                    >
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" noWrap>
                          {p.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vendido: {p.cantidad}
                          {p.cantidadDevuelta > 0 &&
                            ` · Ya devuelto: ${p.cantidadDevuelta}`}
                        </Typography>
                      </Box>
                      {p.cantidadDisponible <= 0 ? (
                        <Chip
                          label="Sin disponible"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleAbrirDevolucion(venta.id, p)}
                        >
                          <UndoIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Stack>

                {returnTarget && returnTarget.ventaId === venta.id && (
                  <Box
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight={500} mb={1}>
                      Devolver: {returnTarget.producto.nombre}
                    </Typography>
                    <Stack
                      direction={isMobile ? "column" : "row"}
                      spacing={1.5}
                    >
                      <TextField
                        label="Cantidad"
                        type="number"
                        value={cantidadDevolver}
                        onChange={(e) => setCantidadDevolver(e.target.value)}
                        inputProps={{
                          min: 0,
                          max: returnTarget.producto.cantidadDisponible,
                          step: "0.01",
                        }}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Motivo (opcional)"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} mt={1.5}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleConfirmarDevolucion}
                        disabled={saving}
                      >
                        {saving ? "Guardando..." : "Confirmar devolución"}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setReturnTarget(null)}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{ px: isMobile ? 2 : 3, pb: isMobile ? 2 : undefined }}
      >
        <Button
          onClick={handleClose}
          startIcon={!isMobile ? <CloseIcon /> : undefined}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
