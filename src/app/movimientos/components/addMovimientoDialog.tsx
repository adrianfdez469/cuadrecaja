import { FC, useState, useEffect } from "react";
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
  Icon,
  useTheme,
  useMediaQuery,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Chip
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMessageContext } from "@/context/MessageContext";
import { cretateBatchMovimientos } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { ITipoMovimiento } from "@/types/IMovimiento";
import { 
  TIPOS_MOVIMIENTO_MANUAL, 
  TIPO_MOVIMIENTO_LABELS,
  TIPO_MOVIMIENTO_DESCRIPTIONS,
  TIPO_MOVIMIENTO_EJEMPLOS,
  TIPO_MOVIMIENTO_COLORS
} from "@/constants/movimientos";
import useConfirmDialog from "@/components/confirmDialog";
import { formatCurrency } from "@/utils/formatters";
import { Info } from "@mui/icons-material";
import { getProveedores, createProveedor } from "@/services/proveedorService";
import { IProveedor } from "@/types/IProveedor";
import { requiereCPP } from "@/lib/cpp-calculator";
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
  const [proveedor, setProveedor] = useState<IProveedor | null>(null);
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const { user } = useAppContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Cargar proveedores cuando se abre el diálogo o cambia el tipo
  useEffect(() => {
    if (dialogOpen && (tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION")) {
      fetchProveedores();
    }
  }, [dialogOpen, tipo]);

  const fetchProveedores = async () => {
    setLoadingProveedores(true);
    try {
      const data = await getProveedores();
      setProveedores(data);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      showMessage("Error al cargar proveedores", "error");
    } finally {
      setLoadingProveedores(false);
    }
  };

  const handleCrearProveedor = async (nombre: string) => {
    try {
      setCreandoProveedor(true);
      const nuevoProveedor = await createProveedor({
        nombre: nombre.trim(),
        descripcion: "",
        direccion: "",
        telefono: ""
      });
      
      // Actualizar lista de proveedores
      setProveedores(prev => [...prev, nuevoProveedor]);
      setProveedor(nuevoProveedor);
      
      showMessage("Proveedor creado exitosamente", "success");
    } catch (error) {
      console.error("Error al crear proveedor:", error);
      const errorMessage = error.response?.data?.error || "Error al crear el proveedor";
      showMessage(errorMessage, "error");
    } finally {
      setCreandoProveedor(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      closeDialog();
      setItemsProductos([{ productoId: "", cantidad: 0, costoUnitario: 0, costoTotal: 0 }]);
      setMotivo("");
      setProveedor(null);
      setTipo("COMPRA");
      setCreandoProveedor(false);
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
      const localId = user.localActual.id;
      await cretateBatchMovimientos(
        {
          tiendaId: localId,
          tipo: tipo,
          usuarioId: user.id,
          ...(motivo !== "" && {motivo: motivo}),
          ...((tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION") && proveedor && {
            proveedorId: proveedor.id
          })
        },
        itemsProductos.map((item) => {
          return {
            cantidad: item.cantidad,
            productoId: item.productoId,
            // Agregar costos si es una compra
            ...(requiereCPP(tipo) && item.costoUnitario && {
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
    const hasInvalidProducts = itemsProductos.some(item => 
      !item.productoId || 
      item.cantidad <= 0 ||
      (requiereCPP(tipo) && (!item.costoUnitario || item.costoUnitario <= 0))
    );

    const needsProveedor = (tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION") && !proveedor;

    return hasInvalidProducts || needsProveedor;
  };

  return (
    <>
      <Dialog 
        open={dialogOpen} 
        onClose={handleClose} 
        fullWidth 
        maxWidth={isMobile ? "xs" : "md"}
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          Crear Movimiento
        </DialogTitle>
        
        <DialogContent sx={{ px: isMobile ? 2 : 3 }}>
          {/* Selector de tipo de movimiento */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo de Movimiento</InputLabel>
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ITipoMovimiento)}
              label="Tipo de Movimiento"
              MenuProps={{
                PaperProps: {
                  sx: { 
                    maxHeight: isMobile ? 300 : 400,
                    maxWidth: isMobile ? '90vw' : undefined
                  }
                }
              }}
            >
              {TIPOS_MOVIMIENTO_MANUAL.map((tipoMovimiento) => (
                <MenuItem key={tipoMovimiento} value={tipoMovimiento}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {TIPO_MOVIMIENTO_LABELS[tipoMovimiento]}
                    </Typography>
                    {/* {!isMobile && ( */}
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          fontSize: '0.75rem',
                          lineHeight: 1.2,
                          display: 'block',
                          mt: 0.25,
                          whiteSpace: 'normal',
                          wordWrap: 'break-word'
                        }}
                      >
                        {TIPO_MOVIMIENTO_DESCRIPTIONS[tipoMovimiento]}
                      </Typography>
                     {/* )} */}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Acordeón con descripción y ejemplo */}
          {tipo && (
            <Box sx={{ mt: 2 }}>
              <Accordion 
                defaultExpanded={false}
                sx={{ 
                  boxShadow: 'none',
                  border: `2px solid ${TIPO_MOVIMIENTO_COLORS[tipo]}30`,
                  '&:before': { display: 'none' },
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon sx={{ color: TIPO_MOVIMIENTO_COLORS[tipo] }} />}
                  sx={{ 
                    bgcolor: `${TIPO_MOVIMIENTO_COLORS[tipo]}08`,
                    '&:hover': { bgcolor: `${TIPO_MOVIMIENTO_COLORS[tipo]}12` },
                    minHeight: 56,
                    '& .MuiAccordionSummary-content': { 
                      alignItems: 'center',
                      my: 1
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Icon 
                      sx={{ 
                        color: TIPO_MOVIMIENTO_COLORS[tipo],
                        fontSize: '22px',
                        mr: 1.5
                      }}
                    >
                      {isMobile ? <Info /> : <Info sx={{ fontSize: '22px' }} />}
                    </Icon>
                    <Box>
                      <Typography 
                        variant={isMobile ? "subtitle1" : "h6"}
                        sx={{ 
                          fontWeight: 'bold',
                          color: TIPO_MOVIMIENTO_COLORS[tipo]
                        }}
                      >
                        {TIPO_MOVIMIENTO_LABELS[tipo]}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        Descripción y ejemplo
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2, pb: 3 }}>
                  {/* Descripción */}
                  <Box sx={{ mb: 2 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: isMobile ? '0.875rem' : '0.95rem',
                        lineHeight: 1.5,
                        fontWeight: 500,
                        mb: 1
                      }}
                    >
                      ¿Qué es este tipo de movimiento?
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: isMobile ? '0.875rem' : '0.95rem',
                        lineHeight: 1.5
                      }}
                    >
                      {TIPO_MOVIMIENTO_DESCRIPTIONS[tipo]}
                    </Typography>
                  </Box>
                  
                  {/* Ejemplo */}
                  <Box 
                    sx={{ 
                      p: 2, 
                      bgcolor: `${TIPO_MOVIMIENTO_COLORS[tipo]}05`,
                      borderRadius: 1,
                      borderLeft: `4px solid ${TIPO_MOVIMIENTO_COLORS[tipo]}`
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: isMobile ? '0.875rem' : '0.95rem',
                        lineHeight: 1.5,
                        fontWeight: 500,
                        mb: 1,
                        color: TIPO_MOVIMIENTO_COLORS[tipo]
                      }}
                    >
                      Ejemplo práctico:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: isMobile ? '0.875rem' : '0.95rem',
                        lineHeight: 1.5,
                        fontStyle: 'italic'
                      }}
                    >
                      {TIPO_MOVIMIENTO_EJEMPLOS[tipo]}
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {/* Campo de motivo para ajustes */}
          {(tipo === "AJUSTE_ENTRADA" || tipo === "AJUSTE_SALIDA") && (
            <TextField
              label="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="Describe el motivo del ajuste..."
              size={isMobile ? "small" : "medium"}
              helperText="Especifica la razón del ajuste (ej: productos vencidos, rotos, encontrados, etc.)"
            />
          )}

          {/* Campo de proveedor para consignaciones */}
          {(tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION") && (
            <Box sx={{ mt: 2 }}>
              <Autocomplete
                options={proveedores}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.nombre}
                value={proveedor}
                onChange={(event, newValue) => {
                  // Manejar tanto IProveedor como string
                  if (typeof newValue === 'string') {
                    // Si es string, buscar en proveedores existentes o crear nuevo
                    const proveedorExistente = proveedores.find(p => p.nombre.toLowerCase() === newValue.toLowerCase());
                    if (proveedorExistente) {
                      setProveedor(proveedorExistente);
                    } else if (newValue.startsWith('Crear "')) {
                      // Extraer el nombre del proveedor a crear
                      const nombreProveedor = newValue.replace('Crear "', '').replace('"', '');
                      handleCrearProveedor(nombreProveedor);
                    }
                  } else {
                    // Si es IProveedor o null
                    setProveedor(newValue);
                  }
                }}
                loading={loadingProveedores}
                freeSolo
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor"
                    placeholder="Selecciona o escribe un proveedor..."
                    fullWidth
                    size={isMobile ? "small" : "medium"}
                    helperText="Selecciona un proveedor existente o escribe uno nuevo"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingProveedores && <div>Cargando...</div>}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {option.nombre}
                      </Typography>
                      {option.descripcion && (
                        <Typography variant="caption" color="text.secondary">
                          {option.descripcion}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.nombre}
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
                filterOptions={(options, params) => {
                  const filtered = options.filter(option =>
                    option.nombre.toLowerCase().includes(params.inputValue.toLowerCase())
                  );

                  const { inputValue } = params;
                  const isExisting = options.some(option => 
                    option.nombre.toLowerCase() === inputValue.toLowerCase()
                  );

                  if (inputValue !== '' && !isExisting) {
                    filtered.push({
                      id: 'new',
                      nombre: `Crear "${inputValue}"`,
                      descripcion: 'Nuevo proveedor',
                      direccion: null,
                      telefono: null,
                      negocioId: '',
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                  }

                  return filtered;
                }}
                onInputChange={async (event, newInputValue, reason) => {
                  if (reason === 'selectOption') {
                    const selectedOption = proveedores.find(p => p.nombre === newInputValue) || 
                                          proveedores.find(p => p.nombre.includes(newInputValue));
                    
                    if (!selectedOption && newInputValue && !newInputValue.startsWith('Crear "')) {
                      // Si no existe el proveedor, intentar crearlo
                      try {
                        await handleCrearProveedor(newInputValue);
                      } catch (error) {
                        // Error ya manejado en handleCrearProveedor
                        console.log(error);
                        showMessage('Error al crear el proveedor', 'error');
                      }
                    }
                  }
                }}
                onBlur={async (event) => {
                  const target = event.target as HTMLInputElement;
                  const inputValue = target.value;
                  if (inputValue && !proveedor && !proveedores.some(p => p.nombre.toLowerCase() === inputValue.toLowerCase())) {
                    // Si hay texto y no hay proveedor seleccionado, crear uno nuevo
                    try {
                      await handleCrearProveedor(inputValue);
                    } catch (error) {
                      // Error ya manejado en handleCrearProveedor
                      console.log(error);
                      showMessage('Error al crear el proveedor', 'error');
                    }
                  }
                }}
                disabled={creandoProveedor}
              />
            </Box>
          )}

          {/* Título de productos */}
          <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ mt: 3, mb: 2 }}>
            Productos
          </Typography>

          {/* Lista de productos */}
          {itemsProductos.map((p, index) => (
            <Box 
              key={index} 
              sx={{ 
                mb: 2, 
                p: isMobile ? 1.5 : 2, 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 1 
              }}
            >
              <Stack spacing={2}>
                {/* Selector de producto */}
                <FormControl fullWidth>
                  <InputLabel size={isMobile ? "small" : "normal"}>
                    Producto
                  </InputLabel>
                  <Select
                    value={p.productoId}
                    label="Producto"
                    onChange={(e) => handleChangeProducto(index, "productoId", e.target.value)}
                    size={isMobile ? "small" : "medium"}
                  >
                    {productos.map((producto) => (
                      <MenuItem key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Fila de cantidad y botón eliminar */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    label="Cantidad"
                    type="number"
                    value={p.cantidad || ""}
                    onChange={(e) => handleChangeProducto(index, "cantidad", e.target.value)}
                    size={isMobile ? "small" : "medium"}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 1, step: 1 }}
                  />
                  <IconButton 
                    onClick={() => handleEliminarProducto(index)}
                    color="error"
                    disabled={itemsProductos.length === 1}
                    size={isMobile ? "small" : "medium"}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* Campos de costo para productos que requieren CPP */}
                {requiereCPP(tipo) && (
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        label="Costo Unitario"
                        type="number"
                        value={p.costoUnitario || ""}
                        onChange={(e) => handleChangeProducto(index, "costoUnitario", e.target.value)}
                        size={isMobile ? "small" : "medium"}
                        sx={{ flex: 1 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                      <TextField
                        label="Costo Total"
                        type="number"
                        value={p.costoTotal || ""}
                        onChange={(e) => handleChangeProducto(index, "costoTotal", e.target.value)}
                        size={isMobile ? "small" : "medium"}
                        sx={{ flex: 1 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Box>
                    
                    <Box sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 1, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Total del producto
                      </Typography>
                      <Typography variant={isMobile ? "subtitle1" : "h6"} color="primary" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(p.costoTotal || 0)}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </Box>
          ))}

          {/* Botón agregar producto */}
          <Button
            sx={{ mt: 2 }}
            onClick={handleAgregarProducto}
            disabled={isFormValid()}
            variant="outlined"
            fullWidth
            size={isMobile ? "medium" : "large"}
          >
            + Agregar otro producto
          </Button>

          {/* Total general para productos que requieren CPP */}
          {requiereCPP(tipo) && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant={isMobile ? "h6" : "h5"} color="primary" sx={{ fontWeight: 'bold' }}>
                Total General: {formatCurrency(itemsProductos.reduce((sum, item) => sum + (item.costoTotal || 0), 0))}
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: isMobile ? 2 : 3, pb: isMobile ? 2 : undefined }}>
          <Button 
            onClick={handleClose} 
            startIcon={!isMobile ? <CloseIcon /> : undefined}
            size={isMobile ? "medium" : "large"}
          >
            Cancelar
          </Button>
          <Button
            disabled={isFormValid() || saving}
            startIcon={!isMobile ? <SaveIcon /> : undefined}
            variant="contained"
            onClick={handleGuardar}
            size={isMobile ? "medium" : "large"}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {ConfirmDialogComponent}
    </>
  );
};
