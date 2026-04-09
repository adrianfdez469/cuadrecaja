import {formatCurrency, formatNumber, normalizeSearch} from "@/utils/formatters";
import {Search, DoDisturbOn} from "@mui/icons-material";
import {
  Alert,
  Box,
  TableHead,
  Table,
  CircularProgress,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  Chip,
  Grid2 as Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem, Tooltip, IconButton, Button
} from "@mui/material";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {IProductoDisponible, OperacionTipo} from "../ProductSelectionModal";
import {ICategory} from "@/types/ICategoria";
import {fetchCategories} from "@/services/categoryService";
import {useVirtualizer} from '@tanstack/react-virtual';
import ProductCard from "@/components/ProductcSelectionModal/ProductCard";
import ProductProcessorData from "@/components/ProductProcessorData/ProductProcessorData";
import {IProcessedData} from "@/types/IProcessedData";

interface IProps {
  operacion: OperacionTipo;
  loading: boolean;
  productos: IProductoDisponible[];
  productosDisponibles: IProductoDisponible[];
  isMobile: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreProductos: () => Promise<void>
  agregarProducto: (producto: IProductoDisponible) => void
  onFilterChange?: (filters: { text?: string, categoriaId?: string }) => void
  onSearchChange?: (isActive: boolean) => void;
  onProductScan?: (data: IProcessedData) => void;
  show: boolean;
  isFiltering: boolean;
  currentPage: number;
  onReject?: (producto: IProductoDisponible) => void;
}

const TableProductosDisponibles: React.FC<IProps> = ({
                                                       operacion,
                                                       loading,
                                                       productos,
                                                       productosDisponibles,
                                                       isMobile,
                                                       isLoadingMore,
                                                       hasMore,
                                                       loadMoreProductos,
                                                       agregarProducto,
                                                       onFilterChange,
                                                       onSearchChange,
                                                       onProductScan,
                                                       show,
                                                       isFiltering,
                                                       currentPage,
                                                       onReject
                                                     }) => {

  const [categorias, setCategorias] = useState<ICategory[]>([]);
  const [filterText, setFilterText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // Refs para los inputs no controlados
  const tableContainerRef = useRef<HTMLDivElement>(null);


  // Clear category filter when switching to mobile
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isMobile && filterCategoryId) {
      setFilterCategoryId('');
    }
  }, [isMobile]); // Intencional: solo ejecutar cuando cambia isMobile

  // Notify parent when search/filter is active
  useEffect(() => {
    onSearchChange?.(filterText.trim().length > 0 || filterCategoryId.length > 0);
  }, [filterText, filterCategoryId, onSearchChange]);

  // Virtualización de filas
  const rowVirtualizer = useVirtualizer({
    count: productosDisponibles.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => isMobile ? 52 : 56, // Compact collapsed card height on mobile
    overscan: 10,
  });

  // Ref para evitar múltiples llamadas simultáneas
  const loadingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Para el infinite scroll, usamos un enfoque más estable
  useEffect(() => {
    // Limpiar timeout previo
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // SOLO ejecutar si:
    // 1. Hay productos disponibles
    // 2. No estamos cargando
    // 3. No estamos filtrando
    // 4. Hay productos cargados
    // 5. Hay más productos por cargar
    // 6. No hay otra carga en progreso
    // 7. El componente está visible
    // 8. No estamos en la carga inicial
    if (
        productosDisponibles.length > 0 &&
        !loading &&
        !isFiltering &&
        productos.length > 0 &&
        hasMore &&
        !loadingRef.current &&
        !isLoadingMore &&
        show &&
        currentPage > 1 // Evitar ejecutar en la carga inicial
    ) {
      // Usar timeout para evitar ejecuciones inmediatas
      timeoutRef.current = setTimeout(() => {
        const virtualRows = rowVirtualizer.getVirtualItems();
        if (virtualRows.length > 0) {
          const last = virtualRows[virtualRows.length - 1];
          // Solo cargar más si estamos cerca del final (últimas 3 filas)
          if (last.index >= productosDisponibles.length - 3) {
            loadingRef.current = true;
            loadMoreProductos().finally(() => {
              loadingRef.current = false;
            });
          }
        }
      }, 100); // Pequeño delay para estabilizar
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    rowVirtualizer.getVirtualItems(),
    productosDisponibles.length,
    loading,
    isFiltering,
    productos.length,
    hasMore,
    loadMoreProductos,
    isLoadingMore,
    show,
    currentPage
  ]);

  // Resetear el ref cuando se cambian los filtros
  useEffect(() => {
    if (isFiltering) {
      loadingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [isFiltering]);

  // Limpiar estado cuando el componente se oculta
  useEffect(() => {
    if (!show) {
      loadingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [show]);

  useEffect(() => {
    const fetchCategorias = async () => {
      const categorias = await fetchCategories();
      setCategorias(categorias);
    };
    fetchCategorias();
  }, []);

  // Función para aplicar filtros
  const handleApplyFilters = useCallback(() => {
    if (onFilterChange) {
      const normalizedText = normalizeSearch(filterText);
      onFilterChange({
        text: normalizedText || undefined,
        categoriaId: filterCategoryId || undefined
      });
    }
  }, [onFilterChange, filterText, filterCategoryId]);

  // Debounce para aplicar filtros automáticamente
  useEffect(() => {
    const timer = setTimeout(() => {
      handleApplyFilters();
    }, 500);

    return () => clearTimeout(timer);
  }, [filterText, filterCategoryId, handleApplyFilters]);

  return (
      <div style={{display: show ? 'block' : 'none'}}>
        <Box sx={{ mb: 1.5 }}>
          <Grid container spacing={1} alignItems="center">
            <Grid size={{xs: 12, sm: 4}}>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                    fullWidth
                    type="search"
                    size="small"
                    placeholder="Buscar por nombre o proveedor..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                            <InputAdornment position="start">
                              <Search/>
                            </InputAdornment>
                        )
                      }
                    }}
                />
                {onProductScan && (
                  <ProductProcessorData
                    onProcessedData={(data: IProcessedData) => { if (data?.code) onProductScan(data); }}
                    onHardwareScan={(data: IProcessedData) => { if (data?.code) onProductScan(data); }}
                    keepFocus={false}
                    showInput={false}
                  />
                )}
              </Box>
            </Grid>

            {!isMobile && (
              <Grid size={{xs: 12, sm: 4}}>
                  <FormControl fullWidth size="small">
                      <InputLabel>Categoría</InputLabel>
                      <Select
                          label="Categoría"
                          value={filterCategoryId}
                          onChange={(e) => setFilterCategoryId(e.target.value as string)}
                      >
                          <MenuItem value="">Todas las categorías</MenuItem>
                        {categorias.map(categoria => (
                            <MenuItem key={categoria.id} value={categoria.id}>
                              {categoria.nombre}
                            </MenuItem>
                        ))}
                      </Select>
                  </FormControl>
              </Grid>
            )}

          </Grid>
        </Box>
        {(loading && productos.length === 0 && show) && (
            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8}}>
              <CircularProgress size={40} thickness={4} sx={{color: '#1976d2'}}/>
              <Typography variant="body2" color="primary" sx={{mt: 2, fontWeight: 'medium'}}>
                Cargando productos...
              </Typography>
            </Box>
        )
        }

        {productos.length > 0 && (
            <Box
                ref={tableContainerRef}
                sx={{
                  height: isMobile ? 500 : 500,
                  overflow: 'auto',
                  border: isMobile ? 'none' : '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: isMobile ? 'transparent' : 'background.paper'
                }}
            >
                {!isMobile ? (
                  <Table
                      style={{
                        tableLayout: 'fixed',
                      }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          Producto
                        </TableCell>
                        <TableCell>
                          Existencia
                        </TableCell>
                        <TableCell>
                          Costo
                        </TableCell>
                        <TableCell>
                          Precio
                        </TableCell>
                        {onReject && (
                          <TableCell>
                            Acciones
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {productosDisponibles.length > 0 ? (
                          <>
                            {(() => {
                              const virtualItems = rowVirtualizer.getVirtualItems();
                              const totalSize = rowVirtualizer.getTotalSize();
                              const paddingTop = virtualItems.length > 0 ? virtualItems?.[0]?.start || 0 : 0;
                              const paddingBottom = virtualItems.length > 0 ? totalSize - (virtualItems?.[virtualItems.length - 1]?.end || 0) : 0;

                              return (
                                  <>
                                    {paddingTop > 0 && (
                                        <TableRow>
                                              <TableCell
                                                  colSpan={onReject ? 5 : 4}
                                                  style={{height: `${paddingTop}px`, padding: 0, border: 0}}
                                              />
                                        </TableRow>
                                    )}
                                    {virtualItems.map(virtualRow => {
                                      const producto = productosDisponibles[virtualRow.index];
                                      const isDisabled = operacion === 'SALIDA' && producto.existencia <= 0;
                                      return (
                                          <TableRow
                                              key={virtualRow.key}
                                              data-index={virtualRow.index}
                                              ref={rowVirtualizer.measureElement}
                                              hover={!isDisabled}
                                              onClick={() => !isDisabled && agregarProducto(producto)}
                                              sx={{
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isDisabled ? 0.5 : 1
                                              }}
                                          >
                                            <TableCell>
                                              <Typography
                                                  variant="body2"
                                                  fontWeight="medium"
                                                  sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    display: 'block'
                                                  }}
                                              >
                                                {producto.proveedor ? `${producto.nombre} - ${producto.proveedor.nombre}` : producto.nombre}
                                              </Typography>
                                              {producto.proveedor && (
                                                  <Typography
                                                      variant="caption"
                                                      color="text.secondary"
                                                      sx={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block'
                                                      }}
                                                  >
                                                    {producto.proveedor.nombre}
                                                  </Typography>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Chip
                                                  label={formatNumber(producto.existencia || 0)}
                                                  size="medium"
                                                  color={producto.existencia <= 0 ? 'error' : producto.existencia <= 5 ? 'warning' : 'success'}
                                                  sx={{fontSize: '0.75rem'}}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Typography
                                                  variant="body2"
                                                  fontWeight="medium"
                                                  sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                              >
                                                {formatCurrency(producto.costo)}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography
                                                  variant="body2"
                                                  fontWeight="medium"
                                                  sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                              >
                                                {formatCurrency(producto.precio)}
                                              </Typography>
                                            </TableCell>
                                            {onReject && (
                                              <TableCell onClick={(e) => e.stopPropagation()}>
                                                {producto.movimientoOrigenId && (
                                                  <Tooltip title="Rechazar Entrada">
                                                    <IconButton
                                                      size="small"
                                                      color="error"
                                                      onClick={() => onReject(producto)}
                                                    >
                                                      <DoDisturbOn />
                                                    </IconButton>
                                                  </Tooltip>
                                                )}
                                              </TableCell>
                                            )}
                                          </TableRow>
                                      );
                                    })}
                                    {paddingBottom > 0 && (
                                        <TableRow>
                                          <TableCell
                                              colSpan={onReject ? 5 : 4}
                                              style={{height: `${paddingBottom}px`, padding: 0, border: 0}}
                                          />
                                        </TableRow>
                                    )}
                                  </>
                              );
                            })()}
                          </>
                      ) : (
                          <TableRow>
                            <TableCell colSpan={onReject ? 5 : 4} align="center" sx={{py: 4}}>
                              <Typography variant="body2" color="text.secondary">
                                {loading ? 'Cargando productos...' : 'No se encontraron productos con los filtros aplicados'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                    <Box sx={{ position: 'relative', height: `${rowVirtualizer.getTotalSize()}px`, width: '100%' }}>
                      {rowVirtualizer.getVirtualItems().map(virtualRow => {
                        const producto = productosDisponibles[virtualRow.index];
                        const isDisabled = operacion === 'SALIDA' && producto.existencia <= 0;
                        return (
                          <Box
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualRow.start}px)`,
                              p: 1
                            }}
                          >
                            <ProductCard
                                key={producto.productoId}
                                name={producto.proveedor ? `${producto.nombre} - ${producto.proveedor.nombre}` : producto.nombre}
                                cost={producto.costo}
                                precio = {producto.precio}
                                stock={producto.existencia}
                                onClick={() => !isDisabled && agregarProducto(producto)}
                                actions={
                                    producto.movimientoOrigenId && (<Button
                                        variant="contained"
                                        color="error"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onReject(producto);
                                        }}
                                    >
                                      Rechazar
                                    </Button>)
                                }
                            />
                          </Box>
                        );
                      })}
                    </Box>
                )}
            </Box>
        )}

        {
            !hasMore && productosDisponibles.length > 0 && (
                <Box textAlign="center" p={2}>
                  <Typography variant="body2" color="text.secondary">
                    No hay más productos para cargar
                  </Typography>
                </Box>
            )
        }

        {
            !isLoadingMore && !loading && productosDisponibles.length === 0 && productos.length === 0 && (
                <Box textAlign="center" p={4}>
                  <Alert severity="info" sx={{maxWidth: 400, mx: 'auto'}}>
                    <Typography variant="body2">
                      No se encontraron productos con los filtros aplicados
                    </Typography>
                  </Alert>
                </Box>
            )
        }
      </div>
  )

};

export default React.memo(TableProductosDisponibles);