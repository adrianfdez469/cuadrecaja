import {FC, useEffect, useState} from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {Info} from "@mui/icons-material";
import {Categoria} from "../types/categorias";
import {fetchProducts} from "@/services/productServise";
import {IProducto} from "@/types/IProducto";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HardwareQrScanner from '@/components/ProductProcessorData/HardwareQrScanner';
import MobileQrScanner from '@/components/ProductProcessorData/MobileQrScanner';

const API_CATEGORIES = "/api/categorias";

interface IProps {
  open: boolean;
  handleClose: () => void;
  handleSave: (
    nombre: string, 
    descripcion: string, 
    categoriaId: string, 
    fraccion?: {fraccionDeId?: string, unidadesPorFraccion?: number},
    codigosProducto?: string[]
  ) => Promise<void>;
  editingProd?: IProducto;
}

export const ProductoForm:FC<IProps> = ({ open, handleClose, handleSave, editingProd }) => {

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [esFraccion, setEsFraccion] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const [selectedFraccionProduct, setSelectedFraccionProduct] = useState<IProducto>();
  const [fraccionValue, setFraccionValue] = useState<number>();

  const [codigosProducto, setCodigosProducto] = useState<string[]>([]);

  const [consignacionTooltipOpen, setConsignacionTooltipOpen] = useState(false);
  const [fraccionTooltipOpen, setFraccionTooltipOpen] = useState(false);

  const hendleSelectProduct = (p) => {
    setSelectedFraccionProduct(p);
    setCategoria(p.categoria.id);
  };

  const handleFraccionValueChange = (value) => {
    if(Number.parseInt(value)) {
      setFraccionValue(Number.parseInt(value));
    }
  }

  const handleAddCodigo = (codigo?: string) => {
    if (!codigo) codigo = '';
    setCodigosProducto((prev) => [...prev, codigo]);
  };

  const handleRemoveCodigo = (idx: number) => {
    setCodigosProducto((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCodigoChange = (idx: number, value: string) => {
    setCodigosProducto((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };

  const handleSaveProduct = () => {
    if(selectedFraccionProduct) {
      handleSave(nombre, descripcion, categoria, {fraccionDeId: selectedFraccionProduct?.id, unidadesPorFraccion: fraccionValue}, codigosProducto.filter(Boolean));
    } else {
      handleSave(nombre, descripcion, categoria, undefined, codigosProducto.filter(Boolean));
    }
  };

  const handleFraccionTooltipToggle = () => {
    setFraccionTooltipOpen(!fraccionTooltipOpen);
    // Cerrar el otro tooltip si está abierto
    if (consignacionTooltipOpen) {
      setConsignacionTooltipOpen(false);
    }
  };

  useEffect(() => {
    fetch(API_CATEGORIES)
      .then((res) => res.json())
      .then((data) => {
        setCategorias(data);
        if(editingProd) {
          setNombre(editingProd.nombre);
          setDescripcion(editingProd.descripcion);
          setCategoria(editingProd.categoriaId);
          setEsFraccion(!!editingProd.fraccionDeId);
          if(editingProd.codigosProducto) {
            setCodigosProducto(editingProd.codigosProducto.map(c => c.codigo));
          }
        }
      });
    fetchProducts().then((prods) => setProductos(prods));
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
        {editingProd ? "Editar Producto" : "Agregar Producto"}
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={esFraccion}
                onChange={(e) => setEsFraccion(e.target.checked)}
              />
            }
            label="¿Es fracción de otro producto?"
          />
          <Tooltip 
            title="Los productos fracción permiten vender un producto existente en unidades más pequeñas. Por ejemplo, si tienes un paquete de 12 unidades, puedes crear una fracción para vender de 1 en 1."
            arrow
            placement={isMobile ? "top" : "left"}
            open={fraccionTooltipOpen}
            disableHoverListener
            disableFocusListener
            disableTouchListener
            PopperProps={{
              modifiers: [
                {
                  name: 'preventOverflow',
                  enabled: true,
                  options: {
                    altAxis: true,
                    altBoundary: true,
                    tether: true,
                    rootBoundary: 'document',
                    padding: 8,
                  },
                },
                {
                  name: 'flip',
                  enabled: true,
                  options: {
                    altBoundary: true,
                    rootBoundary: 'document',
                    padding: 8,
                  },
                },
              ],
            }}
          >
            <IconButton 
              size="small" 
              onClick={handleFraccionTooltipToggle}
              sx={{ 
                color: fraccionTooltipOpen ? 'primary.main' : 'info.main',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
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
                  <MenuItem key={p.id} value={p.id}>
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
        <Box mb={2} mt={3}>
          <Box display="flex" alignItems="center" mb={1}>
            <span style={{ fontWeight: 600 }}>Códigos de Producto</span>
            <Tooltip title="Agregar código">
              <IconButton size="small" onClick={() => handleAddCodigo()} sx={{ ml: 1 }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {codigosProducto.map((codigo, idx) => (
            <Box key={idx} display="flex" alignItems="center" mb={1}>
              <HardwareQrScanner
                qrCodeSuccessCallback={(qrText) => handleCodigoChange(idx, qrText)}
                style={{ width: '100%' }}
                value={codigo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCodigoChange(idx, e.target.value)}
              />
              <Tooltip title="Escanear QR con cámara móvil">
                <Box ml={1}>
                  <MobileQrScanner
                    qrCodeSuccessCallback={(qrText) => handleCodigoChange(idx, qrText)}
                  />
                </Box>
              </Tooltip>
              <Tooltip title="Eliminar código">
                <IconButton onClick={() => handleRemoveCodigo(idx)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSaveProduct} color="primary">
          {editingProd ? "Guardar cambios" : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
