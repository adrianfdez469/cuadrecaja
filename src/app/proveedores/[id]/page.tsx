"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TablePagination,
  Grid,
  Button,
  CircularProgress,
  IconButton,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
  Tabs,
  Tab,
  Avatar,
  Divider,
} from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from "@/utils/formatters";
import {
  TrendingUp,
  Refresh,
  ArrowBack,
  Receipt,
  Inventory,
  LocalShipping,
  MonetizationOn,
  Person,
  Phone,
  Email,
  CalendarToday,
  Payment,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { findUltimaLiquidacion, getProveedoresConsignacionById, liquidarProveedorConsignacion, sumDineroLiquidado, sumDineroPorLiquidar, sumProdsConsignación } from "@/services/preoveedoresService";
import { IProveedorConsignacion } from "@/types/IProveedorConsignación";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";

interface ILiquidacion {
  id: string;
  fecha: string;
  monto: number;
  productos: number;
  observaciones: string;
  estado: 'completada' | 'pendiente';
  fechaLiquidacion?: string | null;
}

interface IProductoConsignacion {
  id: string;
  nombre: string;
  // codigo: string;
  categoria: string;
  precio: number;
  vendidos: number;
  disponibles: number;
  ganancias: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ProveedorDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [proveedor, setProveedor] = useState<IProveedorConsignacion | null>(null);
  const [liquidaciones, setLiquidaciones] = useState<ILiquidacion[]>([]);
  const [productosConsignacion, setProductosConsignacion] = useState<IProductoConsignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLiquidaciones, setPageLiquidaciones] = useState(0);
  const [pageProductos, setPageProductos] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    setLoading(true);
    try {

      const proveedorData = await getProveedoresConsignacionById(id.toString());


      const pclc = proveedorData.prodProveedorLiquidacion;
      const dataProveedor: IProveedorConsignacion = {
        nombre: proveedorData.nombre,
        telefono: proveedorData.telefono,
        direccion: proveedorData.direccion,
        id: proveedorData.id,
        estado: 'activo',
        dineroLiquidado: pclc.reduce(sumDineroLiquidado, 0),
        dineroPorLiquidar: pclc.reduce(sumDineroPorLiquidar, 0),
        totalProductosConsignacion: pclc.reduce(sumProdsConsignación, 0),
        ultimaLiquidacion: pclc.reduce(findUltimaLiquidacion, null)
      }

      const liquidacionesProveedorObj = pclc.reduce((acc, prodLiq) => {
        if(!acc[prodLiq.cierreId]) {
          return {
            ...acc,
            [prodLiq.cierreId]: {
              id: prodLiq.cierreId,
              fecha: prodLiq.createdAt,
              monto: prodLiq.monto,
              productos: prodLiq.vendidos,
              observaciones: `Liquidación de cierre: ${new Date(prodLiq.cierre.fechaInicio).toLocaleDateString()} - ${new Date(prodLiq.cierre.fechaFin).toLocaleDateString()}`,
              estado: prodLiq.liquidatedAt !== null ? "completada" : "pendiente",
              fechaLiquidacion: prodLiq.liquidatedAt
            }
          }
        } else {
          return {
            ...acc,
            [prodLiq.cierreId] : {
              ...acc[prodLiq.cierreId],
              monto: acc[prodLiq.cierreId].monto + prodLiq.monto,
              productos: acc[prodLiq.cierreId].productos + prodLiq.vendidos,
              // Mantener la fecha de liquidación más reciente para liquidaciones completadas
              fechaLiquidacion: prodLiq.liquidatedAt && (!acc[prodLiq.cierreId].fechaLiquidacion || new Date(prodLiq.liquidatedAt) > new Date(acc[prodLiq.cierreId].fechaLiquidacion)) 
                ? prodLiq.liquidatedAt 
                : acc[prodLiq.cierreId].fechaLiquidacion
            }
          }
        }
      }, {})

      if (!dataProveedor) {
        router.push('/proveedores');
        return;
      }


      // Ordena por 2 criterios
      // 1: Estado: Muestra primero los pendientes y despues los completados.
      // 2: Fecha: Para el grupo de los pendientes, los primeros serán los más antiguos.
      //           Para el grupo de los completados, los primeros seran los mas actuales. 
      const liquidacionesData = (Object.values(liquidacionesProveedorObj) as  ILiquidacion[])
      .sort((a, b) => {
        if(a.estado === 'completada' && b.estado === 'pendiente') {
          return 1;
        } else if(a.estado === 'pendiente' && b.estado === 'completada') {
          return -1;
        } else {
          // Ambos tienen el mismo estado, ordenar por fecha
          if(a.estado === 'pendiente') {
            // Para pendientes: fechas más antiguas primero (orden ascendente)
            if( new Date(a.fecha) > new Date(b.fecha) ) {
              return 1;   // 'a' va DESPUÉS de 'b'
            } else {
              return -1;  // 'a' va ANTES de 'b'
            }
          } else {
            // Para completadas: fechas más recientes primero (orden descendente)
            if( new Date(a.fecha) > new Date(b.fecha) ) {
              return -1;  // 'a' va ANTES de 'b'
            } else {
              return 1;   // 'a' va DESPUÉS de 'b'
            }
          }
        }
      })

      const prodsConsignaciónMap: IProductoConsignacion[] = pclc.reduce((acc, prod)   => {
        if(!acc[prod.productoId]) {
          return {
            ...acc,
            [prod.productoId]: {
              id: prod.productoId,
              nombre: prod.producto.nombre,
              categoria: prod.producto.categoria.nombre,
              precio: prod.precio,

              vendidos: prod.vendidos,
              
              disponibles: prod.existencia,
              ganancias: (prod.vendidos * prod.precio) - prod.monto
            }
          }
        } else {
          return {
            ...acc,
            [prod.productoId]: {
              ...acc[prod.productoId],
              vendidos: acc[prod.productoId].vendidos + prod.vendidos,
              
              disponibles: acc[prod.productoId].disponibles + prod.existencia,
              ganancias: acc[prod.productoId].ganancias + ((prod.vendidos * prod.precio) - prod.monto)
            }
          }
        }
      }, {});
console.log('liquidacionesData',liquidacionesData);

      const prodsConsignación = Object.values(prodsConsignaciónMap);


      setProveedor(dataProveedor);
      setLiquidaciones(liquidacionesData);
      setProductosConsignacion(prodsConsignación);
    } catch (error) {
      console.error("Error al cargar detalles del proveedor:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage = (type: 'liquidaciones' | 'productos') =>
    (_: unknown, newPage: number) => {
      if (type === 'liquidaciones') {
        setPageLiquidaciones(newPage);
      } else {
        setPageProductos(newPage);
      }
    };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPageLiquidaciones(0);
    setPageProductos(0);
  };

  const handleLiquidarProveedor = async (cierreId: string, proveedorId: string) => {
    try {

      // Preguntar si desea liquidar el proveedor
      confirmDialog(
        "¿Está seguro de desea liquidar al proveedor?",
        async () => {
          setLoading(true);
          await liquidarProveedorConsignacion(cierreId, proveedorId);
          await fetchData();
          showMessage("Proveedor liquidado correctamente", "success");
        }
      );

    } catch (error) {
      console.error("Error al liquidar el proveedor:", error);
      showMessage( "Error al liquidar el proveedor", "error");
    } finally {
      setLoading(false);
    }
  }

  // Componente de estadística
  const StatCard = ({
    icon,
    value,
    label,
    color
  }: {
    icon: React.ReactNode;
    value: string;
    label: string;
    color: string;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
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
    { label: 'Proveedores', href: '/proveedores' },
    { label: proveedor?.nombre || 'Cargando...' }
  ];

  const headerActions = (
    <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
      <Button
        variant="outlined"
        startIcon={<ArrowBack />}
        onClick={() => router.push('/proveedores')}
        size={isMobile ? "small" : "medium"}
      >
        Volver
      </Button>
      <Tooltip title="Actualizar datos">
        <IconButton onClick={fetchData} disabled={loading} size={isMobile ? "small" : "medium"}>
          <Refresh />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (loading) {
    return (
      <PageContainer
        title="Detalles del Proveedor"
        subtitle="Cargando información del proveedor..."
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando detalles del proveedor...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!proveedor) {
    return (
      <PageContainer
        title="Proveedor no encontrado"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography variant="h6">
            No se pudo encontrar el proveedor solicitado
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={proveedor.nombre}
      subtitle={!isMobile ? "Detalles del proveedor, liquidaciones y productos en consignación" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Información del proveedor */}
      <ContentCard
        title="Información del Proveedor"
        subtitle={!isMobile ? "Datos de contacto y estado" : undefined}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {proveedor.nombre}
                  </Typography>
                  <Chip
                    label={proveedor.estado}
                    color={proveedor.estado === 'activo' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2">
                      {proveedor.telefono}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2">
                      {proveedor.direccion}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="body2">
                      Última liquidación: {proveedor.ultimaLiquidacion ? new Date(proveedor.ultimaLiquidacion).toLocaleDateString() : 'Sin liquidar'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocalShipping fontSize="small" color="action" />
                    <Typography variant="body2">
                      {proveedor.totalProductosConsignacion} productos en consignación
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={12}>
                <StatCard
                  icon={<MonetizationOn fontSize="medium" />}
                  value={formatCurrency(proveedor.dineroLiquidado)}
                  label="Dinero Liquidado"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6} md={12}>
                <StatCard
                  icon={<TrendingUp fontSize="medium" />}
                  value={formatCurrency(proveedor.dineroPorLiquidar)}
                  label="Por Liquidar"
                  color="warning.light"
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </ContentCard>

      {/* Pestañas */}
      <ContentCard noPadding>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{ px: 3 }}
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab
              label="Liquidaciones"
              icon={<Receipt />}
              iconPosition="start"
              sx={{ minHeight: 64 }}
            />
            <Tab
              label="Productos en Consignación"
              icon={<Inventory />}
              iconPosition="start"
              sx={{ minHeight: 64 }}
            />
          </Tabs>
        </Box>

        {/* Panel de Liquidaciones */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Historial de Liquidaciones
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {liquidaciones.length} liquidaciones registradas
          </Typography>

          {isMobile ? (
            // Vista móvil con cards
            <Stack spacing={2} sx={{ mt: 3 }}>
              {liquidaciones.slice(pageLiquidaciones * rowsPerPage, (pageLiquidaciones + 1) * rowsPerPage).map((liquidacion) => (
                <Card key={liquidacion.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {dayjs(liquidacion.fecha).format("DD/MM/YYYY")}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {liquidacion.productos} productos
                          </Typography>
                        </Box>
                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                          <Chip
                            label={liquidacion.estado}
                            color={liquidacion.estado === 'completada' ? 'success' : 'warning'}
                            size="small"
                          />
                          {liquidacion.estado === 'completada' && liquidacion.fechaLiquidacion && (
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(liquidacion.fechaLiquidacion).format("DD/MM/YYYY")}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="h6" color="success.main" fontWeight="bold">
                          {formatCurrency(liquidacion.monto)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {liquidacion.observaciones}
                        </Typography>
                      </Box>

                      {liquidacion.estado === 'pendiente' && (
                        <Box sx={{ pt: 1 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<Payment />}
                            onClick={() => handleLiquidarProveedor(liquidacion.id, id.toString())}
                            fullWidth
                          >
                            Liquidar
                          </Button>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            // Vista desktop con tabla
            <TableContainer sx={{ mt: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell align="center">Productos</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell align="center">Fecha Liquidación</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liquidaciones.slice(pageLiquidaciones * rowsPerPage, (pageLiquidaciones + 1) * rowsPerPage).map((liquidacion) => (
                    <TableRow key={liquidacion.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(liquidacion.fecha).format("DD/MM/YYYY")}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="success.main">
                          {formatCurrency(liquidacion.monto)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {liquidacion.productos}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {liquidacion.observaciones}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={liquidacion.estado}
                          color={liquidacion.estado === 'completada' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {liquidacion.estado === 'completada' && liquidacion.fechaLiquidacion ? (
                          <Typography variant="body2" color="text.secondary">
                            {dayjs(liquidacion.fechaLiquidacion).format("DD/MM/YYYY")}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {liquidacion.estado === 'pendiente' && (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<Payment />}
                            onClick={() => handleLiquidarProveedor(liquidacion.id, id.toString())}
                          >
                            Liquidar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={liquidaciones.length}
            page={pageLiquidaciones}
            onPageChange={handleChangePage('liquidaciones')}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Filas por página:"
            sx={{ mt: 2 }}
          />
        </TabPanel>

        {/* Panel de Productos en Consignación */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Productos en Consignación
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {productosConsignacion.length} productos registrados
          </Typography>

          {isMobile ? (
            // Vista móvil con cards
            <Stack spacing={2} sx={{ mt: 3 }}>
              {productosConsignacion.slice(pageProductos * rowsPerPage, (pageProductos + 1) * rowsPerPage).map((producto) => (
                <Card key={producto.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {producto.nombre}
                        </Typography>
                        {/* <Typography variant="body2" color="text.secondary">
                          {producto.codigo} - {producto.categoria}
                        </Typography> */}
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Precio
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(producto.precio)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Disponibles
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="info.main">
                            {producto.disponibles}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Vendidos
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            {producto.vendidos}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Ganancias
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            {formatCurrency(producto.ganancias)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            // Vista desktop con tabla
            <TableContainer sx={{ mt: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    {/* <TableCell>Código</TableCell> */}
                    <TableCell>Categoría</TableCell>
                    <TableCell align="right">Precio</TableCell>
                    <TableCell align="center">Disponibles</TableCell>
                    <TableCell align="center">Vendidos</TableCell>
                    <TableCell align="right">Ganancias</TableCell>
                    {/* <TableCell align="center">Fecha Ingreso</TableCell> */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productosConsignacion.slice(pageProductos * rowsPerPage, (pageProductos + 1) * rowsPerPage).map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {producto.nombre}
                        </Typography>
                      </TableCell>
                      {/* <TableCell>
                        <Typography variant="body2">
                          {producto.codigo}
                        </Typography>
                      </TableCell> */}
                      <TableCell>
                        <Typography variant="body2">
                          {producto.categoria}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(producto.precio)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="info.main" fontWeight="medium">
                          {producto.disponibles}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="success.main" fontWeight="medium">
                          {producto.vendidos}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main" fontWeight="medium">
                          {formatCurrency(producto.ganancias)}
                        </Typography>
                      </TableCell>
                      {/* <TableCell align="center">
                        <Typography variant="body2">
                          {dayjs(producto.fechaIngreso).format("DD/MM/YYYY")}
                        </Typography>
                      </TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={productosConsignacion.length}
            page={pageProductos}
            onPageChange={handleChangePage('productos')}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Filas por página:"
            sx={{ mt: 2 }}
          />
        </TabPanel>
      </ContentCard>
      {ConfirmDialogComponent}
    </PageContainer>
  );
} 