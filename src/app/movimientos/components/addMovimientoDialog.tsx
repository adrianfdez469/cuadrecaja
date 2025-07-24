import { FC, useState, useEffect } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Icon,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Chip,
  Card,
  CardContent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMessageContext } from "@/context/MessageContext";
import { cretateBatchMovimientos, getProductosTiendaParaEntrada, getProductosTiendaParaNoEntrada } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { ITipoMovimiento } from "@/types/IMovimiento";
import {
  TIPOS_MOVIMIENTO_MANUAL,
  TIPO_MOVIMIENTO_LABELS,
  TIPO_MOVIMIENTO_DESCRIPTIONS,
  TIPO_MOVIMIENTO_EJEMPLOS,
  TIPO_MOVIMIENTO_COLORS
} from "@/constants/movimientos";
import { formatCurrency } from "@/utils/formatters";
import { Add, Info } from "@mui/icons-material";
import { getProveedores, createProveedor } from "@/services/proveedorService";
import { IProveedor } from "@/types/IProveedor";
import { requiereCPP } from "@/lib/cpp-calculator";
import { useProductSelectionModal } from "@/hooks/useProductSelectionModal";
import { IProductoDisponible, OperacionTipo, ProductSelectionModal } from "@/components/ProductcSelectionModal";
import { ILocal } from "@/types/ILocal";
import { getLocales } from "@/services/localesService";

interface IProductoMovimiento {
  nombre: string;
  productoId: string;
  cantidad: number;
  costoUnitario?: number;
  costoTotal: number;
  costo: number;
  proveedor?: {
    id: string;
    nombre: string;
  };
}


interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
  // productos: IProducto[];
  fetchMovimientos: () => Promise<void>;
}

const getOperacion = (tipo: ITipoMovimiento): OperacionTipo => {
  switch (tipo) {
    case "COMPRA":
    case "CONSIGNACION_ENTRADA":
    case "AJUSTE_ENTRADA":
    case "DESAGREGACION_ALTA":
    case "TRASPASO_ENTRADA":
      return "ENTRADA";

    case "AJUSTE_SALIDA":
    case "CONSIGNACION_DEVOLUCION":
    case "DESAGREGACION_BAJA":
    case "TRASPASO_SALIDA":
    case "VENTA":
      return "SALIDA";

    default:
      return "ENTRADA";
  }
}

export const AddMovimientoDialog: FC<IProps> = ({
  dialogOpen,
  closeDialog,
  // productos,
  fetchMovimientos
}) => {
  const [tipo, setTipo] = useState<ITipoMovimiento>("COMPRA");
  const [itemsProductos, setItemsProductos] = useState<IProductoMovimiento[]>([]);
  const [saving, setSaving] = useState(false);
  const { showMessage } = useMessageContext();
  const [motivo, setMotivo] = useState("");
  const [proveedor, setProveedor] = useState<IProveedor | null>(null);
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const { user } = useAppContext();
  const [loadingProductos, setLoadingProductos] = useState(false);
  const {
    isOpen,
    operacion,
    openModal,
    closeModal,
    handleConfirm,
    setOnConfirm,

  } = useProductSelectionModal();

  const [destinations, setDestinations] = useState<ILocal[]>([])
  const [destinationId, setDestinationId] = useState<string>("")

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Cargar proveedores cuando se abre el diálogo o cambia el tipo
  useEffect(() => {
    if (dialogOpen && (tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION")) {
      fetchProveedores();
    }
    if (dialogOpen && (tipo === "TRASPASO_SALIDA")) {
      fetchDestinations();
    }
  }, [dialogOpen, tipo]);

  useEffect(() => {
    setOnConfirm(async (productosSeleccionados) => {
      // Lógica para procesar la selección
      console.log(productosSeleccionados);

      setItemsProductos(
        productosSeleccionados.map((p) => {
          return {
            nombre: p.nombre,
            cantidad: p.cantidad || 0,
            costo: p.costo || 0,
            costoTotal: p.costo && p.cantidad ? p.costo * p.cantidad : 0,
            productoId: p.productoId,
            costoUnitario: p.costo || 0,
            ...(p.proveedor && {
              proveedor: {
                id: p.proveedor?.id || "",
                nombre: p.proveedor?.nombre || ""
              }
            })
          }
        })
      );
    });
  }, [operacion, setOnConfirm]);

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

  const fetchDestinations = async () => {
    const locales = await getLocales();
    setDestinations(locales.filter((l) => l.id !== user.localActual.id));
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
      setItemsProductos([]);
      setMotivo("");
      setProveedor(null);
      setTipo("COMPRA");
      setCreandoProveedor(false);
    }
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
          ...(motivo !== "" && { motivo: motivo }),
          ...((tipo === "CONSIGNACION_ENTRADA" || tipo === "CONSIGNACION_DEVOLUCION" ) && proveedor && {
            proveedorId: proveedor.id
          }),
          ...(tipo === "TRASPASO_SALIDA" && {
            destinationId: destinationId
          })
        },
        itemsProductos.map((item) => {
          return {
            cantidad: item.cantidad,
            productoId: item.productoId,

            // Agregar costos si es necesario
            ...(requiereCPP(tipo) && item.costoUnitario && {
              costoUnitario: item.costoUnitario,
              costoTotal: item.costoTotal
            }),
            ...(item.proveedor && tipo === "TRASPASO_SALIDA" && {
              proveedorId: item.proveedor.id
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
    const needsDestination = tipo === "TRASPASO_SALIDA" && !destinationId;

    return hasInvalidProducts || needsProveedor || needsDestination;
  };

  const loadProductos = async (operacion: OperacionTipo, take = 50, skip = 0, filter?: { categoriaId?: string, text?: string }): Promise<IProductoDisponible[]> => {
    try {
      setLoadingProductos(true);
      const tiendaId = user.localActual.id;
      if (operacion === 'ENTRADA') {
        const productos = await getProductosTiendaParaEntrada(tiendaId, tipo, { take, skip, ...filter }, proveedor?.id)
        const prods: IProductoDisponible[] = [];
        productos.forEach((p) => {

          if (p.productosTienda.length > 0) {
            p.productosTienda.forEach((pt) => {
              prods.push({
                productoId: p.id,
                nombre: p.nombre,
                categoriaId: p.categoriaId,
                categoria: { id: p.categoriaId, nombre: p.categoria.nombre },

                productoTiendaId: pt.id,
                precio: pt.precio,
                costo: pt.costo,
                existencia: pt.existencia,
                proveedorId: pt.proveedor?.id,
                proveedor: pt.proveedor,
                codigosProducto: p.codigosProducto,
                // tiendaId: tiendaId,
              });
            });
          } else {
            prods.push({

              productoId: p.id,
              nombre: p.nombre,
              categoriaId: p.categoriaId,
              categoria: { id: p.categoriaId, nombre: p.categoria.nombre },

              productoTiendaId: null,
              precio: null,
              costo: null,
              existencia: null,
              proveedorId: null,
              proveedor: null,
              codigosProducto: p.codigosProducto,
              // tiendaId: tiendaId,
            });
          }
        });
        return prods;
      }
      if (operacion === 'SALIDA') {
        const productos = await getProductosTiendaParaNoEntrada(tiendaId, tipo, { take, skip, ...filter }, proveedor?.id);
        const prods: IProductoDisponible[] = [];


        productos.forEach((p) => {
          p.productosTienda.forEach((pt) => {
            prods.push({
              productoId: p.id,
              nombre: p.nombre,
              categoriaId: p.categoriaId,
              categoria: { id: p.categoriaId, nombre: p.categoria.nombre },

              productoTiendaId: pt.id,
              precio: pt.precio,
              costo: pt.costo,
              existencia: pt.existencia,
              proveedorId: pt.proveedor?.id,
              proveedor: pt.proveedor,
              codigosProducto: p.codigosProducto,
              // tiendaId: tiendaId,

            });
          });

        });
        return prods;

      }
    } catch (error) {
      console.log(error);
      showMessage("No se pudo cargar los productos", "error");
    } finally {
      setLoadingProductos(false);
    }
  }

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

          {/* Campo local para seleccionar el local */}
          {(tipo === 'TRASPASO_SALIDA' &&
            <FormControl fullWidth margin="normal">
              <InputLabel>Local</InputLabel>
              <Select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value as string)}
              >
                {destinations.map((local) => (
                  <MenuItem key={local.id} value={local.id}>
                    {local.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {isOpen && (
            <ProductSelectionModal
              open={isOpen}
              onClose={closeModal}
              loadProductos={loadProductos}
              operacion={operacion}
              onConfirm={handleConfirm}
              loading={loadingProductos}
              iTipoMovimiento={tipo}
              productosSeleccionadosIniciales={itemsProductos}
            />
          )}

          <Button
            sx={{ mb: 2, mt: 2 }}
            variant="contained"
            fullWidth
            onClick={() => openModal(getOperacion(tipo))}
            startIcon={<Add />}
            disabled={isFormValid()}
          >
            Adicionar Productos
          </Button>

          {itemsProductos.length > 0
            && itemsProductos.map((p, index) => {
              return (
                <Card key={index}>
                  <CardContent>
                    <Typography variant="body1" fontWeight={500}>
                      {p.proveedor ? `${p.nombre} - ${p.proveedor.nombre}` : p.nombre}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {p.cantidad === 1 ? "1 unidad" : `${p.cantidad} unidades`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {`Costo unitario: ${formatCurrency(p.costoUnitario || 0)}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {`Costo total: ${formatCurrency(p.costoTotal || 0)}`}
                    </Typography>
                  </CardContent>
                </Card>
              )
            })}

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
    </>
  );
};
