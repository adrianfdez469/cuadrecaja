"use client";

import React, { useState, useEffect } from "react";
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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { IMovimiento, ITipoMovimiento } from "@/schemas/movimiento";
import { findMovimientos } from "@/services/movimientoService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import {
  TIPOS_MOVIMIENTO,
  TIPO_MOVIMIENTO_LABELS,
} from "@/constants/movimientos";
import { formatDateTime, formatMovimientoMotivo } from "@/utils/formatters";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { MovimientoCantidad } from "@/components/movimientos/MovimientoCantidad";
import { MovimientoTipoChip } from "@/components/movimientos/MovimientoTipoChip";
import { MovimientosMobileList } from "@/components/movimientos/MovimientosMobileList";

/**
 * Placeholder for a table cell with nothing in it. A blank cell inside a grid
 * reads as a render failure; on a card the missing line is the signal instead.
 */
const EMPTY_CELL = "—";

interface ProductMovementsModalProps {
  open: boolean;
  onClose: () => void;
  producto: IProductoTiendaV2 | null;
}

export const ProductMovementsModal: React.FC<ProductMovementsModalProps> = ({
  open,
  onClose,
  producto,
}) => {
  const [movimientos, setMovimientos] = useState<IMovimiento[]>([]);
  const [filteredMovimientos, setFilteredMovimientos] = useState<IMovimiento[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<ITipoMovimiento | "">("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const { user } = useAppContext();
  const { showMessage } = useMessageContext();

  const theme = useTheme();
  /**
   * Cards or table — the same threshold `/movimientos` uses, so "mobile" means
   * the same thing in both files. It used to be `md` here, which handed a
   * 700px tablet the cramped version while the general list, at that very
   * width, showed the full table.
   */
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  /**
   * The dialog frame only. Between 600 and 900px is where the six-column table
   * runs tightest, and giving up the dialog's margins is exactly what buys it
   * back the width.
   */
  const isFullScreen = useMediaQuery(theme.breakpoints.down("md"));

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
        producto.id, // productoTiendaId
      );
      setMovimientos(result?.data || []);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      showMessage("Error al cargar los movimientos del producto", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...movimientos];

    // Filtro por fecha
    if (startDate) {
      filtered = filtered.filter(
        (mov) =>
          dayjs(mov.fecha).isAfter(startDate.startOf("day")) ||
          dayjs(mov.fecha).isSame(startDate.startOf("day")),
      );
    }

    if (endDate) {
      filtered = filtered.filter(
        (mov) =>
          dayjs(mov.fecha).isBefore(endDate.endOf("day")) ||
          dayjs(mov.fecha).isSame(endDate.endOf("day")),
      );
    }

    // Filtro por tipo
    if (selectedTipo) {
      filtered = filtered.filter((mov) => mov.tipo === selectedTipo);
    }

    setFilteredMovimientos(filtered);
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedTipo("");
  };

  const hasActiveFilters = Boolean(startDate || endDate || selectedTipo);

  if (!producto) return null;

  /**
   * Loading, empty and no-results, in that order. The first two used to be one
   * `Alert` apiece, which told a store with no history and a filter that
   * matched nothing exactly the same thing — and they call for opposite moves:
   * one is fixed by registering movements, the other by dropping a filter.
   */
  const renderMovimientos = () => {
    if (loading) {
      return isMobile ? (
        <LoadingState variant="cards" count={4} />
      ) : (
        <LoadingState variant="table" columns={5} count={6} />
      );
    }

    if (filteredMovimientos.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          variant="no-results"
          title="Ningún movimiento coincide con los filtros"
          description="Probá con otro rango de fechas o quitá el filtro de tipo."
          action={{ label: "Limpiar filtros", onClick: clearFilters }}
        />
      ) : (
        <EmptyState
          title="Este producto no tiene movimientos registrados"
          description="Se registran solos con cada venta, ajuste, compra o traspaso de este producto."
        />
      );
    }

    if (isMobile) {
      // The product name is already in the dialog title: repeating it on every
      // card pushes down the only data that changes between them.
      return (
        <MovimientosMobileList
          movimientos={filteredMovimientos}
          hideProductName
        />
      );
    }

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Fecha</strong>
              </TableCell>
              <TableCell>
                <strong>Tipo</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Cantidad</strong>
              </TableCell>
              <TableCell>
                <strong>Observaciones</strong>
              </TableCell>
              <TableCell>
                <strong>Usuario</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMovimientos.map((movimiento, index) => (
              <TableRow key={`${movimiento.id}-${index}`}>
                <TableCell>{formatDateTime(movimiento.fecha)}</TableCell>
                <TableCell>
                  <MovimientoTipoChip tipo={movimiento.tipo} />
                </TableCell>
                <TableCell align="center">
                  <MovimientoCantidad movimiento={movimiento} size="table" />
                </TableCell>
                <TableCell>
                  {formatMovimientoMotivo(movimiento.motivo) || EMPTY_CELL}
                </TableCell>
                <TableCell>{movimiento.usuario?.nombre || "Sistema"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isFullScreen ? false : "lg"}
      fullWidth
      fullScreen={isFullScreen}
      PaperProps={{
        sx: {
          minHeight: isFullScreen ? "100vh" : "80vh",
          m: isFullScreen ? 0 : undefined,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ pr: 1 }}>
            Movimientos de: {producto.producto.nombre}
          </Typography>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* On phones the card list brings its own padding: adding the dialog's on
          top would make the card narrower here than on /movimientos. */}
      <DialogContent sx={{ p: isMobile ? 0 : 3 }}>
        {/* Sección de filtros */}
        <Box mb={2}>
          {/* Header de filtros con botón para colapsar en móvil */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              p: isMobile ? 1.5 : 2,
              bgcolor: "grey.50",
              borderRadius: isMobile ? 0 : 1,
              cursor: isMobile ? "pointer" : "default",
            }}
            onClick={
              isMobile ? () => setFiltersExpanded(!filtersExpanded) : undefined
            }
          >
            <Box display="flex" alignItems="center" gap={1}>
              <FilterListIcon fontSize="small" />
              <Typography variant="subtitle1">Filtros</Typography>
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
            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                bgcolor: "grey.50",
                borderRadius: isMobile ? 0 : 1,
              }}
            >
              <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="Fecha inicio"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                      },
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
                        size: "small",
                        fullWidth: true,
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={8} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo de movimiento</InputLabel>
                    <Select
                      value={selectedTipo}
                      onChange={(e) =>
                        setSelectedTipo(e.target.value as ITipoMovimiento | "")
                      }
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
                  <Box
                    display="flex"
                    flexDirection={isMobile ? "row" : "column"}
                    gap={1}
                    justifyContent={isMobile ? "space-between" : "flex-start"}
                  >
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
                        sx={{ minWidth: "auto", fontSize: "0.75rem" }}
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

        {renderMovimientos()}
      </DialogContent>
    </Dialog>
  );
};
