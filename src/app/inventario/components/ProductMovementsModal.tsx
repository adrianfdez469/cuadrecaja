"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Chip,
  Alert,
  useTheme,
  useMediaQuery,
  Collapse,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import { IProductoTienda } from '@/types/IProducto';
import { IMovimiento, ITipoMovimiento } from '@/types/IMovimiento';
import { findMovimientos } from '@/services/movimientoService';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { isMovimientoBaja } from '@/utils/tipoMovimiento';
import { TIPOS_MOVIMIENTO, TIPO_MOVIMIENTO_LABELS } from '@/constants/movimientos';
import { formatDateTime } from '@/utils/formatters';

interface ProductMovementsModalProps {
  open: boolean;
  onClose: () => void;
  producto: IProductoTienda | null;
}

export const ProductMovementsModal: React.FC<ProductMovementsModalProps> = ({
  open,
  onClose,
  producto
}) => {
  const [movimientos, setMovimientos] = useState<IMovimiento[]>([]);
  const [filteredMovimientos, setFilteredMovimientos] = useState<IMovimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<ITipoMovimiento | ''>('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Cargar movimientos cuando se abre el modal
  useEffect(() => {
    if (open && producto) {
      fetchMovimientos();
      // En móvil, colapsar filtros por defecto
      setFiltersExpanded(!isMobile);
    }
  }, [open, producto, isMobile]);

  // Aplicar filtros cuando cambian los criterios
  useEffect(() => {
    applyFilters();
  }, [movimientos, startDate, endDate, selectedTipo]);

  const fetchMovimientos = async () => {
    if (!producto || !user?.localActual?.id) return;
    
    setLoading(true);
    try {
      const result = await findMovimientos(
        user.localActual.id,
        1000, // Obtener muchos registros
        0,
        producto.productoTiendaId, // productoTiendaId
      );
      setMovimientos(result || []);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
      showMessage('Error al cargar los movimientos del producto', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...movimientos];

    // Filtro por fecha
    if (startDate) {
      filtered = filtered.filter(mov => 
        dayjs(mov.fecha).isAfter(startDate.startOf('day')) || 
        dayjs(mov.fecha).isSame(startDate.startOf('day'))
      );
    }
    
    if (endDate) {
      filtered = filtered.filter(mov => 
        dayjs(mov.fecha).isBefore(endDate.endOf('day')) || 
        dayjs(mov.fecha).isSame(endDate.endOf('day'))
      );
    }

    // Filtro por tipo
    if (selectedTipo) {
      filtered = filtered.filter(mov => mov.tipo === selectedTipo);
    }

    setFilteredMovimientos(filtered);
  };

  const getRowColor = (tipo: ITipoMovimiento) => {
    if (isMovimientoBaja(tipo)) {
      return '#ffebee'; // Rojo suave (salmon)
    } else {
      return '#e8f5e8'; // Verde suave (bien clarito)
    }
  };

  const formatCantidad = (cantidad: number, tipo: ITipoMovimiento) => {
    const isNegative = isMovimientoBaja(tipo);
    return isNegative ? `-${cantidad}` : `+${cantidad}`;
  };

  const calcularExistenciaDespues = (existenciaAnterior: number | null | undefined, cantidad: number, tipo: ITipoMovimiento) => {
    if (existenciaAnterior === null || existenciaAnterior === undefined) return null;
    const isNegative = isMovimientoBaja(tipo);
    return isNegative ? existenciaAnterior - cantidad : existenciaAnterior + cantidad;
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedTipo('');
  };

  const hasActiveFilters = startDate || endDate || selectedTipo;

  if (!producto) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isMobile ? false : "lg"}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: { 
          minHeight: isMobile ? '100vh' : '80vh',
          m: isMobile ? 0 : undefined
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant={isMobile ? "h6" : "h6"} sx={{ 
            fontSize: isMobile ? '1.1rem' : undefined,
            pr: 1
          }}>
            Movimientos de: {producto.nombre}
          </Typography>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: isMobile ? 1 : 3 }}>
        {/* Sección de filtros */}
        <Box mb={2}>
          {/* Header de filtros con botón para colapsar en móvil */}
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center"
            sx={{ 
              p: isMobile ? 1 : 2, 
              bgcolor: "grey.50", 
              borderRadius: 1,
              cursor: isMobile ? 'pointer' : 'default'
            }}
            onClick={isMobile ? () => setFiltersExpanded(!filtersExpanded) : undefined}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <FilterListIcon fontSize="small" />
              <Typography variant="subtitle1">
                Filtros
              </Typography>
              {hasActiveFilters && (
                <Chip 
                  label={filteredMovimientos.length} 
                  size="small" 
                  color="primary" 
                />
              )}
            </Box>
            
            {isMobile && (
              <IconButton size="small">
                {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
          
          {/* Contenido de filtros */}
          <Collapse in={filtersExpanded || !isMobile}>
            <Box sx={{ p: isMobile ? 1 : 2, bgcolor: "grey.50", borderRadius: 1, mt: isMobile ? 0 : 0 }}>
              <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="Fecha inicio"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true
                      }
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="Fecha fin"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true
                      }
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={8} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo de movimiento</InputLabel>
                    <Select
                      value={selectedTipo}
                      onChange={(e) => setSelectedTipo(e.target.value as ITipoMovimiento | '')}
                      label="Tipo de movimiento"
                    >
                      <MenuItem value="">Todos los tipos</MenuItem>
                      {TIPOS_MOVIMIENTO.map((tipo) => (
                        <MenuItem key={tipo} value={tipo}>
                          {TIPO_MOVIMIENTO_LABELS[tipo]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={4} md={2}>
                  <Box display="flex" flexDirection={isMobile ? "row" : "column"} gap={1} justifyContent={isMobile ? "space-between" : "flex-start"}>
                    <Chip
                      label={`${filteredMovimientos.length} registros`}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                    {hasActiveFilters && (
                      <Button
                        size="small"
                        color="secondary"
                        onClick={clearFilters}
                        sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                      >
                        Limpiar
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Box>

        {/* Tabla de movimientos */}
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : filteredMovimientos.length === 0 ? (
          <Alert severity="info">
            {movimientos.length === 0 
              ? "Este producto no tiene movimientos registrados"
              : "No hay movimientos que coincidan con los filtros aplicados"
            }
          </Alert>
        ) : (
          <TableContainer 
            component={Paper} 
            sx={{ 
              maxHeight: isMobile ? 'calc(100vh - 280px)' : 500,
              '& .MuiTableCell-root': {
                fontSize: isMobile ? '0.875rem' : undefined,
                padding: isMobile ? '8px' : undefined
              }
            }}
          >
            <Table stickyHeader size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Fecha</strong></TableCell>
                  <TableCell><strong>Tipo</strong></TableCell>
                  <TableCell align="center"><strong>Cantidad</strong></TableCell>
                  {!isMobile && <TableCell align="center"><strong>Existencia Anterior</strong></TableCell>}
                  {isMobile && <TableCell align="center"><strong>Anterior → Posterior</strong></TableCell>}
                  {!isMobile && <TableCell><strong>Observaciones</strong></TableCell>}
                  {!isMobile && <TableCell><strong>Usuario</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMovimientos.map((movimiento, index) => {
                  const existenciaDespues = calcularExistenciaDespues(
                    movimiento.existenciaAnterior, 
                    movimiento.cantidad, 
                    movimiento.tipo
                  );
                  
                  return (
                    <TableRow
                      key={`${movimiento.id}-${index}`}
                      sx={{
                        backgroundColor: getRowColor(movimiento.tipo),
                        '&:hover': {
                          opacity: 0.8
                        }
                      }}
                    >
                      <TableCell>
                        {formatDateTime(movimiento.fecha)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={TIPO_MOVIMIENTO_LABELS[movimiento.tipo]}
                          size="small"
                          color={isMovimientoBaja(movimiento.tipo) ? "error" : "success"}
                          variant="outlined"
                          sx={{ fontSize: isMobile ? '0.7rem' : undefined }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          fontWeight="bold"
                          color={isMovimientoBaja(movimiento.tipo) ? "error.main" : "success.main"}
                          fontSize={isMobile ? '0.875rem' : undefined}
                        >
                          {formatCantidad(movimiento.cantidad, movimiento.tipo)}
                        </Typography>
                      </TableCell>
                      {!isMobile && (
                        <TableCell align="center">
                          <Typography
                            color="text.secondary"
                            fontSize="0.875rem"
                          >
                            {movimiento.existenciaAnterior !== null && movimiento.existenciaAnterior !== undefined 
                              ? movimiento.existenciaAnterior 
                              : '-'
                            }
                          </Typography>
                        </TableCell>
                      )}
                      {isMobile && (
                        <TableCell align="center">
                          <Typography
                            fontSize="0.75rem"
                            color="text.secondary"
                          >
                            {movimiento.existenciaAnterior !== null && movimiento.existenciaAnterior !== undefined && existenciaDespues !== null
                              ? `${movimiento.existenciaAnterior} → ${existenciaDespues}`
                              : '-'
                            }
                          </Typography>
                        </TableCell>
                      )}
                      {!isMobile && (
                        <TableCell>
                          {movimiento.motivo || '-'}
                        </TableCell>
                      )}
                      {!isMobile && (
                        <TableCell>
                          {movimiento.usuario?.nombre || 'Sistema'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}; 