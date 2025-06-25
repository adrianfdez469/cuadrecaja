"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Alert,
  Button,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
  Divider
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Receipt,
  AttachMoney,
  TrendingUp,
  CalendarToday,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  Visibility
} from "@mui/icons-material";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierrePeriodo } from "@/types/ICierre";
import { IVenta } from "@/types/IVenta";
import useConfirmDialog from "@/components/confirmDialog";
import { getSells, removeSell } from "@/services/sellService";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import VentaDetailDialog from "./components/VentaDetailDialog";

const Ventas = () => {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ventas, setVentas] = useState<IVenta[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [noPeriodFound, setNoPeriodFound] = useState(false);
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<IVenta | null>(null);

  const handleCreateFirstPeriod = async () => {
    try {
      setIsDataLoading(true);
      const tiendaId = user.tiendaActual.id;
      await openPeriod(tiendaId);
      await loadData();
      showMessage("Primer período creado exitosamente", "success");
    } catch (error) {
      console.log(error);
      showMessage("Error al crear el primer período", "error");
    }
  };

  const loadData = async () => {
    setIsDataLoading(true);
    setNoPeriodFound(false);
    setNoTiendaActual(false);
    
    try {
      if (!user.tiendaActual || !user.tiendaActual.id) {
        setNoTiendaActual(true);
        return;
      }

      const tiendaId = user.tiendaActual.id;
      const currentPeriod = await fetchLastPeriod(tiendaId);
      
      if (!currentPeriod) {
        setNoPeriodFound(true);
        return;
      }
      
      setCurrentPeriod(currentPeriod);

      const data = await getSells(tiendaId, currentPeriod.id);
      setVentas(data || []);
    } catch (error) {
      console.log(error);
      showMessage("Error: los datos de ventas no pudieron ser cargados", "error");
      setVentas([]);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleOpenVenta = (venta: IVenta) => {
    setSelectedVenta(venta);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedVenta(null);
  };

  const handleCancelVenta = async (venta: IVenta) => {
    confirmDialog(
      "¿Está seguro que desea eliminar completamente esta venta?",
      async () => {
        try {
          const tiendaId = user.tiendaActual.id;
          await removeSell(tiendaId, currentPeriod.id, venta.id, user.id);
          showMessage("La venta fue eliminada satisfactoriamente", 'success');
        } catch (error) {
          console.log(error);
          showMessage("La venta no pudo ser eliminada", 'error');
        } finally {
          loadData();
          handleCloseDetail();
        }
      }
    );
  };

  useEffect(() => {
    if (!loadingContext) {
      loadData();
    }
  }, [loadingContext]);

  const filteredVentas = ventas.filter((venta) => {
    const searchLower = searchTerm.toLowerCase();
    const ventaId = venta.id?.toLowerCase() || '';
    const ventaDate = new Date(venta.createdAt).toLocaleDateString().toLowerCase();
    const ventaTime = new Date(venta.createdAt).toLocaleTimeString().toLowerCase();
    
    return ventaId.includes(searchLower) || 
           ventaDate.includes(searchLower) || 
           ventaTime.includes(searchLower);
  });

  // Cálculos para estadísticas
  const totalVentas = ventas.length;
  const montoTotal = ventas.reduce((sum, venta) => sum + (venta.total || 0), 0);
  
  const ventasHoy = ventas.filter(v => {
    const today = new Date().toDateString();
    const ventaDate = new Date(v.createdAt).toDateString();
    return today === ventaDate;
  }).length;
  
  const montoHoy = ventas.filter(v => {
    const today = new Date().toDateString();
    const ventaDate = new Date(v.createdAt).toDateString();
    return today === ventaDate;
  }).reduce((sum, venta) => sum + (venta.total || 0), 0);

  if (loadingContext || isDataLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando ventas...
        </Typography>
      </Box>
    );
  }

  if (noTiendaActual) {
    return (
      <PageContainer
        title="Ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas' }
        ]}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar las ventas, necesitas tener una tienda seleccionada como tienda actual.
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

  if (noPeriodFound) {
    return (
      <PageContainer
        title="Ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas' }
        ]}
      >
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ¡Bienvenido a tu nuevo negocio!
          </Typography>
          <Typography variant="body1" gutterBottom>
            No se encontraron períodos de cierre. Para comenzar a registrar ventas 
            necesitas crear tu primer período de cierre.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Una vez creado el período, podrás realizar ventas desde el POS y revisarlas aquí.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCreateFirstPeriod}
          disabled={isDataLoading}
        >
          Crear Primer Período
        </Button>
      </PageContainer>
    );
  }

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar ventas">
        <IconButton onClick={loadData} disabled={isDataLoading} size="small">
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
            {React.cloneElement(icon as React.ReactElement, { 
              fontSize: isMobile ? "small" : "large" 
            } as any)}
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

  return (
    <PageContainer
      title={`Ventas - Período ${currentPeriod ? new Date(currentPeriod.fechaInicio).toLocaleDateString() : ''}`}
      subtitle={!isMobile ? "Historial de ventas del período actual" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de ventas */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<Receipt />}
                  value={totalVentas.toLocaleString()}
                  label="Ventas"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<AttachMoney />}
                  value={`$${montoTotal.toLocaleString()}`}
                  label="Total"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<TrendingUp />}
                  value={ventasHoy.toLocaleString()}
                  label="Hoy"
                  color="info.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<CalendarToday />}
                  value={`$${montoHoy.toLocaleString()}`}
                  label="Hoy $"
                  color="warning.light"
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
              icon={<Receipt />}
              value={totalVentas.toLocaleString()}
              label="Total Ventas"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<AttachMoney />}
              value={`$${montoTotal.toLocaleString()}`}
              label="Monto Total"
              color="success.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<TrendingUp />}
              value={ventasHoy.toLocaleString()}
              label="Ventas Hoy"
              color="info.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<CalendarToday />}
              value={`$${montoHoy.toLocaleString()}`}
              label="Monto Hoy"
              color="warning.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de ventas */}
      <ContentCard 
        title="Historial de Ventas"
        subtitle={!isMobile ? "Haz clic en cualquier venta para ver los detalles" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar venta..."}
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
        {filteredVentas.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {searchTerm ? 'No se encontraron ventas' : 'No hay ventas registradas en este período'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Las ventas aparecerán aquí cuando:'}
              </Typography>
              {!searchTerm && (
                <Typography variant="body2" component="div">
                  • Se realicen ventas desde el POS<br/>
                  • Se procesen transacciones<br/>
                  • Se registren pagos de clientes
                </Typography>
              )}
            </Alert>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredVentas.map((venta) => (
                <Card 
                  key={venta.id}
                  onClick={() => handleOpenVenta(venta)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                          Venta #{venta.id.slice(-8)}
                        </Typography>
                        <Chip 
                          label={`$${venta.total.toLocaleString()}`} 
                          color="success" 
                          size="small" 
                          variant="filled"
                          sx={{ height: 20 }}
                        />
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            {new Date(venta.createdAt).toLocaleDateString()} • {new Date(venta.createdAt).toLocaleTimeString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {venta.productos?.length || 0} productos
                          </Typography>
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelVenta(venta);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
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
                  <TableCell>ID Venta</TableCell>
                  <TableCell align="center">Fecha</TableCell>
                  {!isTablet && <TableCell align="center">Hora</TableCell>}
                  <TableCell align="right">Monto Total</TableCell>
                  <TableCell align="center">Productos</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVentas.map((venta) => (
                  <TableRow 
                    key={venta.id}
                    onClick={() => handleOpenVenta(venta)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                      '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        #{venta.id.slice(-8)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {new Date(venta.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    {!isTablet && (
                      <TableCell align="center">
                        <Typography variant="body2">
                          {new Date(venta.createdAt).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Chip 
                        label={`$${venta.total.toLocaleString()}`} 
                        color="success" 
                        size="small" 
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {venta.productos?.length || 0}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Ver detalles">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVenta(venta);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar venta">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelVenta(venta);
                            }}
                            size="small"
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Diálogo de detalles de venta */}
      <VentaDetailDialog
        open={detailDialogOpen}
        onClose={handleCloseDetail}
        venta={selectedVenta}
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
};

export default Ventas;
