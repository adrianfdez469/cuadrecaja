"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Alert,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse,
  Divider,
  Badge
} from "@mui/material";
import {
  Add,
  Dock,
  TrendingUp,
  TrendingDown,
  SwapVert,
  Inventory,
  Search,
  Refresh,
  ExpandMore,
  Message,
  ExpandLess
} from "@mui/icons-material";
import { AddMovimientoDialog } from "./components/addMovimientoDialog";
import { useAppContext } from "@/context/AppContext";
import { cretateBatchMovimientos, findMovimientos, getMovimientosProductosEnviados } from "@/services/movimientoService";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { ITipoMovimiento } from "@/types/IMovimiento";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatNumber, formatDateTime } from '@/utils/formatters';
import ImportarExcelDialog from "./components/importExcelDialog";
import { OperacionTipo, ProductSelectionModal } from "@/components/ProductcSelectionModal/ProductSelectionModal";
import { useProductSelectionModal } from "@/hooks/useProductSelectionModal";
import { useMessageContext } from "@/context/MessageContext";

const PAGE_SIZE = 20;

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loadingContext } = useAppContext();
  const [loadingData, setLoadingData] = useState(true);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendienteRecepcion, setPendienteRecepcion] = useState([]);
  const { showMessage } = useMessageContext()
  
  // 🆕 Estados para paginación mejorada
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState(""); // 🆕 Valor del input no controlado
  
  const {
    isOpen: pendienteRecepcionDialogOpen,
    operacion: pendienteRecepcionOperacion,
    openModal: pendienteRecepcionOpenModal,
    closeModal: pendienteRecepcionCloseModal,
    handleConfirm: pendienteRecepcionHandleConfirm,
    setOnConfirm: pendienteRecepcionSetOnConfirm,

  } = useProductSelectionModal();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [skip, setSkip] = useState(0);

  // 🆕 Función mejorada para cargar movimientos con filtrado en backend
  const fetchMovimientos = async (nuevoSkip = skip, searchFilter = searchTerm) => {
    try {
      setLoadingData(true);
      const tiendaId = user.localActual.id;
      
      const result = await findMovimientos(
        tiendaId, 
        PAGE_SIZE, 
        nuevoSkip,
        undefined, // productoTiendaId
        undefined, // tipo
        undefined, // intervalo
        searchFilter // 🆕 Nuevo parámetro para búsqueda
      );
      
      setMovimientos(result?.data || []);
      setTotalMovimientos(result?.total || 0);
      setHasMoreData((result?.data?.length || 0) === PAGE_SIZE && (nuevoSkip + PAGE_SIZE) < (result?.total || 0));
      
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      setMovimientos([]);
      setTotalMovimientos(0);
      setHasMoreData(false);
    } finally {
      setLoadingData(false);
    }
  };

  // 🆕 Función para manejar búsqueda con botón filtrar
  const handleFilter = () => {
    setSearchTerm(searchInputValue);
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0, searchInputValue);
  };

  // 🆕 Función para limpiar búsqueda
  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchInputValue("");
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0, "");
  };

  // 🆕 Función para manejar cambio en el input (no controlado)
  const handleInputChange = (value: string) => {
    setSearchInputValue(value);
  };

  const fecthPendientesRecep = async () => {
    const result = await getMovimientosProductosEnviados(user.localActual.id);
    console.log('fecthPendientesRecep',result);
    
    setPendienteRecepcion(result || []);

    if(result.length > 0){
      pendienteRecepcionSetOnConfirm((prods) => {
        console.log('prods',prods);
        // Crear documento de tipo TRASPASO_ENTRADA con los productos
        crearMovimientosRecepción(prods);
      })
    }
  }

  const crearMovimientosRecepción = async (prods) => {
    setLoadingData(true);

    try {
      const localId = user.localActual.id;
      await cretateBatchMovimientos(
        {
          tiendaId: localId,
          tipo: "TRASPASO_ENTRADA",
          usuarioId: user.id,
        },
        prods.map((item) => {

          return {
            cantidad: item.cantidad,
            productoId: item.productoId,
            costoUnitario: item.costo,
            costoTotal: item.costoTotal,
            ...(item.proveedor && {proveedorId: item.proveedor.id}),
            movimientoOrigenId: item.movimientoOrigenId
          };
        })
      );

      fetchMovimientos(0);
      fecthPendientesRecep();

    } catch (error) {
      console.log(error);
      showMessage("No se pudo crear los movimientos de entrada", "error");
    } finally {
      setLoadingData(false);
    }
  }

  const loadPendientesRecep = async (operacion: OperacionTipo, take: number, skip: number, filter?: { categoriaId?: string, text?: string}) => {
    console.log(operacion, take, skip, filter);
    
    return pendienteRecepcion.map((item) => {
      return {
        productoId: item.productoTienda.productoId,
        nombre: item.productoTienda?.producto?.nombre,
        categoriaId: item.productoTienda?.producto?.categoriaId,
        categoria: item.productoTienda?.producto?.categoria,
        productoTiendaId: item.productoTiendaId,
        precio: item.productoTienda?.precio,
        costo: item.productoTienda?.costo,
        existencia: item.productoTienda?.existencia,
        proveedorId: item.productoTienda?.proveedorId,
        proveedor: item.productoTienda?.proveedor,
        
        movimientoOrigenId: item.movimientoOrigenId,
        codigosProducto: item.productoTienda?.producto?.codigosProducto
      }
    });
  }

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        try {
          setNoLocalActual(false);

          if (!user.localActual || !user.localActual.id) {
            setNoLocalActual(true);
            setLoadingData(false);
            return;
          }

          setSkip(0);
          setCurrentPage(0);
          await fetchMovimientos(0);
          fecthPendientesRecep(); // fetch pendientes de recepcion asincronico
        } catch (error) {
          console.error("Error al cargar datos:", error);
        } finally {
          setLoadingData(false);
        }
      }
    })();
  }, [loadingContext]);

  const handleInicio = () => {
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0);
  };

  const handleAnterior = () => {
    const nuevoSkip = Math.max(skip - PAGE_SIZE, 0);
    const nuevaPagina = Math.max(currentPage - 1, 0);
    setSkip(nuevoSkip);
    setCurrentPage(nuevaPagina);
    fetchMovimientos(nuevoSkip);
  };

  const handleSiguiente = () => {
    const nuevoSkip = skip + PAGE_SIZE;
    const nuevaPagina = currentPage + 1;
    setSkip(nuevoSkip);
    setCurrentPage(nuevaPagina);
    fetchMovimientos(nuevoSkip);
  };

  // Cálculos para estadísticas
  const movimientosEntrada = movimientos.filter(m => !isMovimientoBaja(m.tipo)).length;
  const movimientosSalida = movimientos.filter(m => isMovimientoBaja(m.tipo)).length;
  const productosAfectados = [...new Set(movimientos.map(m => m.productoTiendaId))].length;

  if (loadingContext || loadingData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando movimientos...
        </Typography>
      </Box>
    );
  }

  if (noLocalActual) {
    return (
      <PageContainer
        title="Movimientos de Stock"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Movimientos' }
        ]}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar los movimientos de stock, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              href="/configuracion/tiendas"
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
          </Box>
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Movimientos' }
  ];

  const handleImportExcel = () => {
    setImportDialogOpen(true);
  };

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar movimientos">
        <IconButton onClick={() => fetchMovimientos(skip)} disabled={loadingData} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {isMobile && (
        <Tooltip title={statsExpanded ? "Ocultar estadísticas" : "Mostrar estadísticas"}>
          <IconButton onClick={() => setStatsExpanded(!statsExpanded)} size="small">
            {statsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      )}
      
      {pendienteRecepcion.length > 0 &&
        <Tooltip title="Productos pendientes por recepcionar">
          <IconButton size="small" onClick={() => pendienteRecepcionOpenModal('ENTRADA')}>
            <Badge badgeContent={pendienteRecepcion.length} color="error">
              <Message />
            </Badge>
          </IconButton>
        </Tooltip>
      }


      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => setDialogOpen(true)}
        size={isMobile ? "small" : "medium"}
        fullWidth={isMobile}
      >
        {isMobile ? "Crear" : "Crear Movimiento"}
      </Button>
      {((movimientos.length === 0 && !searchTerm) || user.rol === 'SUPER_ADMIN') &&
        <Button
          variant="contained"
          startIcon={!isMobile ? <Dock /> : undefined}
          onClick={() => handleImportExcel()}
          size={isMobile ? "small" : "medium"}
          fullWidth={isMobile}
        >
          {isMobile ? "Importar" : "Importar Excel"}
        </Button>
      }
    </Stack>
  );

  // Componente de estadística móvil optimizado
  const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode, value: string, label: string, color: string }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1.5 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 0.75 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 32 : 48,
              minHeight: isMobile ? 32 : 48,
            }}
          >
            {React.isValidElement(icon)
              ? React.cloneElement(icon, {
                fontSize: isMobile ? "small" : "large"
              } as Record<string, unknown>)
              : icon
            }
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant={isMobile ? "subtitle1" : "h4"}
              fontWeight="bold"
              sx={{
                fontSize: isMobile ? '1rem' : '2rem',
                lineHeight: 1.2,
                wordBreak: 'break-all'
              }}
            >
              {value}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: isMobile ? '0.6875rem' : '0.875rem',
                lineHeight: 1.2
              }}
            >
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  const getMovimientoChip = (tipo: string) => {
    const isBaja = isMovimientoBaja(tipo as ITipoMovimiento);
    return (
      <Chip
        label={tipo}
        size="small"
        color={isBaja ? "error" : "success"}
        variant="filled"
        sx={{ fontWeight: 'medium' }}
      />
    );
  };

  return (
    <PageContainer
      title="Movimientos de Stock"
      subtitle={!isMobile ? "Historial de entradas y salidas de inventario" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de movimientos */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<SwapVert />}
                  value={formatNumber(totalMovimientos)}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<TrendingUp />}
                  value={formatNumber(movimientosEntrada)}
                  label="Entradas"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<TrendingDown />}
                  value={formatNumber(movimientosSalida)}
                  label="Salidas"
                  color="error.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Inventory />}
                  value={formatNumber(productosAfectados)}
                  label="Productos"
                  color="info.light"
                />
              </Grid>
            </Grid>
            <Divider sx={{ mb: 2 }} />
          </Collapse>
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<SwapVert />}
              value={formatNumber(totalMovimientos)}
              label="Total Movimientos"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<TrendingUp />}
              value={formatNumber(movimientosEntrada)}
              label="Entradas"
              color="success.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<TrendingDown />}
              value={formatNumber(movimientosSalida)}
              label="Salidas"
              color="error.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Inventory />}
              value={formatNumber(productosAfectados)}
              label="Productos"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de movimientos */}
      <ContentCard
        title="Historial de Movimientos"
        subtitle={!isMobile ? "Registro detallado de todas las transacciones de inventario" : undefined}
        headerActions={
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder={isMobile ? "Buscar..." : "Buscar movimiento..."}
              value={searchInputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleFilter();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: isMobile ? 120 : 200,
                maxWidth: isMobile ? 150 : 250
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleFilter}
              disabled={loadingData || !searchInputValue.trim()}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              {isMobile ? "Filtrar" : "Filtrar"}
            </Button>
            {(searchTerm || searchInputValue) && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearSearch}
                disabled={loadingData}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                {isMobile ? "Limpiar" : "Limpiar"}
              </Button>
            )}
          </Stack>
        }
        noPadding
        fullHeight
      >
        {movimientos.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {searchTerm ? 'No se encontraron movimientos' : 'No hay movimientos de stock registrados'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Los movimientos de stock se crean automáticamente cuando:'}
              </Typography>
              {!searchTerm && (
                <Typography variant="body2" component="div">
                  • Se realizan ventas desde el POS<br />
                  • Se agregan productos al inventario<br />
                  • Se realizan ajustes manuales<br />
                  • Se hacen traspasos entre tiendas
                </Typography>
              )}
              {!searchTerm && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {`También puedes crear movimientos manuales usando el botón \"Crear Movimiento\".`}
                </Typography>
              )}
            </Alert>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más compactas
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {movimientos.map((movimiento, i) => (
                <Card
                  key={i}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography
                          variant="subtitle2"
                          fontWeight="medium"
                          sx={{
                            flex: 1,
                            pr: 1,
                            fontSize: '0.875rem',
                            lineHeight: 1.2
                          }}
                        >
                          {movimiento.proveedor?.nombre
                            ? `${movimiento.productoTienda?.producto?.nombre} - ${movimiento.proveedor.nombre}`
                            : movimiento.productoTienda?.producto?.nombre || 'Producto no encontrado'}
                        </Typography>
                        {getMovimientoChip(movimiento.tipo)}
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={isMovimientoBaja(movimiento.tipo) ? 'error.main' : 'success.main'}
                            sx={{ fontSize: '0.8125rem' }}
                          >
                            {isMovimientoBaja(movimiento.tipo) ? '-' : '+'}{Math.abs(movimiento.cantidad)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            unidades
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          {formatDateTime(movimiento.fecha).split(' • ')[0]}
                        </Typography>
                      </Box>

                      {movimiento.usuario?.nombre && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          Por: {movimiento.usuario.nombre}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Producto</TableCell>
                  <TableCell align="center">Cantidad</TableCell>
                  {!isTablet && <TableCell>Usuario</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientos.map((movimiento, i) => (
                  <TableRow
                    key={i}
                    sx={{
                      '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(movimiento.fecha)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getMovimientoChip(movimiento.tipo)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {movimiento.proveedor?.nombre
                          ? `${movimiento.productoTienda?.producto?.nombre} - ${movimiento.proveedor.nombre}`
                          : movimiento.productoTienda?.producto?.nombre || 'Producto no encontrado'}

                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={isMovimientoBaja(movimiento.tipo) ? 'error.main' : 'success.main'}
                      >
                        {isMovimientoBaja(movimiento.tipo) ? '-' : '+'}{Math.abs(movimiento.cantidad)}
                      </Typography>
                    </TableCell>
                    {!isTablet && (
                      <TableCell>
                        <Typography variant="body2">
                          {movimiento.usuario?.nombre || 'Sistema'}
                        </Typography>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Paginación */}
        {movimientos.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Button
                variant="outlined"
                size="small"
                onClick={handleInicio}
                disabled={skip === 0}
              >
                Inicio
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAnterior}
                disabled={skip === 0}
              >
                Anterior
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                Mostrando {skip + 1} - {Math.min(skip + movimientos.length, totalMovimientos)} de {totalMovimientos} movimientos
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSiguiente}
                disabled={!hasMoreData}
              >
                Siguiente
              </Button>
            </Stack>
            {searchTerm && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
               {`Filtro activo: \"{searchTerm}\" - {movimientos.length} resultados encontrados`}
              </Typography>
            )}
          </Box>
        )}
      </ContentCard>

      {/* Dialog para crear movimiento */}
      <AddMovimientoDialog
        dialogOpen={dialogOpen}
        // productos={productos}
        closeDialog={() => setDialogOpen(false)}
        fetchMovimientos={fetchMovimientos}
      />
      <ImportarExcelDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => {
          fetchMovimientos(0);
        }}
      />
      {pendienteRecepcionDialogOpen && (
        <ProductSelectionModal
          open={pendienteRecepcionDialogOpen}
          onClose={pendienteRecepcionCloseModal}
          loadProductos={loadPendientesRecep}
          operacion={pendienteRecepcionOperacion}
          iTipoMovimiento={'TRASPASO_ENTRADA'}
          onConfirm={pendienteRecepcionHandleConfirm}
        />
      )}
    </PageContainer>
  );
}
