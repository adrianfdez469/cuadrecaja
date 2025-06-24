import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  InputAdornment,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Collapse,
  Card,
  CardContent,
  Skeleton,
  TableSortLabel,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Button,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

// Tipos para la configuración de columnas
export interface DataTableColumn<T = any> {
  id: keyof T | string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: Array<{ value: any; label: string }>;
  responsive?: 'always' | 'desktop' | 'mobile' | 'never';
  sticky?: boolean;
}

// Tipos para las acciones de fila
export interface DataTableAction<T = any> {
  icon: React.ReactNode;
  label: string;
  onClick: (row: T) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
}

// Tipos para filtros
export interface DataTableFilter {
  id: string;
  value: any;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

// Props principales del componente
export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  error?: string | null;
  title?: string;
  actions?: DataTableAction<T>[];
  onRefresh?: () => void;
  onExport?: () => void;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  onRowClick?: (row: T) => void;
  rowKey?: keyof T | ((row: T) => string | number);
  expandableRows?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  dense?: boolean;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selectedRows: T[]) => void;
  customToolbar?: React.ReactNode;
  noDataIllustration?: React.ReactNode;
}

// Componente principal
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  title,
  actions = [],
  onRefresh,
  onExport,
  searchable = true,
  filterable = false,
  sortable = true,
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  emptyMessage = "No hay datos disponibles",
  stickyHeader = true,
  maxHeight = 600,
  onRowClick,
  rowKey = 'id',
  expandableRows = false,
  renderExpandedRow,
  dense = false,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  customToolbar,
  noDataIllustration
}: DataTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Estados locales
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<DataTableFilter[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // Función para obtener la clave única de una fila
  const getRowKey = useCallback((row: T): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    return row[rowKey] as string | number;
  }, [rowKey]);

  // Filtrado y búsqueda
  const filteredData = useMemo(() => {
    let result = [...data];

    // Aplicar búsqueda
    if (searchTerm && searchable) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(row =>
        columns.some(column => {
          const value = row[column.id];
          return value && value.toString().toLowerCase().includes(searchLower);
        })
      );
    }

    // Aplicar filtros
    filters.forEach(filter => {
      result = result.filter(row => {
        const value = row[filter.id];
        if (value == null) return false;

        switch (filter.operator || 'contains') {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return value.toString().toLowerCase().includes(filter.value.toLowerCase());
          case 'startsWith':
            return value.toString().toLowerCase().startsWith(filter.value.toLowerCase());
          case 'endsWith':
            return value.toString().toLowerCase().endsWith(filter.value.toLowerCase());
          case 'gt':
            return Number(value) > Number(filter.value);
          case 'lt':
            return Number(value) < Number(filter.value);
          case 'gte':
            return Number(value) >= Number(filter.value);
          case 'lte':
            return Number(value) <= Number(filter.value);
          default:
            return true;
        }
      });
    });

    return result;
  }, [data, searchTerm, filters, columns, searchable]);

  // Ordenamiento
  const sortedData = useMemo(() => {
    if (!sortBy || !sortable) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sortBy, sortDirection, sortable]);

  // Paginación
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = page * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage, pagination]);

  // Columnas visibles según el dispositivo
  const visibleColumns = useMemo(() => {
    return columns.filter(column => {
      if (!column.responsive) return true;
      if (column.responsive === 'always') return true;
      if (column.responsive === 'never') return false;
      if (column.responsive === 'desktop' && isMobile) return false;
      if (column.responsive === 'mobile' && !isMobile) return false;
      return true;
    });
  }, [columns, isMobile]);

  // Handlers
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;
    
    if (sortBy === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortDirection('asc');
    }
  }, [sortBy, sortDirection, sortable]);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleExpandRow = useCallback((rowKey: string | number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowKey)) {
      newExpanded.delete(rowKey);
    } else {
      newExpanded.add(rowKey);
    }
    setExpandedRows(newExpanded);
  }, [expandedRows]);

  const handleClearFilters = useCallback(() => {
    setFilters([]);
    setSearchTerm('');
    setPage(0);
  }, []);

  // Componente de loading skeleton
  const LoadingSkeleton = () => (
    <TableBody>
      {Array.from({ length: rowsPerPage }).map((_, index) => (
        <TableRow key={index}>
          {visibleColumns.map((column, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton variant="text" width="80%" />
            </TableCell>
          ))}
          {actions.length > 0 && (
            <TableCell>
              <Skeleton variant="circular" width={40} height={40} />
            </TableCell>
          )}
        </TableRow>
      ))}
    </TableBody>
  );

  // Componente de fila vacía
  const EmptyState = () => (
    <TableRow>
      <TableCell colSpan={visibleColumns.length + (actions.length > 0 ? 1 : 0)} align="center">
        <Box py={6}>
          {noDataIllustration || (
            <Box mb={2}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {emptyMessage}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm || filters.length > 0 
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "No hay información para mostrar en este momento"
                }
              </Typography>
            </Box>
          )}
          {(searchTerm || filters.length > 0) && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              size="small"
            >
              Limpiar filtros
            </Button>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );

  // Renderizado principal
  return (
    <Paper elevation={1} sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Header con título y controles */}
      <Box p={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          {title && (
            <Typography variant="h6" component="h2" fontWeight={600}>
              {title}
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            {onRefresh && (
              <Tooltip title="Actualizar datos">
                <IconButton onClick={onRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            {onExport && (
              <Tooltip title="Exportar datos">
                <IconButton onClick={onExport} size="small">
                  <ExportIcon />
                </IconButton>
              </Tooltip>
            )}
            {filterable && (
              <Tooltip title="Filtros">
                <IconButton 
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                  size="small"
                  color={filters.length > 0 ? 'primary' : 'default'}
                >
                  <FilterIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        {/* Barra de búsqueda */}
        {searchable && (
          <Box display="flex" gap={1} alignItems="flex-start" mb={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1 }}
            />
            {/* Toolbar personalizado integrado al lado del buscador */}
            {customToolbar && (
              <Box sx={{ flexShrink: 0 }}>
                {customToolbar}
              </Box>
            )}
          </Box>
        )}

        {/* Toolbar personalizado solo si no hay buscador */}
        {!searchable && customToolbar && (
          <Box mb={2}>
            {customToolbar}
          </Box>
        )}

        {/* Indicadores de filtros activos */}
        {(searchTerm || filters.length > 0) && (
          <Box mb={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {searchTerm && (
                <Chip
                  label={`Búsqueda: "${searchTerm}"`}
                  onDelete={() => setSearchTerm('')}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {filters.map((filter, index) => (
                <Chip
                  key={index}
                  label={`${filter.id}: ${filter.value}`}
                  onDelete={() => setFilters(filters.filter((_, i) => i !== index))}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      {/* Manejo de errores */}
      {error && (
        <Box p={2}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Tabla principal */}
      <TableContainer sx={{ maxHeight: maxHeight }}>
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {expandableRows && <TableCell padding="checkbox" />}
              {selectable && <TableCell padding="checkbox" />}
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.id as string}
                  align={column.align || 'left'}
                  style={{ 
                    minWidth: column.minWidth,
                    position: column.sticky ? 'sticky' : 'static',
                    left: column.sticky ? 0 : 'auto',
                    zIndex: column.sticky ? 2 : 1,
                  }}
                  sortDirection={sortBy === column.id ? sortDirection : false}
                >
                  {column.sortable !== false && sortable ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(column.id as string)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="center" style={{ minWidth: 120 }}>
                  Acciones
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          
          {loading ? (
            <LoadingSkeleton />
          ) : paginatedData.length === 0 ? (
            <TableBody>
              <EmptyState />
            </TableBody>
          ) : (
            <TableBody>
              {paginatedData.map((row) => {
                const key = getRowKey(row);
                const isExpanded = expandedRows.has(key);
                
                return (
                  <React.Fragment key={key}>
                    <TableRow
                      hover
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      sx={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        '&:hover': {
                          backgroundColor: onRowClick ? 'action.hover' : 'inherit',
                        },
                      }}
                    >
                      {expandableRows && (
                        <TableCell padding="checkbox">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExpandRow(key);
                            }}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                      )}
                      
                      {selectable && (
                        <TableCell padding="checkbox">
                          {/* Checkbox implementation would go here */}
                        </TableCell>
                      )}
                      
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={column.id as string}
                          align={column.align || 'left'}
                          style={{ 
                            position: column.sticky ? 'sticky' : 'static',
                            left: column.sticky ? 0 : 'auto',
                            zIndex: column.sticky ? 1 : 0,
                          }}
                        >
                          {column.format 
                            ? column.format(row[column.id], row)
                            : row[column.id]
                          }
                        </TableCell>
                      ))}
                      
                      {actions.length > 0 && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            {actions
                              .filter(action => !action.hidden?.(row))
                              .map((action, actionIndex) => (
                                <Tooltip key={actionIndex} title={action.label}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color={action.color || 'default'}
                                      disabled={action.disabled?.(row)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        action.onClick(row);
                                      }}
                                    >
                                      {action.icon}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ))
                            }
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                    
                    {expandableRows && renderExpandedRow && (
                      <TableRow>
                        <TableCell 
                          colSpan={visibleColumns.length + (actions.length > 0 ? 1 : 0) + 1}
                          sx={{ p: 0, border: 0 }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box p={2}>
                              {renderExpandedRow(row)}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          )}
        </Table>
      </TableContainer>

      {/* Paginación */}
      {pagination && !loading && (
        <TablePagination
          rowsPerPageOptions={pageSizeOptions}
          component="div"
          count={sortedData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      )}

      {/* Menú de filtros */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          <Typography variant="body2">Filtros avanzados próximamente</Typography>
        </MenuItem>
      </Menu>
    </Paper>
  );
} 