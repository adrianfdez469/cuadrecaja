"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  Divider,
  Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {
  closePeriod,
  fetchCierreData,
  openPeriod,
} from "@/services/cierrePeriodService";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierreData, ICierrePeriodo } from "@/schemas/cierre";
import CerrarCajaConfirmDialog from "@/app/cierre/components/CerrarCajaConfirmDialog";
import {
  ITotales,
  TablaProductosCierre,
} from "@/components/tablaProductosCierre";
import { useSalesStore } from "@/store/salesStore";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import RefreshIcon from "@mui/icons-material/Refresh";
import PostAddIcon from "@mui/icons-material/PostAdd";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import InventoryIcon from "@mui/icons-material/Inventory";
import StoreIcon from "@mui/icons-material/Store";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { formatDate, formatCurrency, formatNumber } from "@/utils/formatters";
import { usePermisos } from "@/utils/permisos_front";
import GastoAdHocDialog from "@/app/gastos/components/GastoAdHocDialog";
import {
  createGastoAdHoc,
  deleteGastoAdHoc,
  getGastosTienda,
  previewGastosCierre,
  applyGastosCierre,
} from "@/services/gastoService";
import { IGastoAdHocCreate } from "@/schemas/gastos";
import MonedaBreakdownRow from "@/app/cierre/components/MonedaBreakdownRow";
import { DENOMINACIONES } from "@/constants/billDenominations";
import DeduccionesList from "@/app/cierre/components/DeduccionesList";

const CierreCajaPage = () => {
  const { user, loadingContext, gotToPath, monedasNegocio, monedaBase } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [cierreData, setCierreData] = useState<ICierreData>();
  const [totales, setTotales] = useState<ITotales>({
    totalCantidad: 0,
    totalGanancia: 0,
    totalMonto: 0,
  });
  const [noPeriodFound, setNoPeriodFound] = useState(false);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const [isProcessingCierre, setIsProcessingCierre] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [categoriasGastos, setCategoriasGastos] = useState<string[]>([]);
  const [gananciaExpanded, setGananciaExpanded] = useState(false);
  const [deletingGastoId, setDeletingGastoId] = useState<string | null>(null);
  const [cerrarCajaDialogOpen, setCerrarCajaDialogOpen] = useState(false);
  const { clearSales, sales } = useSalesStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();
  const canManageGastos = verificarPermiso("operaciones.gastos.gestionar");

  const handleSaveAdHoc = async (data: IGastoAdHocCreate) => {
    if (!currentPeriod) return;
    await createGastoAdHoc(currentPeriod.id, data);
    await getInitData();
  };

  const handleDeleteGasto = async (gastoId: string) => {
    if (!currentPeriod) return;
    setDeletingGastoId(gastoId);
    try {
      await deleteGastoAdHoc(currentPeriod.id, gastoId);
      showMessage("Gasto eliminado", "success");
      await getInitData();
    } catch {
      showMessage("Error al eliminar el gasto", "error");
    } finally {
      setDeletingGastoId(null);
    }
  };

  const handleConfirmarCierre = async () => {
    if (!currentPeriod) return;
    const localId = user.localActual.id;
    setIsProcessingCierre(true);
    try {
      // Aplicar automáticamente los gastos recurrentes que correspondan hoy
      // (ya se venían mostrando en las cards de resumen antes de llegar acá)
      try {
        const preview = await previewGastosCierre(currentPeriod.id);
        if (preview.gastosRecurrentes.length > 0) {
          await applyGastosCierre(currentPeriod.id, preview.gastosRecurrentes);
        }
      } catch (err) {
        console.error("Error al aplicar gastos recurrentes:", err);
      }

      await closePeriod(localId, currentPeriod.id);
      clearSales();

      await openPeriod(localId);
      showMessage("Cierre de caja realizado exitosamente", "success");
      setCerrarCajaDialogOpen(false);
    } catch (error) {
      console.error(error);
      showMessage("Ha ocurrido un error al realizar el cierre", "error");
    } finally {
      setIsProcessingCierre(false);
      await getInitData();
    }
  };

  const handleCerrarCaja = () => {
    if (isProcessingCierre) return;

    if (sales.filter((sale) => !sale.synced).length > 0) {
      showMessage(
        "Debe sincronizar las ventas en la interfaz del pos de ventas",
        "warning",
      );
      return;
    }

    setCerrarCajaDialogOpen(true);
  };

  const handleCreateFirstPeriod = async () => {
    // Evitar múltiples clics mientras se procesa
    if (isProcessingCierre) return;

    setIsProcessingCierre(true);
    try {
      setIsDataLoading(true);
      const localId = user.localActual.id;
      await openPeriod(localId);
      await getInitData();
      showMessage("Primer período creado exitosamente", "success");
    } catch (error) {
      console.error(error);
      showMessage("Error al crear el primer período", "error");
    } finally {
      setIsProcessingCierre(false);
    }
  };

  const getInitData = async () => {
    setIsDataLoading(true);
    setNoPeriodFound(false);
    setNoLocalActual(false);

    try {
      // Validar que el usuario tenga un local actual
      if (!user.localActual || !user.localActual.id) {
        setNoLocalActual(true);
        return;
      }

      const localId = user.localActual.id;
      const currentPeriod = await fetchLastPeriod(localId);

      if (!currentPeriod) {
        setNoPeriodFound(true);
        return;
      }

      setCurrentPeriod(currentPeriod);
      const [data, gastosTienda] = await Promise.all([
        fetchCierreData(localId, currentPeriod.id),
        getGastosTienda(localId),
      ]);

      setCierreData(data);
      setCategoriasGastos([...new Set(gastosTienda.map((g) => g.categoria))]);

      setTotales({
        totalCantidad: data.productosVendidos.reduce(
          (acc, p) => acc + p.cantidad,
          0,
        ),
        // Usar la ganancia total provista por el backend (ya ajustada por descuentos)
        totalGanancia: data.totalGanancia || 0,
        totalMonto: data.productosVendidos.reduce((acc, p) => acc + p.total, 0),
      });
    } catch (error) {
      console.error("Error al cargar los datos de cierre:", error);
      showMessage(error.message, "error", true, "permision-error");
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      getInitData();
    }
  }, [loadingContext]);

  // Componente de estadística móvil optimizado
  const StatCard = ({
    icon,
    value,
    label,
    color,
  }: {
    icon: React.ReactNode;
    value: string;
    label: string;
    color: string;
  }) => (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
                fontSize: isMobile ? "1.25rem" : "2rem",
                lineHeight: 1.2,
                wordBreak: "break-all",
              }}
            >
              {value}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: isMobile ? "0.75rem" : "0.875rem",
                lineHeight: 1.2,
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
    { label: "Inicio", href: "/home" },
    { label: "Cierre de Caja" },
  ];

  const headerActions = (
    <Stack direction="row-reverse" spacing={1} sx={{ width: "100%" }}>
      <Tooltip title="Actualizar datos">
        <IconButton
          onClick={getInitData}
          disabled={isDataLoading}
          size={isMobile ? "small" : "medium"}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      {canManageGastos && currentPeriod && !currentPeriod.fechaFin && (
        <Button
          variant="outlined"
          size={isMobile ? "small" : "medium"}
          startIcon={<PostAddIcon />}
          onClick={() => setAdHocOpen(true)}
        >
          {isMobile ? "Gasto" : "Agregar gasto"}
        </Button>
      )}
      {verificarPermiso("operaciones.cierre.cerrar") &&
        currentPeriod &&
        !currentPeriod.fechaFin && (
          <Button
            variant="contained"
            size={isMobile ? "small" : "medium"}
            onClick={handleCerrarCaja}
            disabled={isProcessingCierre}
          >
            {isProcessingCierre ? "Procesando..." : "Cerrar caja"}
          </Button>
        )}
    </Stack>
  );

  if (loadingContext || isDataLoading) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle="Gestión y control de cierres de período"
        breadcrumbs={breadcrumbs}
      >
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando datos de cierre...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (noLocalActual) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle="Gestión y control de cierres de período"
        breadcrumbs={breadcrumbs}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para realizar cierres de caja, necesitas tener una tienda
            seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la
            configuración.
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
            <Button variant="outlined" onClick={() => gotToPath("/home")}>
              Volver al Inicio
            </Button>
          </Box>
        </Alert>
      </PageContainer>
    );
  }

  if (noPeriodFound) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle="Gestión y control de cierres de período"
        breadcrumbs={breadcrumbs}
      >
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ¡Bienvenido a tu nuevo negocio!
          </Typography>
          <Typography variant="body1" gutterBottom>
            No se encontraron períodos de cierre. Para comenzar a usar el
            sistema de punto de venta y realizar cierres de caja, necesitas
            crear tu primer período.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Un período de cierre te permite controlar las ventas y realizar
            cortes de caja organizados por fechas.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCreateFirstPeriod}
          disabled={isDataLoading || isProcessingCierre}
        >
          {isProcessingCierre ? "Creando período..." : "Crear Primer Período"}
        </Button>
      </PageContainer>
    );
  }

  if (cierreData && currentPeriod) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle={`Período del ${formatDate(currentPeriod.fechaInicio)}`}
        breadcrumbs={breadcrumbs}
        headerActions={headerActions}
        maxWidth="xl"
        contentProps={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, sm: 3 },
        }}
      >
        {/* Estadísticas del cierre */}
        <Grid
          container
          spacing={isMobile ? 2 : 3}
          sx={{ mb: isMobile ? 3 : 4 }}
        >
          <Grid item xs={6} sm={6} md={4}>
            <StatCard
              icon={<InventoryIcon fontSize={"medium"} />}
              value={formatNumber(cierreData.productosVendidos.length)}
              label="Tipos de Productos"
              color="warning.light"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={4}>
            <StatCard
              icon={<ShoppingCartIcon fontSize={"medium"} />}
              value={formatNumber(totales.totalCantidad)}
              label="Productos Vendidos"
              color="primary.light"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<AttachMoneyIcon fontSize={"medium"} />}
              value={formatCurrency(
                (cierreData.totalVentasBrutas ?? totales.totalMonto) || 0,
              )}
              label="Total Ventas (Bruto)"
              color="success.light"
            />
          </Grid>

          {/* Mostrar descuentos totales del período si existen */}
          {typeof cierreData.totalDescuentos === "number" &&
            (cierreData.totalDescuentos || 0) > 0 && (
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  icon={<TrendingUpIcon fontSize={"medium"} />}
                  value={formatCurrency(cierreData.totalDescuentos || 0)}
                  label="Descuentos del Período"
                  color="error.light"
                />
              </Grid>
            )}

          {verificarPermiso("operaciones.cierre.gananciascostos") &&
            (() => {
              const gananciaDeducciones = cierreData.gananciaDeducciones || [];
              const gananciaBruta = totales.totalGanancia;
              const gananciaFinal =
                typeof cierreData.totalGananciaFinal === "number"
                  ? cierreData.totalGananciaFinal
                  : gananciaBruta;
              const hayDeducciones = gananciaDeducciones.length > 0;

              return (
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent sx={{ p: isMobile ? 1 : 3 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={isMobile ? 1 : 2}
                      >
                        <Box
                          sx={{
                            p: isMobile ? 1 : 1.5,
                            borderRadius: 2,
                            bgcolor:
                              gananciaFinal < 0 ? "error.light" : "info.light",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: isMobile ? 40 : 48,
                            minHeight: isMobile ? 40 : 48,
                          }}
                        >
                          <TrendingUpIcon fontSize="medium" />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="baseline"
                            flexWrap="wrap"
                          >
                            {hayDeducciones && (
                              <Typography
                                variant={isMobile ? "body1" : "h6"}
                                sx={{
                                  textDecoration: "line-through",
                                  color: "text.disabled",
                                }}
                              >
                                {formatCurrency(gananciaBruta)}
                              </Typography>
                            )}
                            <Typography
                              variant={isMobile ? "h5" : "h4"}
                              fontWeight="bold"
                              color={
                                gananciaFinal < 0 ? "error.main" : undefined
                              }
                              sx={{
                                fontSize: isMobile ? "1.25rem" : "2rem",
                                lineHeight: 1.2,
                                wordBreak: "break-all",
                              }}
                            >
                              {formatCurrency(gananciaFinal)}
                            </Typography>
                          </Stack>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: isMobile ? "0.75rem" : "0.875rem",
                              lineHeight: 1.2,
                            }}
                          >
                            Ganancia
                          </Typography>
                        </Box>
                        {hayDeducciones && (
                          <Tooltip
                            title={
                              gananciaExpanded
                                ? "Ocultar detalle"
                                : "Ver qué restó de la ganancia"
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => setGananciaExpanded((v) => !v)}
                            >
                              {gananciaExpanded ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>

                      <Collapse in={gananciaExpanded}>
                        <Divider sx={{ my: 1.5 }} />
                        <DeduccionesList
                          items={gananciaDeducciones}
                          onDelete={
                            canManageGastos && !currentPeriod.fechaFin
                              ? handleDeleteGasto
                              : undefined
                          }
                          deletingId={deletingGastoId}
                        />
                      </Collapse>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })()}

          {/* NUEVAS ESTADÍSTICAS DE CONSIGNACIÓN */}
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<StoreIcon fontSize={"medium"} />}
              value={formatCurrency(cierreData.totalVentasPropias || 0)}
              label="Ventas Propias (Bruto)"
              color="success.dark"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<HandshakeIcon fontSize={"medium"} />}
              value={formatCurrency(cierreData.totalVentasConsignacion || 0)}
              label="Ventas Consignación"
              color="secondary.light"
            />
          </Grid>
        </Grid>

        {/* Desglose por moneda (solo visible si hay ventas multimoneda) */}
        {cierreData.resumenMonedas && cierreData.resumenMonedas.length > 0 && (
          <ContentCard
            title="Desglose por Moneda"
            subtitle={
              !isMobile ? "Ingresos reales por moneda de cobro" : undefined
            }
          >
            <Stack spacing={1.5} divider={<Divider flexItem />}>
              {cierreData.resumenMonedas.map((rm) => {
                const negocioMoneda = monedasNegocio.find(
                  (m) => m.monedaCode === rm.monedaCode,
                );
                // Denominations from DB config; CUP falls back to static list if not configured
                const denominations =
                  negocioMoneda?.moneda?.denominaciones
                    ?.filter((d) => d.activo)
                    .map((d) => d.valor)
                    .sort((a, b) => b - a) ??
                  (rm.monedaCode === "CUP"
                    ? [...DENOMINACIONES.CUP].sort((a, b) => b - a)
                    : []);
                return (
                  <MonedaBreakdownRow
                    key={rm.monedaCode}
                    monedaCode={rm.monedaCode}
                    totalEfectivo={rm.totalEfectivo}
                    totalTransfer={rm.totalTransfer}
                    equivalenteBase={rm.equivalenteBase}
                    totalEfectivoBruto={rm.totalEfectivoBruto}
                    equivalenteBaseBruto={rm.equivalenteBaseBruto}
                    tiendaId={user?.localActual?.id ?? ""}
                    cierreId={currentPeriod.id}
                    isOpen={!currentPeriod.fechaFin}
                    denominations={denominations}
                    deducciones={
                      cierreData.cajaDeducciones?.[rm.monedaCode] || []
                    }
                    onDeleteGasto={
                      verificarPermiso("operaciones.cierre.gananciascostos") &&
                      canManageGastos &&
                      !currentPeriod.fechaFin
                        ? handleDeleteGasto
                        : undefined
                    }
                    deletingGastoId={deletingGastoId}
                  />
                );
              })}
            </Stack>
          </ContentCard>
        )}

        {/* Tabla de productos vendidos */}
        <TablaProductosCierre
          cierreData={cierreData}
          totales={totales}
          showOnlyCants={
            !verificarPermiso("operaciones.cierre.gananciascostos")
          }
          isProcessing={isProcessingCierre}
        />

        <CerrarCajaConfirmDialog
          open={cerrarCajaDialogOpen}
          tiendaId={user.localActual.id}
          cierreId={currentPeriod.id}
          cierreData={cierreData}
          onClose={() => setCerrarCajaDialogOpen(false)}
          onConfirm={handleConfirmarCierre}
        />

        {canManageGastos && (
          <GastoAdHocDialog
            open={adHocOpen}
            totalVentas={cierreData.totalVentasBrutas ?? totales.totalMonto}
            totalGanancia={totales.totalGanancia}
            categoriasExistentes={categoriasGastos}
            monedasActivas={monedasNegocio}
            monedaBase={monedaBase}
            onClose={() => setAdHocOpen(false)}
            onSave={handleSaveAdHoc}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Cierre de Caja"
      subtitle="Gestión y control de cierres de período"
      breadcrumbs={breadcrumbs}
    >
      <Alert severity="error">
        Error al cargar los datos de cierre. Por favor, intenta recargar la
        página.
      </Alert>
    </PageContainer>
  );
};

export default CierreCajaPage;
