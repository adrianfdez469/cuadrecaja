import React, { useEffect, useMemo, useCallback, useState } from 'react';
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

} from '@mui/material';

import {
  Close,
  ShoppingCart,
  Inventory,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { ITipoMovimiento } from '@/types/IMovimiento';
import TableProductosDisponibles from './tables/TableProductosDisponibles';
import TableProductosSeleccionados from './tables/TableProductosSeleccionados';
import { sanitizeNumber } from '@/utils/formatters';
import { useMessageContext } from '@/context/MessageContext';
import ProductProcessorData from '@/components/ProductProcessorData/ProductProcessorData';

import { IProcessedData } from '@/types/IProcessedData';

// Tipos para el componente
export type OperacionTipo = 'ENTRADA' | 'SALIDA';

export interface IProductoDisponible {
  productoId: string;
  nombre: string;
  categoriaId?: string;
  categoria?: {
    id: string;
    nombre: string;
  };

  productoTiendaId?: string,
  precio?: number,
  costo?: number,
  existencia?: number,
  proveedorId?: string,
  proveedor?: {
    id: string;
    nombre: string;
  };
  movimientoOrigenId?: string;

  codigosProducto?: {
    codigo: string;
  }[];
}

export interface IProductoSeleccionado extends IProductoDisponible {
  cantidad: number;
  costoTotal: number;
}

interface ProductSelectionModalProps {
  open: boolean;
  onClose: () => void;
  loadProductos: (operacion: OperacionTipo, take: number, skip: number, filter?: { categoriaId?: string, text?: string }) => Promise<IProductoDisponible[]>;
  operacion: OperacionTipo;
  iTipoMovimiento: ITipoMovimiento;
  onConfirm: (productosSeleccionados: IProductoSeleccionado[]) => void;
  loading?: boolean;
  productosSeleccionadosIniciales?: IProductoSeleccionado[];
}

const ITEMS_PER_PAGE = 50;



export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  open,
  onClose,
  loadProductos,
  operacion,
  onConfirm,
  loading = false,
  iTipoMovimiento,
  productosSeleccionadosIniciales
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showMessage } = useMessageContext();

  // Estados principales
  const [activeTab, setActiveTab] = useState<number>(0);
  const [productosSeleccionados, setProductosSeleccionados] = useState<IProductoSeleccionado[]>(productosSeleccionadosIniciales || []);
  const [productos, setProductos] = useState<IProductoDisponible[]>([]);

  // Estados para infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Estados para filtros
  const [currentFilters, setCurrentFilters] = useState<{ text?: string, categoriaId?: string }>({});
  const [isFiltering, setIsFiltering] = useState(false);

  // Productos disponibles (excluyendo los ya seleccionados) - MEMOIZADO
  const productosDisponibles = useMemo(() => {
    console.log('productosDisponibles', productos, productosSeleccionados);

    const buildId = (p) => {
      const prodId = p.productoId;
      const provId = p.proveedorId || '';
      const movId = p.movimientoOrigenId || '';
      return `${prodId}-${provId}-${movId}`;
    };
    const idsSeleccionados = new Set(productosSeleccionados.map(p => buildId(p)));

    return productos.filter(p => !idsSeleccionados.has(buildId(p)));
  }, [productos, productosSeleccionados]);

  // Totales - MEMOIZADOS
  const totalProductos = useMemo(() => productosSeleccionados.length, [productosSeleccionados]);

  // Validaciones - MEMOIZADAS
  const hayErrores = useMemo(() =>
    productosSeleccionados.some(p => {
      if (operacion === 'SALIDA' || iTipoMovimiento === 'TRASPASO_ENTRADA') {
        return p.cantidad > p.existencia;
      }
      return p.cantidad <= 0;
    }),
    [productosSeleccionados, operacion]
  );

  const handleConfirm = useCallback(() => {
    if (hayErrores) return;

    if (totalProductos === 0 && productosSeleccionadosIniciales && productosSeleccionadosIniciales.length > 0) {
      onConfirm(productosSeleccionados);
      return;
    }

    if (productosSeleccionados.some(p => p.costo === 0 || p.costo === null)) {
      showMessage('El costo de un producto no puede ser 0', 'error');
      return;
    }

    onConfirm(productosSeleccionados);
  }, [hayErrores, totalProductos, onConfirm, productosSeleccionados]);

  // Función para cargar más productos - MEMOIZADA
  const loadMoreProductos = useCallback(async () => {

    console.log('loadMoreProductos');

    // Validaciones más estrictas para evitar llamadas innecesarias
    if (isLoadingMore || !hasMore || productos.length === 0 || currentPage === 1) return;

    setIsLoadingMore(true);
    try {
      const nuevosProductos = await loadProductos(
        operacion,
        ITEMS_PER_PAGE,
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentFilters
      );

      // Si no hay productos nuevos, definitivamente no hay más
      if (nuevosProductos.length === 0) {
        setHasMore(false);
        return;
      }

      if (nuevosProductos.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      setProductos(prev => [...prev, ...nuevosProductos]);
      setCurrentPage(prev => prev + 1);
    } catch (error) {
      console.error('Error cargando más productos:', error);
      // En caso de error, también marcamos que no hay más para evitar loops infinitos
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, productos.length, currentPage, loadProductos, operacion, currentFilters]);

  // Función para manejar cambios de filtros
  const handleFilterChange = useCallback((filters: { text?: string, categoriaId?: string }) => {

    // Solo actualizar filtros si realmente cambiaron
    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(currentFilters);
    if (!filtersChanged) return;

    setIsFiltering(true);
    setCurrentFilters(filters);

    // Resetear estados antes de cargar
    setProductos([]);
    setCurrentPage(1);
    setHasMore(true);

    // Cargar productos con nuevos filtros
    const cargarProductosConFiltros = async () => {
      setIsLoadingMore(true);
      try {
        const productosFiltrados = await loadProductos(
          operacion,
          ITEMS_PER_PAGE, 0,
          filters
        );

        // Si no hay productos, definitivamente no hay más
        if (productosFiltrados.length === 0) {
          setHasMore(false);
        } else if (productosFiltrados.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        // Actualizar productos de manera más suave para evitar re-renderizados abruptos
        setProductos(productosFiltrados);
        setCurrentPage(2);
      } catch (error) {
        console.error('Error cargando productos con filtros:', error);
        // En caso de error, también marcamos que no hay más para evitar loops infinitos
        setHasMore(false);
        setProductos([]);
      } finally {
        setIsLoadingMore(false);
        setIsFiltering(false);
      }
    };

    cargarProductosConFiltros();
  }, [loadProductos, operacion, currentFilters]);

  // Resetear estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      // Resetear todos los estados de manera síncrona
      setActiveTab(0);
      setProductos([]);
      setCurrentPage(1);
      setHasMore(true);
      setIsLoadingMore(false);
      // setCurrentFilters({});
      setIsFiltering(false);
    }
  }, [open]);

  // Cargar productos iniciales solo cuando se abre el modal y el estado está limpio
  useEffect(() => {
    if (open && productos.length === 0 && !isLoadingMore && currentPage === 1) {
      const cargarProductosIniciales = async () => {
        setIsLoadingMore(true);

        try {
          console.log('cargarProductosIniciales');
          const productosIniciales = await loadProductos(
            operacion,
            ITEMS_PER_PAGE,
            0,
            currentFilters
          );

          // Si no hay productos iniciales, no hay más para cargar
          if (productosIniciales.length === 0) {
            setHasMore(false);
            setProductos([]);
          } else if (productosIniciales.length < ITEMS_PER_PAGE) {
            setHasMore(false);
            setProductos(productosIniciales);
          } else {
            setHasMore(true);
            setProductos(productosIniciales);
          }

          setCurrentPage(2);
        } catch (error) {
          console.error('Error cargando productos iniciales:', error);
          // En caso de error, marcamos que no hay más para evitar loops infinitos
          setHasMore(false);
          setProductos([]);
        } finally {
          setIsLoadingMore(false);
        }
      };

      cargarProductosIniciales();
    }
  }, [open, operacion, loadProductos, currentFilters, productos.length, isLoadingMore, currentPage]);

  const handleProductScan = useCallback((qrText: string) => {
    console.log('handleProductScan', qrText);

    // productosDisponibles
    // productosSeleccionados
    console.log(qrText);
    
    console.log('productosDisponibles', productosDisponibles);
    console.log('productosSeleccionados', productosSeleccionados);
    
    const producto = productosDisponibles.find(p => {
      if(p.codigosProducto && p.codigosProducto.some(c => c.codigo === qrText)) return p;
      return null;
    });

    if(producto) {
      agregarProducto(producto);
    } else {
      const prod = productosSeleccionados.find(p => {
        if(p.codigosProducto && p.codigosProducto.some(c => c.codigo === qrText)) return p;
        return null;
      });

      if(prod) {
        showMessage(`Producto ${prod.nombre} ya seleccionado`, 'warning');
      } else {
        showMessage(`Producto ${qrText} no encontrado`, 'error');
      }
      throw new Error('Producto no encontrado');
    }

  }, [productosDisponibles, productosSeleccionados]);


  // Funciones para manejar productos - MEMOIZADAS
  const agregarProducto = useCallback((producto: IProductoDisponible) => {

    console.log('agregarProducto', producto);

    let cantidadInicial = 0;
    let costoInicial = 0;
    if (operacion === 'ENTRADA') {
      cantidadInicial = 1;
      costoInicial = 1;
    }
    if (operacion === 'SALIDA' || iTipoMovimiento === 'TRASPASO_ENTRADA') {
      cantidadInicial = producto.existencia;
      costoInicial = producto.costo;
    }

    const nuevoProducto: IProductoSeleccionado = {
      productoId: producto.productoId,
      nombre: producto.nombre,
      productoTiendaId: producto.productoTiendaId,
      categoriaId: producto.categoriaId,
      categoria: producto.categoria,
      precio: producto.precio,
      costo: producto.costo,
      existencia: producto.existencia,
      proveedorId: producto.proveedorId,
      proveedor: producto.proveedor,
      cantidad: cantidadInicial,
      costoTotal: cantidadInicial * costoInicial,
      movimientoOrigenId: producto.movimientoOrigenId,
      codigosProducto: producto.codigosProducto
    };

    setProductosSeleccionados(prev => [...prev, nuevoProducto]);
  }, [operacion]);

  const actualizarCantidad = useCallback((productoId: string, nuevaCantidad: number, proveedorId?: string) => {

    const nuevaCantidadNumber = sanitizeNumber(Number(nuevaCantidad));
    setProductosSeleccionados(prev => prev.map(p => {

      if (p.productoId === productoId && p.proveedorId === proveedorId) {
        const cantidad = operacion === 'SALIDA'
          ? Math.min(nuevaCantidadNumber, p.existencia)
          : nuevaCantidadNumber;

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
      if (p.productoId === productoId) {
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
    setProductosSeleccionados(prev => prev.filter(p => p.productoId !== productoId));
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
    onFilterChange: handleFilterChange,
    show: activeTab === 0,
    isFiltering,
    currentPage
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
    handleFilterChange,
    activeTab,
    isFiltering,
    currentPage
  ]);

  const tableProductosSeleccionadosProps = useMemo(() => ({
    operacion,
    productosSeleccionados,
    isMobile,
    actualizarCantidad,
    actualizarCosto,
    eliminarProducto,
    limpiarSeleccion,
    tipoMovimiento: iTipoMovimiento
  }), [
    operacion,
    productosSeleccionados,
    isMobile,
    actualizarCantidad,
    actualizarCosto,
    eliminarProducto,
    limpiarSeleccion,
    iTipoMovimiento
  ]);

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

        <TableProductosDisponibles {...tableProductosDisponiblesProps} show={activeTab === 0} />
        <TableProductosSeleccionados {...tableProductosSeleccionadosProps} show={activeTab === 1} />
      </DialogContent>




      {/* Footer */}
      <DialogActions sx={{ p: isMobile ? 2 : 3, pt: 1 }}>
        
          <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
            <ProductProcessorData 
              onProcessedData={(data: IProcessedData) => {
                if (data?.code) handleProductScan(data.code);
              }}
              onHardwareScan={(data: IProcessedData) => {
                if (data?.code) handleProductScan(data.code);
              }}
              keepFocus={false} // Evitar que robe el foco de otros campos
            />

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
                disabled={hayErrores || (totalProductos === 0 && productosSeleccionadosIniciales && productosSeleccionadosIniciales.length === 0) || loading}
                fullWidth={isMobile}
                startIcon={operacion === 'ENTRADA' ? <TrendingUp /> : <TrendingDown />}
              >
                {loading ? 'Procesando...' : totalProductos === 0 && productosSeleccionadosIniciales && productosSeleccionadosIniciales.length > 0 ? 'Terminar' : `Confirmar ${operacion}`}
              </Button>
            </Stack>

          </Stack>

        
      </DialogActions>
    </Dialog>
  );
}; 