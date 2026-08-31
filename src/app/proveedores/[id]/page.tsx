"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import { StatusPill } from "@/components/StatusPill";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from "@/utils/formatters";
import {
  Refresh,
  ArrowBack,
  Receipt,
  Inventory,
  LocalShipping,
  Phone,
  LocationOn,
  CalendarToday,
  Payment,
} from "@mui/icons-material";
import dayjs from "dayjs";
import {
  getProveedoresConsignacionById,
  liquidarProveedorConsignacion,
} from "@/services/preoveedoresService";
import {
  ILiquidacionConsignacion,
  IProductoConsignacion,
  IProveedorConsignacion,
} from "@/schemas/proveedor";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { usePermisos } from "@/utils/permisos_front";

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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProveedorDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [proveedor, setProveedor] = useState<IProveedorConsignacion | null>(
    null,
  );
  const [liquidaciones, setLiquidaciones] = useState<
    ILiquidacionConsignacion[]
  >([]);
  const [productosConsignacion, setProductosConsignacion] = useState<
    IProductoConsignacion[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [pageLiquidaciones, setPageLiquidaciones] = useState(0);
  const [pageProductos, setPageProductos] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { verificarPermiso } = usePermisos();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        proveedor: dataProveedor,
        liquidaciones: liquidacionesData,
        productos,
      } = await getProveedoresConsignacionById(id.toString());

      if (!dataProveedor) {
        router.push("/proveedores");
        return;
      }

      setProveedor(dataProveedor);
      setLiquidaciones(liquidacionesData);
      setProductosConsignacion(productos);
    } catch (error) {
      console.error("Error al cargar detalles del proveedor:", error);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage =
    (type: "liquidaciones" | "productos") => (_: unknown, newPage: number) => {
      if (type === "liquidaciones") {
        setPageLiquidaciones(newPage);
      } else {
        setPageProductos(newPage);
      }
    };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPageLiquidaciones(0);
    setPageProductos(0);
  };

  const handleLiquidarProveedor = async (
    cierreId: string,
    proveedorId: string,
  ) => {
    try {
      // Preguntar si desea liquidar el proveedor
      confirmDialog(
        "¿Está seguro de desea liquidar al proveedor?",
        async () => {
          setLoading(true);
          await liquidarProveedorConsignacion(cierreId, proveedorId);
          await fetchData();
          showMessage("Proveedor liquidado correctamente", "success");
        },
        undefined,
        { severity: "warning" },
      );
    } catch (error) {
      console.error("Error al liquidar el proveedor:", error);
      showMessage("Error al liquidar el proveedor", "error");
    } finally {
      setLoading(false);
    }
  };

  // Componente de estadística
  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Proveedores", href: "/proveedores" },
    { label: proveedor?.nombre || "Cargando..." },
  ];

  // En mobile la migaja de pan ya vuelve a /proveedores — el botón "Volver"
  // duplicaba esa navegación y el mockup mobile no lo dibuja; en desktop sí.
  const headerActions = (
    <Stack direction="row" spacing={1}>
      {!isMobile && (
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => router.push("/proveedores")}
        >
          Volver
        </Button>
      )}
      <Tooltip title="Actualizar datos">
        <IconButton onClick={fetchData} disabled={loading}>
          <Refresh />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (loading) {
    return (
      <PageContainer
        title="Detalles del Proveedor"
        subtitle="Detalles del proveedor, liquidaciones y productos en consignación"
        breadcrumbs={breadcrumbs}
      >
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  if (!proveedor) {
    return (
      <PageContainer title="Proveedor no encontrado" breadcrumbs={breadcrumbs}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
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
      titleAdornment={
        <StatusPill
          label={proveedor.estado}
          hue={proveedor.estado === "activo" ? "positive" : "neutral"}
        />
      }
      subtitle={
        !isMobile
          ? "Detalles del proveedor, liquidaciones y productos en consignación"
          : undefined
      }
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Cifras de dinero: 2 columnas en mobile, apiladas en desktop — el
          mockup invierte el orden entero según el viewport, así que se
          renderizan directo en la página en vez de dentro de un
          `ContentCard` compartido con la información del proveedor. */}
      {isMobile && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            mb: 2,
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 2, borderRight: 1, borderColor: "divider" }}>
            <Typography variant="body2" color="text.secondary">
              Dinero Liquidado
            </Typography>
            <Typography
              sx={{
                mt: 0.25,
                fontSize: "1.5rem",
                fontWeight: 700,
                color:
                  proveedor.dineroLiquidado > 0
                    ? "success.main"
                    : "text.primary",
              }}
            >
              {formatCurrency(proveedor.dineroLiquidado)}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Por Liquidar
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: "1.5rem", fontWeight: 700 }}>
              {formatCurrency(proveedor.dineroPorLiquidar)}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              gridColumn: "1 / -1",
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Valor en Consignación
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: "1.5rem", fontWeight: 700 }}>
              {formatCurrency(proveedor.valorConsignacion)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Información del proveedor */}
      <ContentCard>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={2}>
              <Typography
                variant="overline"
                sx={{
                  textTransform: "uppercase",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  color: "text.secondary",
                }}
              >
                Información del Proveedor
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="body2">
                      Última liquidación:{" "}
                      {proveedor.ultimaLiquidacion
                        ? new Date(
                            proveedor.ultimaLiquidacion,
                          ).toLocaleDateString()
                        : "Sin liquidar"}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocalShipping fontSize="small" color="action" />
                    <Typography variant="body2">
                      {proveedor.totalProductosConsignacion} productos en
                      consignación
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Phone fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      color={
                        proveedor.telefono ? "text.primary" : "text.disabled"
                      }
                    >
                      {proveedor.telefono || "Sin teléfono"}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocationOn fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      color={
                        proveedor.direccion ? "text.primary" : "text.disabled"
                      }
                    >
                      {proveedor.direccion || "Sin dirección"}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          {!isMobile && (
            <Grid item xs={12} md={4}>
              <Stack
                spacing={2}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: "8px",
                  p: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    Dinero Liquidado
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color:
                        proveedor.dineroLiquidado > 0
                          ? "success.main"
                          : "text.primary",
                    }}
                  >
                    {formatCurrency(proveedor.dineroLiquidado)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    borderTop: 1,
                    borderColor: "divider",
                    pt: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    Por Liquidar
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "text.primary",
                    }}
                  >
                    {formatCurrency(proveedor.dineroPorLiquidar)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    borderTop: 1,
                    borderColor: "divider",
                    pt: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    Valor en Consignación
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "text.primary",
                    }}
                  >
                    {formatCurrency(proveedor.valorConsignacion)}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          )}
        </Grid>
      </ContentCard>

      {/* Pestañas */}
      <ContentCard noPadding>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
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
              {liquidaciones
                .slice(
                  pageLiquidaciones * rowsPerPage,
                  (pageLiquidaciones + 1) * rowsPerPage,
                )
                .map((liquidacion) => (
                  <Card key={liquidacion.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Box>
                            <Typography variant="subtitle2" fontWeight="medium">
                              {dayjs(liquidacion.fecha).format("DD/MM/YYYY")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {liquidacion.productos} productos
                            </Typography>
                          </Box>
                          <Box
                            display="flex"
                            flexDirection="column"
                            alignItems="flex-end"
                            gap={0.5}
                          >
                            <Chip
                              label={liquidacion.estado}
                              color={
                                liquidacion.estado === "completada"
                                  ? "success"
                                  : "warning"
                              }
                              size="small"
                            />
                            {liquidacion.estado === "completada" &&
                              liquidacion.fechaLiquidacion && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {dayjs(liquidacion.fechaLiquidacion).format(
                                    "DD/MM/YYYY",
                                  )}
                                </Typography>
                              )}
                          </Box>
                        </Box>

                        <Box>
                          <Typography
                            variant="h6"
                            color="success.main"
                            fontWeight="bold"
                          >
                            {formatCurrency(liquidacion.monto)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {liquidacion.observaciones}
                          </Typography>
                        </Box>

                        {liquidacion.estado === "pendiente" && (
                          <Box sx={{ pt: 1 }}>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              startIcon={<Payment />}
                              onClick={() =>
                                handleLiquidarProveedor(
                                  liquidacion.id,
                                  id.toString(),
                                )
                              }
                              fullWidth
                              disabled={
                                !verificarPermiso(
                                  "configuracion.proveedores.liquidar",
                                )
                              }
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
                    <TableCell align="right">Productos</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell>Fecha Liquidación</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liquidaciones
                    .slice(
                      pageLiquidaciones * rowsPerPage,
                      (pageLiquidaciones + 1) * rowsPerPage,
                    )
                    .map((liquidacion) => (
                      <TableRow key={liquidacion.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {dayjs(liquidacion.fecha).format("DD/MM/YYYY")}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            color="success.main"
                          >
                            {formatCurrency(liquidacion.monto)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {liquidacion.productos}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {liquidacion.observaciones}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <StatusPill
                            label={liquidacion.estado}
                            hue={
                              liquidacion.estado === "completada"
                                ? "positive"
                                : "caution"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {liquidacion.estado === "completada" &&
                          liquidacion.fechaLiquidacion ? (
                            <Typography variant="body2" color="text.secondary">
                              {dayjs(liquidacion.fechaLiquidacion).format(
                                "DD/MM/YYYY",
                              )}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {liquidacion.estado === "pendiente" && (
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              startIcon={<Payment />}
                              onClick={() =>
                                handleLiquidarProveedor(
                                  liquidacion.id,
                                  id.toString(),
                                )
                              }
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
            onPageChange={handleChangePage("liquidaciones")}
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
            {productosConsignacion.length} productos registrados ·{" "}
            {formatCurrency(proveedor.valorConsignacion)} en existencia
          </Typography>

          {isMobile ? (
            // Vista móvil con cards
            <Stack spacing={2} sx={{ mt: 3 }}>
              {productosConsignacion
                .slice(
                  pageProductos * rowsPerPage,
                  (pageProductos + 1) * rowsPerPage,
                )
                .map((producto) => (
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
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Costo Unitario
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(producto.costo)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Disponibles
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {producto.disponibles}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Valor en Existencia
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(producto.valor)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Vendidos
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {producto.vendidos}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Ganancias
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              color="success.main"
                            >
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
                    <TableCell align="right">Costo Unitario</TableCell>
                    <TableCell align="right">Disponibles</TableCell>
                    <TableCell align="right">Valor en Existencia</TableCell>
                    <TableCell align="right">Vendidos</TableCell>
                    <TableCell align="right">Ganancias</TableCell>
                    {/* <TableCell align="center">Fecha Ingreso</TableCell> */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productosConsignacion
                    .slice(
                      pageProductos * rowsPerPage,
                      (pageProductos + 1) * rowsPerPage,
                    )
                    .map((producto) => (
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
                            {formatCurrency(producto.costo)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {producto.disponibles}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(producto.valor)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {producto.vendidos}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color="success.main"
                            fontWeight="medium"
                          >
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
            onPageChange={handleChangePage("productos")}
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
