import { FC, useState } from "react";
import { IProducto } from "@/types/IProducto";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  InputAdornment,
  Grid
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { useMessageContext } from "@/context/MessageContext";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { ITipoMovimiento } from "@/types/IMovimiento";
import { TIPOS_MOVIMIENTO_MANUAL, TIPO_MOVIMIENTO_LABELS } from "@/constants/movimientos";
import useConfirmDialog from "@/components/confirmDialog";
import { formatCurrency } from "@/utils/formatters";

interface IProductoMovimiento {
  productoId: string;
  cantidad: number;
  costoUnitario?: number;
  costoTotal?: number;
}

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
  productos: IProducto[];
  fetchMovimientos: () => Promise<void>;
}

export const AddMovimientoDialog: FC<IProps> = ({
  dialogOpen,
  closeDialog,
  productos,
  fetchMovimientos
}) => {
  const [tipo, setTipo] = useState<ITipoMovimiento>("COMPRA");
  const [itemsProductos, setItemsProductos] = useState<IProductoMovimiento[]>([
    { productoId: "", cantidad: 0, costoUnitario: 0, costoTotal: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const { showMessage } = useMessageContext();
  const [motivo, setMotivo] = useState("");
  const { user } = useAppContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  const handleClose = () => {
    if (!saving) {
      closeDialog();
      setItemsProductos([{ productoId: "", cantidad: 0, costoUnitario: 0, costoTotal: 0 }]);
      setMotivo("");
      setTipo("COMPRA");
    }
  };

  const handleAgregarProducto = () => {
    setItemsProductos([...itemsProductos, { productoId: "", cantidad: 0, costoUnitario: 0, costoTotal: 0 }]);
  };

  const handleEliminarProducto = (index: number) => {
    if (itemsProductos.length === 1) {
      return; // No eliminar si es el único producto
    }

    const producto = productos.find(p => p.id === itemsProductos[index].productoId);
    const nombreProducto = producto ? producto.nombre : "este producto";
    
    confirmDialog(
      `¿Estás seguro de que deseas eliminar "${nombreProducto}" del movimiento?`,
      () => {
        setItemsProductos(itemsProductos.filter((_, i) => i !== index));
      }
    );
  };

  const handleChangeProducto = (index: number, field: keyof IProductoMovimiento, value: string | number) => {
    const nuevos = [...itemsProductos];
    
    if (field === "cantidad") {
      const cantidad = Number(value) || 0;
      nuevos[index].cantidad = cantidad;
      
      // Si hay costo unitario, recalcular costo total
      if (nuevos[index].costoUnitario && cantidad > 0) {
        nuevos[index].costoTotal = nuevos[index].costoUnitario! * cantidad;
      }
    } else if (field === "costoUnitario") {
      const costoUnitario = Number(value) || 0;
      nuevos[index].costoUnitario = costoUnitario;
      
      // Recalcular costo total si hay cantidad
      if (nuevos[index].cantidad > 0) {
        nuevos[index].costoTotal = costoUnitario * nuevos[index].cantidad;
      }
    } else if (field === "costoTotal") {
      const costoTotal = Number(value) || 0;
      nuevos[index].costoTotal = costoTotal;
      
      // Recalcular costo unitario si hay cantidad
      if (nuevos[index].cantidad > 0) {
        nuevos[index].costoUnitario = costoTotal / nuevos[index].cantidad;
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nuevos[index][field] = value as any;
    }
    
    setItemsProductos(nuevos);
  };

  const handleGuardar = async () => {
    setSaving(true);

    try {
      const tiendaId = user.tiendaActual.id;
      await cretateBatchMovimientos(
        {
          tiendaId: tiendaId,
          tipo: tipo,
          usuarioId: user.id,
          ...(motivo !== "" && {motivo: motivo})
        },
        itemsProductos.map((item) => {
          return {
            cantidad: item.cantidad,
            productoId: item.productoId,
            // Agregar costos si es una compra
            ...(tipo === "COMPRA" && item.costoUnitario && {
              costoUnitario: item.costoUnitario,
              costoTotal: item.costoTotal
            })
          };
        })
      );

      showMessage("Movimiento creado exitosamente", "success");
      handleClose();
      fetchMovimientos();
      
    } catch (error) {
      console.log(error);
      showMessage("No se pudo guardar el movimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = () => {
    return itemsProductos.some(item => 
      !item.productoId || 
      item.cantidad <= 0 ||
      (tipo === "COMPRA" && (!item.costoUnitario || item.costoUnitario <= 0))
    );
  };

  const esCompra = tipo === "COMPRA";

  return (
    <>
      <Dialog open={dialogOpen} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle>Crear Movimiento</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Tipo de Movimiento"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ITipoMovimiento)}
            fullWidth
            margin="normal"
          >
            {TIPOS_MOVIMIENTO_MANUAL.map((tipoMovimiento) => (
              <MenuItem key={tipoMovimiento} value={tipoMovimiento}>
                {TIPO_MOVIMIENTO_LABELS[tipoMovimiento]}
              </MenuItem>
            ))}
          </TextField>

          {(tipo === "AJUSTE_ENTRADA" || tipo === "AJUSTE_SALIDA") && (
            <TextField
              label="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="Describe el motivo del ajuste..."
            />
          )}

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Productos
          </Typography>

          {itemsProductos.map((p, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={esCompra ? 6 : 8}>
                  <FormControl fullWidth>
                    <InputLabel id={`prod-select-label-${index}`}>Producto</InputLabel>
                    <Select
                      labelId={`prod-select-label-${index}`}
                      value={p.productoId}
                      label="Producto"
                      onChange={(e) =>
                        handleChangeProducto(index, "productoId", e.target.value)
                      }
                    >
                      {productos.map((producto) => (
                        <MenuItem key={producto.id} value={producto.id}>
                          {producto.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={esCompra ? 3 : 2}>
                  <TextField
                    label="Cantidad"
                    type="number"
                    value={p.cantidad || ""}
                    onChange={(e) =>
                      handleChangeProducto(index, "cantidad", e.target.value)
                    }
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                  />
                </Grid>

                <Grid item xs={6} sm={esCompra ? 2 : 2}>
                  <IconButton 
                    onClick={() => handleEliminarProducto(index)}
                    color="error"
                    disabled={itemsProductos.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>

                {esCompra && (
                  <>
                    <Grid item xs={6} sm={4}>
                      <TextField
                        label="Costo Unitario"
                        type="number"
                        value={p.costoUnitario || ""}
                        onChange={(e) =>
                          handleChangeProducto(index, "costoUnitario", e.target.value)
                        }
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4}>
                      <TextField
                        label="Costo Total"
                        type="number"
                        value={p.costoTotal || ""}
                        onChange={(e) =>
                          handleChangeProducto(index, "costoTotal", e.target.value)
                        }
                        fullWidth
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Total del producto
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(p.costoTotal || 0)}
                        </Typography>
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          ))}

          <Button
            sx={{ mt: 2 }}
            onClick={handleAgregarProducto}
            disabled={isFormValid()}
            variant="outlined"
            fullWidth
          >
            + Agregar otro producto
          </Button>

          {esCompra && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
              <Typography variant="h6" color="primary">
                Total General: {formatCurrency(itemsProductos.reduce((sum, item) => sum + (item.costoTotal || 0), 0))}
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} startIcon={<CloseIcon />}>
            Cancelar
          </Button>
          <Button
            disabled={isFormValid() || saving}
            startIcon={<SaveIcon />}
            variant="contained"
            onClick={handleGuardar}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {ConfirmDialogComponent}
    </>
  );
};
