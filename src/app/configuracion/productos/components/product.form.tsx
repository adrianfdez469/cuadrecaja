import { useState, useEffect } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Select,
  Box,
  Button,
} from '@mui/material';
import { Categoria } from '../types/categorias';

const API_CATEGORIES = "/api/categorias";

export const ProductoForm = ({ open, handleClose, handleSave }) => {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    fetch(API_CATEGORIES)
      .then((res) => res.json())
      .then((data) => setCategorias(data));
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth>
      <DialogTitle>{categoria ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
      <DialogContent>
        <TextField label="Nombre" fullWidth margin="normal" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <TextField label="Descripción" fullWidth margin="normal" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} fullWidth displayEmpty>
          <MenuItem value="" disabled>Selecciona una categoría</MenuItem>
          {categorias.map((cat) => (
            <MenuItem key={cat.id} value={cat.id}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    backgroundColor: cat.color,
                    borderRadius: "4px",
                    marginRight: 1,
                  }}
                />
                {cat.nombre}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">Cancelar</Button>
        <Button onClick={() => handleSave( nombre, descripcion, categoria )} color="primary">Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}