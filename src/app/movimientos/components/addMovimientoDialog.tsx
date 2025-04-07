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
  OutlinedInput,
  Select,
  TextField,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { useMessageContext } from "@/context/MessageContext";
import { cretateBatchMovimientos, saveMovimiento } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { ITipoMovimiento } from "@/types/IMovimiento";

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
  productos: IProducto[];
  fetchMovimientos: () => Promise<void>;
}

const tiposMovimiento = [
  "COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
];

export const AddMovimientoDialog: FC<IProps> = ({
  dialogOpen,
  closeDialog,
  productos,
  fetchMovimientos
}) => {
  const [tipo, setTipo] = useState<ITipoMovimiento>("COMPRA");
  const [itemsProductos, setItemsProductos] = useState([
    { productoId: "", cantidad: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const { showMessage } = useMessageContext();
  const [motivo, setMotivo] = useState("");
  const { user } = useAppContext();

  const handleClose = () => {
    if (!saving) {
      closeDialog();
      setItemsProductos([{ productoId: "", cantidad: 0 }]);
    }
  };

  const handleAgregarProducto = () => {
    setItemsProductos([...itemsProductos, { productoId: "", cantidad: 0 }]);
  };

  const handleEliminarProducto = (index) => {
    setItemsProductos(itemsProductos.filter((_, i) => i !== index));
  };

  const handleChangeProducto = (index, field, value) => {
    const nuevos = [...itemsProductos];
    if (field === "cantidad") {
      const cant = Number.parseInt(value);
      console.log(cant);

      nuevos[index][field] = cant;
    } else {
      nuevos[index][field] = value;
    }
    setItemsProductos(nuevos);
  };

  const handleGuardar = async () => {
    console.log(itemsProductos);
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
          };
        })
      );

      handleClose();
      fetchMovimientos();
      
    } catch (error) {
      showMessage("No se pudo guardar el movimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid =
    !itemsProductos[itemsProductos.length - 1].productoId ||
    itemsProductos[itemsProductos.length - 1].cantidad === 0;

  return (
    <Dialog open={dialogOpen} onClose={handleClose} fullWidth>
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
          {tiposMovimiento.map((op) => (
            <MenuItem key={op} value={op}>
              {op}
            </MenuItem>
          ))}
        </TextField>

        {tipo === "AJUSTE_ENTRADA" || tipo === "AJUSTE_SALIDA" && (
          <TextField
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            fullWidth
            margin="normal"
          />
        )}

        {itemsProductos.map((p, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mt={2}>
            <FormControl fullWidth>
              <InputLabel id="prod-select-label">Producto</InputLabel>
              <Select
                labelId="prod-select-label"
                id="prod-select"
                value={p.productoId}
                label="Producto"
                onChange={(e) =>
                  handleChangeProducto(index, "productoId", e.target.value)
                }
              >
                {productos.map((p) => {
                  return (
                    <MenuItem key={p.id} value={p.id}>
                      {p.nombre}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <TextField
              label="Cantidad"
              type="number"
              value={p.cantidad.toFixed(0)}
              onChange={(e) =>
                handleChangeProducto(index, "cantidad", Number(e.target.value))
              }
              fullWidth
            />
            <IconButton onClick={() => handleEliminarProducto(index)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}
        <Button
          sx={{ mt: 2 }}
          onClick={handleAgregarProducto}
          disabled={isFormValid}
        >
          + Agregar otro producto
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} startIcon={<CloseIcon />}>
          Cancelar
        </Button>
        <Button
          loading={saving}
          loadingPosition="end"
          startIcon={<SaveIcon />}
          variant="contained"
          onClick={handleGuardar}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
