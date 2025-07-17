import { IProductoTiendaV2 } from "@/types/IProducto";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { Add, ExpandMore, ExpandLess, FilterList, Search, FilterAlt } from "@mui/icons-material";
import { Alert, Box, TableHead, Table, Paper, TableContainer, CircularProgress, TableRow, TableCell, TableBody, Typography, IconButton, Tooltip, Chip, Card, CardContent, Collapse, Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Button } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OperacionTipo } from "../ProductSelectionModal";
import { ICategory } from "@/types/ICategoria";
import { fetchCategories } from "@/services/categoryService";

interface IProps {
  operacion: OperacionTipo;
  loading: boolean;
  productos: IProductoTiendaV2[];
  productosDisponibles: IProductoTiendaV2[];
  isMobile: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreProductos: () => Promise<void>
  agregarProducto: (producto: IProductoTiendaV2) => void
  onFilterChange?: (filters: { text?: string, categoriaId?: string }) => void
  show: boolean
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
  show
}) => {

  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);
  const [categorias, setCategorias] = useState<ICategory[]>([]);
  
  // Refs para los inputs no controlados
  const filterTextRef = useRef<HTMLInputElement>(null);
  const filterCategoryRef = useRef<HTMLDivElement>(null);

  const useInfiniteScroll = (
    loadMore: () => Promise<void>,
    hasMore: boolean,
    loading: boolean
  ) => {
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });
      if (node) observer.current.observe(node);
    }, [loading, hasMore, loadMore]);

    return lastElementRef;
  };

  const lastElementRef = useInfiniteScroll(loadMoreProductos, hasMore, isLoadingMore);

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
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  } else if (productosDisponibles.length === 0 && show) {
    return (
      <Alert severity="info">
        {productos.length === 0
          ? "No hay productos disponibles que coincidan con los filtros"
          : "Todos los productos filtrados ya han sido seleccionados"
        }
      </Alert>
    );
  } else {
    return (
      <div style={{ display: show ? 'block' : 'none' }}>
        {/* Filtros */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight="medium">
                <FilterList fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                Filtros
              </Typography>
              <IconButton
                size="small"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              >
                {filtersExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={filtersExpanded}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Buscar por nombre o proveedor..."
                    inputRef={filterTextRef}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleApplyFilters();
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
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
                <Grid item xs={12} sm={4}>
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
            </Collapse>
          </CardContent>
        </Card>
        <TableContainer component={Paper} variant="outlined">
          <Table size={isMobile ? "small" : "medium"}>
            <TableHead>
              <TableRow>
                <TableCell align="center">Acción</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell align="center">Existencia</TableCell>
                <TableCell align="right">Costo</TableCell>
                <TableCell align="right">Precio</TableCell>
                <TableCell>Categoría</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>

              {productosDisponibles.map((producto, index) => {
                const isLast = index === productosDisponibles.length - 1;

                return (
                  <TableRow
                    key={producto.id}
                    hover
                    ref={isLast ? lastElementRef : undefined}
                  >
                    <TableCell align="center">
                      <Tooltip title="Agregar producto">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => agregarProducto(producto)}
                          disabled={operacion === 'SALIDA' && producto.existencia <= 0}
                        >
                          <Add />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {producto.producto.nombre}
                        </Typography>
                        {producto.proveedor && (
                          <Typography variant="caption" color="text.secondary">
                            {producto.proveedor.nombre}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={formatNumber(producto.existencia || 0)}
                        size="small"
                        color={producto.existencia <= 0 ? 'error' : producto.existencia <= 5 ? 'warning' : 'success'}
                        variant="filled"
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(producto.costo)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(producto.precio)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={producto.producto.categoria?.nombre || 'Sin categoría'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>

                  </TableRow>
                );
              })}

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
      </div>
    )
  }
};

export default React.memo(TableProductosDisponibles);