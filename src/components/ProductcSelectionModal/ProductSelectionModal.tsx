import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Badge,
  useTheme,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import {
  Close,
  ShoppingCart,
  Inventory,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { IProductoTiendaV2 } from '@/types/IProducto';
import { ITipoMovimiento } from '@/types/IMovimiento';
import TableProductosDisponibles from './tables/TableProductosDisponibles';
import TableProductosSeleccionados from './tables/TableProductosSeleccionados';

// Tipos para el componente
export type OperacionTipo = 'ENTRADA' | 'SALIDA';

export interface ProductoSeleccionado {
  productoTienda: IProductoTiendaV2;
  cantidad: number;
  costo: number;
  costoTotal: number;
}

interface ProductSelectionModalProps {
  open: boolean;
  onClose: () => void;
  loadProductos: (operacion: OperacionTipo, take: number, skip: number, filter?: {categoriaId?: string, text?: string}) => Promise<IProductoTiendaV2[]>;
  operacion: OperacionTipo;
  iTipoMovimiento: ITipoMovimiento;
  onConfirm: (productosSeleccionados: ProductoSeleccionado[]) => void;
  loading?: boolean;
}

const ITEMS_PER_PAGE = 50; 

// Componente de carga para los tabs
const TabLoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" p={4}>
    <CircularProgress />
  </Box>
);

export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  open,
  onClose,
  loadProductos,
  operacion,
  onConfirm,
  loading = false,
  iTipoMovimiento
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Estados principales
  const [activeTab, setActiveTab] = useState(0);
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>([]);
  const [productos, setProductos] = useState<IProductoTiendaV2[]>([]);
  
  // Estados para infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Estados para filtros
  const [currentFilters, setCurrentFilters] = useState<{text?: string, categoriaId?: string}>({});

  // Productos disponibles (excluyendo los ya seleccionados) - MEMOIZADO
  const productosDisponibles = useMemo(() => {
    const idsSeleccionados = new Set(productosSeleccionados.map(p => p.productoTienda.id));
    return productos.filter(p => !idsSeleccionados.has(p.id));
  }, [productos, productosSeleccionados]);

  // Totales - MEMOIZADOS
  const totalProductos = useMemo(() => productosSeleccionados.length, [productosSeleccionados]);
  const totalCantidad = useMemo(() => 
    productosSeleccionados.reduce((sum, p) => sum + p.cantidad, 0), 
    [productosSeleccionados]
  );
  const totalCosto = useMemo(() => 
    productosSeleccionados.reduce((sum, p) => sum + p.costoTotal, 0), 
    [productosSeleccionados]
  );

  // Validaciones - MEMOIZADAS
  const hayErrores = useMemo(() => 
    productosSeleccionados.some(p => {
      if (operacion === 'SALIDA') {
        return p.cantidad > p.productoTienda.existencia;
      }
      return p.cantidad <= 0;
    }), 
    [productosSeleccionados, operacion]
  );

  const handleConfirm = useCallback(() => {
    if (hayErrores || totalProductos === 0) return;
    onConfirm(productosSeleccionados);
  }, [hayErrores, totalProductos, onConfirm, productosSeleccionados]);

  // Función para cargar más productos - MEMOIZADA
  const loadMoreProductos = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const nuevosProductos = await loadProductos(
        operacion, 
        ITEMS_PER_PAGE, 
        (currentPage - 1) * ITEMS_PER_PAGE, 
        currentFilters
      );
      
      if (nuevosProductos.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }
      
      setProductos(prev => [...prev, ...nuevosProductos]);
      setCurrentPage(prev => prev + 1);
    } catch (error) {
      console.error('Error cargando más productos:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, loadProductos, operacion, currentPage, currentFilters]);

  // Función para manejar cambios de filtros
  const handleFilterChange = useCallback((filters: {text?: string, categoriaId?: string}) => {
    setCurrentFilters(filters);
    setProductos([]);
    setCurrentPage(1);
    setHasMore(true);
    
    // Cargar productos con nuevos filtros
    const cargarProductosConFiltros = async () => {
      setIsLoadingMore(true);
      try {
        const productosFiltrados = await loadProductos(
          operacion, 
          ITEMS_PER_PAGE, 
          0, 
          filters
        );
        
        if (productosFiltrados.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        }
        
        setProductos(productosFiltrados);
        setCurrentPage(2);
      } catch (error) {
        console.error('Error cargando productos con filtros:', error);
      } finally {
        setIsLoadingMore(false);
      }
    };
    
    cargarProductosConFiltros();
  }, [loadProductos, operacion]);

  // Resetear estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setProductosSeleccionados([]);
      setProductos([]);
      setCurrentPage(1);
      setHasMore(true);
      setIsLoadingMore(false);
      setCurrentFilters({});
    }
  }, [open]);

  // Cargar productos iniciales solo cuando se abre el modal
  useEffect(() => {
    if (open && productos.length === 0) {
      const cargarProductosIniciales = async () => {
        setIsLoadingMore(true);
        
        try {
          const productosIniciales = await loadProductos(
            operacion, 
            ITEMS_PER_PAGE, 
            0, 
            {}
          );
          
          if (productosIniciales.length < ITEMS_PER_PAGE) {
            setHasMore(false);
          }
          
          setProductos(productosIniciales);
          setCurrentPage(2);
        } catch (error) {
          console.error('Error cargando productos iniciales:', error);
        } finally {
          setIsLoadingMore(false);
        }
      };
      
      cargarProductosIniciales();
    }
  }, [open, operacion, loadProductos, productos.length]);

  // Funciones para manejar productos - MEMOIZADAS
  const agregarProducto = useCallback((producto: IProductoTiendaV2) => {
    const cantidadInicial = operacion === 'ENTRADA' ? 1 : producto.existencia;
    const costoInicial = operacion === 'ENTRADA' ? producto.costo : producto.costo;
    
    const nuevoProducto: ProductoSeleccionado = {
      productoTienda: producto,
      cantidad: cantidadInicial,
      costo: costoInicial,
      costoTotal: cantidadInicial * costoInicial
    };

    setProductosSeleccionados(prev => [...prev, nuevoProducto]);
  }, [operacion]);

  const actualizarCantidad = useCallback((productoId: string, nuevaCantidad: number) => {
    setProductosSeleccionados(prev => prev.map(p => {
      if (p.productoTienda.id === productoId) {
        const cantidad = operacion === 'SALIDA' 
          ? Math.min(nuevaCantidad, p.productoTienda.existencia)
          : nuevaCantidad;
        
        return {
          ...p,
          cantidad,
          costoTotal: cantidad * p.costo
        };
      }
      return p;
    }));
  }, [operacion]);

  const actualizarCosto = useCallback((productoId: string, nuevoCosto: number) => {
    if (operacion === 'SALIDA') return; // No permitir editar costo en salidas
    
    setProductosSeleccionados(prev => prev.map(p => {
      if (p.productoTienda.id === productoId) {
        return {
          ...p,
          costo: nuevoCosto,
          costoTotal: p.cantidad * nuevoCosto
        };
      }
      return p;
    }));
  }, [operacion]);

  const eliminarProducto = useCallback((productoId: string) => {
    setProductosSeleccionados(prev => prev.filter(p => p.productoTienda.id !== productoId));
  }, []);

  const limpiarSeleccion = useCallback(() => {
    setProductosSeleccionados([]);
  }, []); 

  // Props memoizadas para las tablas
  const tableProductosDisponiblesProps = useMemo(() => ({
    operacion,
    loading,
    productos,
    productosDisponibles,
    isMobile,
    isLoadingMore,
    hasMore,
    loadMoreProductos,
    agregarProducto,
    onFilterChange: handleFilterChange
  }), [
    operacion,
    loading,
    productos,
    productosDisponibles,
    isMobile,
    isLoadingMore,
    hasMore,
    loadMoreProductos,
    agregarProducto,
    handleFilterChange
  ]);

  const tableProductosSeleccionadosProps = useMemo(() => ({
    operacion,
    productosSeleccionados,
    isMobile,
    actualizarCantidad,
    actualizarCosto,
    eliminarProducto,
    limpiarSeleccion
  }), [
    operacion,
    productosSeleccionados,
    isMobile,
    actualizarCantidad,
    actualizarCosto,
    eliminarProducto,
    limpiarSeleccion
  ]);

  // Renderizado condicional optimizado
  // const renderActiveTab = useCallback(() => {
  //   switch (activeTab) {
  //     case 0:
  //       return (
          
  //           <TableProductosDisponibles {...tableProductosDisponiblesProps} />
          
  //       );
  //     case 1:
  //       return (
          
  //           <TableProductosSeleccionados {...tableProductosSeleccionadosProps} />
          
  //       );
  //     default:
  //       return null;
  //   }
  // }, [activeTab, tableProductosDisponiblesProps, tableProductosSeleccionadosProps]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          height: isMobile ? '100vh' : '90vh',
          maxHeight: isMobile ? '100vh' : '90vh',
          m: isMobile ? 0 : 2
        }
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
              Selección de Productos - {operacion}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {operacion === 'ENTRADA' 
                ? 'Agregar productos al inventario' 
                : 'Retirar productos del inventario'
              }
            </Typography>
          </Box>
          <Button onClick={onClose} variant="text" size="large">
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: isMobile ? 1 : 3, pb: 0 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab 
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <Inventory />
                  <span>Productos Disponibles</span>
                  <Badge badgeContent={productosDisponibles.length} color="primary" />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <ShoppingCart />
                  <span>Productos Seleccionados</span>
                  <Badge badgeContent={totalProductos} color="secondary" />
                </Box>
              } 
            />
          </Tabs>
        </Box>

        {/* Contenido del tab activo */}
        {/* {renderActiveTab()} */}

        <TableProductosDisponibles {...tableProductosDisponiblesProps} show={activeTab === 0}/>
        <TableProductosSeleccionados {...tableProductosSeleccionadosProps} show={activeTab === 1}/>
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ p: isMobile ? 2 : 3, pt: 1 }}>
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          <Button
            onClick={onClose}
            variant="outlined"
            color="secondary"
            fullWidth={isMobile}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="primary"
            disabled={hayErrores || totalProductos === 0 || loading}
            fullWidth={isMobile}
            startIcon={operacion === 'ENTRADA' ? <TrendingUp /> : <TrendingDown />}
          >
            {loading ? 'Procesando...' : `Confirmar ${operacion}`}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}; 