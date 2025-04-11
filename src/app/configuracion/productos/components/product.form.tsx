import { useState, useEffect, FC } from "react";
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
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Categoria } from "../types/categorias";
import { fetchProducts } from "@/services/productServise";
import { IProducto } from "@/types/IProducto";

const API_CATEGORIES = "/api/categorias";

interface IProps {
  open: boolean;
  handleClose: () => void;
  handleSave: (nombre: string, descripcion: string, categoriaId: string, fraccion?: {fraccionDeId?: string, unidadesPorFraccion?: number}) => Promise<void>;
  editingProd?: IProducto;
}

export const ProductoForm:FC<IProps> = ({ open, handleClose, handleSave, editingProd }) => {

console.log(editingProd);


  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [esFraccion, setEsFraccion] = useState(false);
  const [productos, setProductos] = useState([]);
  const [selectedFraccionProduct, setSelectedFraccionProduct] = useState<IProducto>();
  const [fraccionValue, setFraccionValue] = useState<number>();

  const hendleSelectProduct = (p) => {
    setSelectedFraccionProduct(p);
    setCategoria(p.categoria.id);
  };

  const handleFraccionValueChange = (value) => {
    if(Number.parseInt(value)) {
      setFraccionValue(Number.parseInt(value));
    }
  }

  const handleSaveProduct = () => {
    if(selectedFraccionProduct) {
      handleSave(nombre, descripcion, categoria, {fraccionDeId: selectedFraccionProduct?.id, unidadesPorFraccion: fraccionValue})
    } else {
      handleSave(nombre, descripcion, categoria);
    }
  }

  useEffect(() => {
    fetch(API_CATEGORIES)
      .then((res) => res.json())
      .then((data) => {
        setCategorias(data);
        console.log('editingProd', editingProd);
        
        if(editingProd) {
          setNombre(editingProd.nombre);
          setDescripcion(editingProd.descripcion);
          setCategoria(editingProd.categoriaId);
          setEsFraccion(!!editingProd.fraccionDeId);  
        }
      });
  }, []);

  useEffect(() => {
    if (esFraccion && productos.length === 0) {
      // cargar productos
      fetchProducts().then((prods) => {
        setProductos(prods);
        
          if(editingProd) {
            
            const prodFrac = prods.find(p => p.id === editingProd.fraccionDeId)
            setSelectedFraccionProduct(prodFrac);
            setFraccionValue(editingProd.unidadesPorFraccion);
          }
        
      });
    }
  }, [esFraccion]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth>
      <DialogTitle>
        {categoria ? "Editar Producto" : "Agregar Producto"}
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Nombre"
          fullWidth
          margin="normal"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <TextField
          label="Descripción"
          fullWidth
          margin="normal"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={esFraccion}
              onChange={(e, checked) => setEsFraccion(checked)}
            />
          }
          label={`Es producto fracción${esFraccion ? " de" : ""}`}
        />
        {esFraccion && (
          <Box display={'flex'} flexDirection={'row'} sx={{paddingTop: 2, paddingBottom: 2, gap: 2}} >
          <FormControl fullWidth sx={{flex: 0.7}}>
            <InputLabel id="prod-select-label">Producto</InputLabel>
            <Select
              labelId="prod-select-label"
              id="prod-select"
              value={selectedFraccionProduct}
              label="Producto"
              onChange={(e) => hendleSelectProduct(e.target.value)}
            >
              {productos.map((p) => {
                return (
                  <MenuItem key={p.id} value={p}>
                    {p.nombre}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <TextField sx={{flex: 0.3}} label="Fraccionable en" value={fraccionValue} onChange={(e) => handleFraccionValueChange(e.target.value)}/>
          </Box>

        )}
        
        <Select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          fullWidth
          displayEmpty
        >
          <MenuItem value="" disabled>
            Selecciona una categoría
          </MenuItem>
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
        <Button onClick={handleClose} color="secondary">
          Cancelar
        </Button>
        <Button
          onClick={handleSaveProduct}
          color="primary"
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
