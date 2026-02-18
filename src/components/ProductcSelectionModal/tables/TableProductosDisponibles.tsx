import { formatCurrency, formatNumber } from "@/utils/formatters";
import { Search, FilterAlt } from "@mui/icons-material";
import {
  Alert,
  Box,
  TableHead,
  Table,
  Paper,
  TableContainer,
  CircularProgress,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  Chip,
  Card,
  CardContent,
  Grid2 as Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button
} from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IProductoDisponible, OperacionTipo } from "../ProductSelectionModal";
import { ICategory } from "@/types/ICategoria";
import { fetchCategories } from "@/services/categoryService";
import { useVirtualizer } from '@tanstack/react-virtual';

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
  show: boolean;
  isFiltering: boolean;
  currentPage: number;
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
  show,
  isFiltering,
  currentPage,
}) => {

  const [categorias, setCategorias] = useState<ICategory[]>([]);

  // Refs para los inputs no controlados
  const filterTextRef = useRef<HTMLInputElement>(null);
  const filterCategoryRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);


  // Virtualización de filas
  const rowVirtualizer = useVirtualizer({
    count: productosDisponibles.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => isMobile ? 48 : 56,
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
      const text = filterTextRef.current?.value || '';
      const categoriaId = (filterCategoryRef.current?.querySelector('input') as HTMLInputElement)?.value || '';

      onFilterChange({
        text: text.trim() || undefined,
        categoriaId: categoriaId || undefined
      });
    }
  }, [onFilterChange]);

  // Función para limpiar filtros
  const handleClearFilters = useCallback(() => {
    if (filterTextRef.current) {
      filterTextRef.current.value = '';
    }
    if (filterCategoryRef.current) {
      const select = filterCategoryRef.current.querySelector('input') as HTMLInputElement;
      if (select) {
        select.value = '';
      }
    }

    if (onFilterChange) {
      onFilterChange({});
    }
  }, [onFilterChange]);

  if (loading && productos.length === 0 && show) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }} p={4}>
        <CircularProgress />
      </Box>
    );
  } else {
    return (
      <div style={{ display: show ? 'block' : 'none' }}>
        {/* Filtros */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar por nombre o proveedor..."
                  inputRef={filterTextRef}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      )
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyFilters();
                    }
                  }}
                />
              </Grid>
              {!isMobile &&
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Categoría</InputLabel>
                    <Select
                      ref={filterCategoryRef}
                      label="Categoría"
                      defaultValue=""
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
              }
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<FilterAlt />}
                    onClick={handleApplyFilters}
                    fullWidth
                  >
                    Filtrar
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleClearFilters}
                    fullWidth
                  >
                    Limpiar
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <TableContainer
          component={Paper}
          variant="outlined"
          ref={tableContainerRef}
          style={{
            height: isMobile ? 400 : 500,
            overflow: 'auto',
          }}
        >
          <Table
            style={{
              tableLayout: 'fixed',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell
                  style={{
                    width: '50%',
                  }}
                >
                  Producto
                </TableCell>
                <TableCell
                  style={{
                    width: '20%',
                  }}
                >
                  {isMobile ? 'Cant' : 'Existencia'}
                </TableCell>
                <TableCell>
                  Costo
                </TableCell>
                <TableCell>
                  Precio
                </TableCell>
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
                              colSpan={4}
                              style={{ height: `${paddingTop}px`, padding: 0, border: 0 }}
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
                              <TableCell style={{ width: '50%' }}>
                                <Typography
                                  variant={isMobile ? "caption" : "body2"}
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
                                  size={isMobile ? "small" : "medium"}
                                  color={producto.existencia <= 0 ? 'error' : producto.existencia <= 5 ? 'warning' : 'success'}
                                  sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant={isMobile ? "caption" : "body2"}
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
                                  variant={isMobile ? "caption" : "body2"}
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
                            </TableRow>
                          );
                        })}
                        {paddingBottom > 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }}
                            />
                          </TableRow>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {loading ? 'Cargando productos...' :
                        isFiltering ? 'Buscando productos...' :
                          'No hay productos disponibles'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Indicador de carga para infinite scroll */}
        {isLoadingMore && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Mensaje cuando no hay más productos */}
        {!hasMore && productosDisponibles.length > 0 && (
          <Box textAlign="center" p={2}>
            <Typography variant="body2" color="text.secondary">
              No hay más productos para cargar
            </Typography>
          </Box>
        )}

        {/* Mensaje cuando no se encuentran productos después de filtrar */}
        {!isLoadingMore && !loading && productosDisponibles.length === 0 && productos.length === 0 && (
          <Box textAlign="center" p={4}>
            <Alert severity="info" sx={{ maxWidth: 400, mx: 'auto' }}>
              <Typography variant="body2">
                No se encontraron productos con los filtros aplicados
              </Typography>
            </Alert>
          </Box>
        )}
      </div>
    )
  }
};

export default React.memo(TableProductosDisponibles);