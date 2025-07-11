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
  Divider
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
  ExpandLess
} from "@mui/icons-material";
import { AddMovimientoDialog } from "./components/addMovimientoDialog";
import { IProducto } from "@/types/IProducto";
import { fetchProducts } from "@/services/productServise";
import { useAppContext } from "@/context/AppContext";
import { findMovimientos } from "@/services/movimientoService";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { ITipoMovimiento } from "@/types/IMovimiento";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatNumber, formatDateTime } from '@/utils/formatters';

const PAGE_SIZE = 20;

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loadingContext } = useAppContext();
  const [loadingData, setLoadingData] = useState(true);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [skip, setSkip] = useState(0);

  const fetchMovimientos = async (nuevoSkip = skip) => {
    try {
      const tiendaId = user.localActual.id;
      const result = await findMovimientos(tiendaId, PAGE_SIZE, nuevoSkip);
      setMovimientos(result || []);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      setMovimientos([]);
    }
  };

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
          const prods = await fetchProducts();
          setProductos(prods || []);
          await fetchMovimientos(0);
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
    fetchMovimientos(0);
  };

  const handleAnterior = () => {
    const nuevoSkip = Math.max(skip - PAGE_SIZE, 0);
    setSkip(nuevoSkip);
    fetchMovimientos(nuevoSkip);
  };

  const handleSiguiente = () => {
    const nuevoSkip = skip + PAGE_SIZE;
    setSkip(nuevoSkip);
    fetchMovimientos(nuevoSkip);
  };

  const filteredMovimientos = movimientos.filter((movimiento) =>
    movimiento.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movimiento.productoTienda?.producto?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movimiento.usuario?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalMovimientos = movimientos.length;
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
    console.log('Importar Excel');
    
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
      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => setDialogOpen(true)}
        size={isMobile ? "small" : "medium"}
        fullWidth={isMobile}
      >
        {isMobile ? "Crear" : "Crear Movimiento"}
      </Button>
      {(filteredMovimientos.length === 0 && !searchTerm) &&
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
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar movimiento..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: isMobile ? 160 : 250,
              maxWidth: isMobile ? 200 : 'none'
            }}
          />
        }
        noPadding
        fullHeight
      >
        {filteredMovimientos.length === 0 ? (
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
              {filteredMovimientos.map((movimiento, i) => (
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
                          {/* {movimiento.productoTienda?.producto?.nombre || 'Producto no encontrado'} */}
                          {movimiento.productoTienda?.proveedor?.nombre ? `${movimiento.productoTienda?.producto?.nombre} - ${movimiento.productoTienda?.proveedor?.nombre}` : movimiento.productoTienda?.producto?.nombre}
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
                {filteredMovimientos.map((movimiento, i) => (
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
                        {movimiento.productoTienda?.producto?.nombre || 'Producto no encontrado'}
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
        {filteredMovimientos.length > 0 && (
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
                Mostrando {skip + 1} - {Math.min(skip + PAGE_SIZE, skip + filteredMovimientos.length)}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSiguiente}
                disabled={filteredMovimientos.length < PAGE_SIZE}
              >
                Siguiente
              </Button>
            </Stack>
          </Box>
        )}
      </ContentCard>

      {/* Dialog para crear movimiento */}
      <AddMovimientoDialog
        dialogOpen={dialogOpen}
        productos={productos}
        closeDialog={() => setDialogOpen(false)}
        fetchMovimientos={fetchMovimientos}
      />
    </PageContainer>
  );
}
