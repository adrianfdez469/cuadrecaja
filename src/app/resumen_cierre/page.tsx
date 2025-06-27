"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  TablePagination,
  Grid,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Alert,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  TextField,
  Tooltip,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { getResumenCierres } from "@/services/resumenCierreService";
import { useAppContext } from "@/context/AppContext";
import { ICierreData, ICierrePeriodo, ISummaryCierre } from "@/types/ICierre";
import { ITotales, TablaProductosCierre } from "@/components/tablaProductosCierre/intex";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { Close, AttachMoney, TrendingUp, Assessment, Refresh, FilterList } from "@mui/icons-material";
import { fetchCierreData } from "@/services/cierrePeriodService";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";

export default function ResumenCierrePage() {
  const [data, setData] = useState<ISummaryCierre>();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [totales, setTotales] = useState<{
    inversion: number;
    venta: number;
    ganancia: number;
    transf: number;
  }>({ inversion: 0, venta: 0, ganancia: 0, transf: 0 });
  const { user, loadingContext, gotToPath } = useAppContext();
  const [showProducts, setShowProducts] = useState(false);
  const [cierreProducData, setCierreProductData] = useState<{ciereData: ICierreData, totales: ITotales}>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const fetchData = async () => {
    setLoading(true);
    try {
      const tiendaId = user.tiendaActual.id;
      let dataResp;
      if (startDate || endDate) {
        const intervalo = {
          ...(startDate && { fechaInicio: startDate.toDate() }),
          ...(endDate && { fechaFin: endDate.toDate() }),
        };
        dataResp = await getResumenCierres(
          tiendaId,
          rowsPerPage,
          page * rowsPerPage,
          intervalo
        );
      } else {
        dataResp = await getResumenCierres(
          tiendaId,
          rowsPerPage,
          page * rowsPerPage
        );
      }
      setData(dataResp);
      setTotales(
        dataResp.cierres.reduce(
          (acc, row) => {
            acc.inversion += row.totalInversion;
            acc.venta += row.totalVentas;
            acc.ganancia += row.totalGanancia;
            acc.transf += row.totalTransferencia
            return acc;
          },
          { inversion: 0, venta: 0, ganancia: 0, transf: 0 }
        )
      );
    } catch (error) {
      console.error("Error al cargar resumen de cierres:", error);
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        setNoTiendaActual(false);
        
        // Validar que el usuario tenga una tienda actual
        if (!user.tiendaActual || !user.tiendaActual.id) {
          setNoTiendaActual(true);
          setLoading(false);
          return;
        }

        await fetchData();
      }
    })();
  }, [loadingContext, user, rowsPerPage, page, startDate, endDate]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleLimpiarFiltrod = () => {
    setStartDate(null);
    setEndDate(null);
    setPage(0);
  };

  const handleViewMore = async (itemCierre: Omit<ICierrePeriodo, "tienda">) => {
    const tiendaId = user.tiendaActual.id;
    const cierreData = await fetchCierreData(tiendaId, itemCierre.id);

    const totales = {
      totalCantidad: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.cantidad,
        0
      ),
      totalGanancia: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.ganancia,
        0
      ),
      totalMonto: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.total,
        0
      )
    };

    setCierreProductData({
      ciereData: {
        productosVendidos: cierreData.productosVendidos,
        totalGanancia: itemCierre.totalGanancia,
        totalVentas: itemCierre.totalVentas,
        totalTransferencia: itemCierre.totalTransferencia
      },
      totales: totales
    });
    setShowProducts(true);
  };

  // Componente de estadística móvil optimizado
  const StatCard = ({ icon, value, label, color }: { 
    icon: React.ReactNode, 
    value: string, 
    label: string, 
    color: string 
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1.5 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              fontWeight="bold"
              sx={{ 
                fontSize: isMobile ? '1.25rem' : '2rem',
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
                fontSize: isMobile ? '0.75rem' : '0.875rem',
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

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Resumen de Cierres' }
  ];

  const headerActions = (
    <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
      <Tooltip title="Actualizar datos">
        <IconButton onClick={fetchData} disabled={loading} size={isMobile ? "small" : "medium"}>
          <Refresh />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (loadingContext || loading) {
    return (
      <PageContainer
        title="Resumen de Cierres"
        subtitle="Análisis histórico de períodos cerrados"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando resumen de cierres...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (noTiendaActual) {
    return (
      <PageContainer
        title="Resumen de Cierres"
        subtitle="Análisis histórico de períodos cerrados"
        breadcrumbs={breadcrumbs}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver el resumen de cierres, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => gotToPath("/configuracion/tiendas")}
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
            <Button
              variant="outlined"
              onClick={() => gotToPath("/")}
            >
              Volver al Inicio
            </Button>
          </Box>
        </Alert>
      </PageContainer>
    );
  }

  if (!data || data.cierres.length === 0) {
    return (
      <PageContainer
        title="Resumen de Cierres"
        subtitle="Análisis histórico de períodos cerrados"
        breadcrumbs={breadcrumbs}
      >
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            No hay cierres históricos disponibles
          </Typography>
          <Typography variant="body1" gutterBottom>
            Una vez que realices tu primer cierre de caja, los resúmenes históricos 
            aparecerán aquí para que puedas analizar el desempeño de tu negocio.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {`Los cierres se realizan desde la sección "Cierre de Caja" cuando terminas 
            tu jornada de ventas.`}
          </Typography>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Resumen de Cierres"
      subtitle={!isMobile ? "Análisis histórico y estadísticas de períodos cerrados" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas generales */}
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<AttachMoney fontSize={isMobile ? "medium" : "large"} />}
            value={`$${totales.venta.toLocaleString()}`}
            label="Total Ventas"
            color="success.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<TrendingUp fontSize={isMobile ? "medium" : "large"} />}
            value={`$${totales.ganancia.toLocaleString()}`}
            label="Ganancia Total"
            color="info.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<Assessment fontSize={isMobile ? "medium" : "large"} />}
            value={`$${totales.inversion.toLocaleString()}`}
            label="Inversión Total"
            color="warning.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<AttachMoney fontSize={isMobile ? "medium" : "large"} />}
            value={`$${totales.transf.toLocaleString()}`}
            label="Transferencias"
            color="primary.light"
          />
        </Grid>
      </Grid>

      {/* Filtros */}
      <ContentCard 
        title="Filtros de Búsqueda"
        subtitle={!isMobile ? "Filtra los cierres por rango de fechas" : undefined}
        headerActions={
          <Tooltip title="Limpiar filtros">
            <IconButton onClick={handleLimpiarFiltrod} size={isMobile ? "small" : "medium"}>
              <FilterList />
            </IconButton>
          </Tooltip>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <DatePicker
              label="Fecha inicio"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              slotProps={{ textField: { fullWidth: true, size: isMobile ? "small" : "medium" } }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <DatePicker
              label="Fecha fin"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              slotProps={{ textField: { fullWidth: true, size: isMobile ? "small" : "medium" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              onClick={handleLimpiarFiltrod}
              sx={{ height: isMobile ? "40px" : "56px", width: "100%" }}
              size={isMobile ? "small" : "medium"}
            >
              Limpiar
            </Button>
          </Grid>
        </Grid>
      </ContentCard>

      {/* Tabla de cierres */}
      <ContentCard 
        title="Historial de Cierres"
        subtitle={!isMobile ? `${data.totalItems} períodos encontrados` : undefined}
        noPadding
        fullHeight
      >
        {isMobile ? (
          // Vista móvil con cards
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              {data.cierres.map((row) => (
                <Card 
                  key={row.id}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleViewMore(row)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="subtitle1" fontWeight="medium">
                          {dayjs(row.fechaInicio).format("DD/MM/YYYY")} - {row.fechaFin ? dayjs(row.fechaFin).format("DD/MM/YYYY") : "Actual"}
                        </Typography>
                        <IconButton size="small" color="primary">
                          <ZoomInIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Ventas
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            ${row.totalVentas.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Ganancia
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="info.main">
                            ${row.totalGanancia.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Inversión
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            ${row.totalInversion.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Transferencias
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            ${row.totalTransferencia.toLocaleString()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
            
            {/* Paginación móvil */}
            <Box sx={{ mt: 2 }}>
              <TablePagination
                component="div"
                count={data.totalItems}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 20, 50]}
                labelRowsPerPage="Filas por página:"
              />
            </Box>
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader size={isTablet ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell>Inicio</TableCell>
                  <TableCell>Fin</TableCell>
                  <TableCell align="right">Inversión</TableCell>
                  <TableCell align="right">Venta</TableCell>
                  <TableCell align="right">Transf</TableCell>
                  <TableCell align="right">Ganancia</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.cierres.map((row) => (
                  <TableRow 
                    key={row.id}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                      '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(row.fechaInicio).format("DD/MM/YYYY")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {row.fechaFin ? dayjs(row.fechaFin).format("DD/MM/YYYY") : "Actual"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ${row.totalInversion.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color="success.main">
                        ${row.totalVentas.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ${row.totalTransferencia.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color="info.main">
                        ${row.totalGanancia.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalles">
                        <IconButton
                          onClick={() => handleViewMore(row)}
                          color="primary"
                          size="small"
                        >
                          <ZoomInIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Fila de totales */}
                <TableRow sx={{ bgcolor: 'action.hover', fontWeight: 'bold' }}>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" fontWeight="bold">
                      Totales
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ${totales.inversion.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ${totales.venta.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ${totales.transf.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="info.main">
                      ${totales.ganancia.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            {/* Paginación desktop */}
            <TablePagination
              component="div"
              count={data.totalItems}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Filas por página:"
            />
          </TableContainer>
        )}
      </ContentCard>

      {/* Modal de productos */}
      {cierreProducData && (
        <Drawer
          anchor="bottom"
          open={showProducts}
          onClose={() => setShowProducts(false)}
          PaperProps={{
            sx: {
              height: "95vh",
              borderRadius: "16px 16px 0 0",
              bgcolor: "background.default",
            },
          }}
        >
          <Box
            sx={{
              width: "100vw",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header del modal */}
            <Box
              sx={{
                p: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <Typography variant="h5" fontWeight="bold">
                Detalle del Cierre
              </Typography>
              <IconButton
                onClick={() => setShowProducts(false)}
                sx={{
                  bgcolor: "action.hover",
                  "&:hover": {
                    bgcolor: "action.selected",
                  },
                }}
              >
                <Close />
              </IconButton>
            </Box>

            {/* Contenido con scroll */}
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                p: 2,
                bgcolor: "background.default",
              }}
            >
              {/* Estadísticas del cierre específico */}
              <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={6} md={3}>
                  <StatCard
                    icon={<AttachMoney fontSize={isMobile ? "medium" : "large"} />}
                    value={`$${cierreProducData.ciereData.totalVentas.toLocaleString()}`}
                    label="Total Ventas"
                    color="success.light"
                  />
                </Grid>

                <Grid item xs={6} sm={6} md={3}>
                  <StatCard
                    icon={<TrendingUp fontSize={isMobile ? "medium" : "large"} />}
                    value={`$${cierreProducData.ciereData.totalGanancia.toLocaleString()}`}
                    label="Ganancia"
                    color="info.light"
                  />
                </Grid>

                <Grid item xs={6} sm={6} md={3}>
                  <StatCard
                    icon={<Assessment fontSize={isMobile ? "medium" : "large"} />}
                    value={cierreProducData.totales.totalCantidad.toLocaleString()}
                    label="Productos Vendidos"
                    color="primary.light"
                  />
                </Grid>

                <Grid item xs={6} sm={6} md={3}>
                  <StatCard
                    icon={<AttachMoney fontSize={isMobile ? "medium" : "large"} />}
                    value={`$${cierreProducData.ciereData.totalTransferencia.toLocaleString()}`}
                    label="Transferencias"
                    color="warning.light"
                  />
                </Grid>
              </Grid>

              {/* Tabla de productos vendidos */}
              <ContentCard 
                title="Productos Vendidos"
                subtitle={!isMobile ? `${cierreProducData.ciereData.productosVendidos.length} tipos de productos` : undefined}
                noPadding
                fullHeight
              >
                <TablaProductosCierre
                  cierreData={cierreProducData.ciereData}
                  totales={cierreProducData.totales}
                />
              </ContentCard>
            </Box>
          </Box>
        </Drawer>
      )}
    </PageContainer>
  );
}
