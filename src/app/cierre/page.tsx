"use client";

import React, { useEffect, useState } from "react";
import { StatStrip } from "@/components/StatStrip";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Stack,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
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
import { formatDate, formatCurrency, formatNumber } from "@/utils/formatters";
import { usePermisos } from "@/utils/permisos_front";
import GastoAdHocDialog from "@/app/gastos/components/GastoAdHocDialog";
import {
  createGastoAdHoc,
  deleteGastoAdHoc,
  getGastosTienda,
  applyGastosCierre,
} from "@/services/gastoService";
import { IGastoAdHocCreate, IGastoPreview } from "@/schemas/gastos";
import MonedaBreakdownRow from "@/app/cierre/components/MonedaBreakdownRow";
import { DENOMINACIONES } from "@/constants/billDenominations";
import GananciaCard from "@/app/cierre/components/GananciaCard";
import PropinasCard from "@/app/cierre/components/PropinasCard";
import InitialCashFundDialog from "@/app/cierre/components/InitialCashFundDialog";
import SavingsIcon from "@mui/icons-material/Savings";
import CierreTotalsCard from "@/app/cierre/components/CierreTotalsCard";
import VentasSummaryCard from "@/app/cierre/components/VentasSummaryCard";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";

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
  const [deletingGastoId, setDeletingGastoId] = useState<string | null>(null);
  const [cerrarCajaDialogOpen, setCerrarCajaDialogOpen] = useState(false);
  const [initialFundDialogOpen, setInitialFundDialogOpen] = useState(false);
  const { clearSales, sales } = useSalesStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();
  const canManageGastos = verificarPermiso("operaciones.gastos.gestionar");
  const canManageInitialFund = verificarPermiso(
    "operaciones.cierre.fondoinicial",
  );

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

  const handleConfirmarCierre = async (
    gastosRecurrentesSeleccionados: IGastoPreview[],
  ) => {
    if (!currentPeriod) return;
    const localId = user.localActual.id;
    setIsProcessingCierre(true);
    try {
      // Aplicar los gastos recurrentes que el usuario dejó marcados en el
      // diálogo de confirmación. Si esto falla, el cierre se aborta — no
      // queremos cerrar la caja sin que estos gastos queden reflejados.
      if (gastosRecurrentesSeleccionados.length > 0) {
        await applyGastosCierre(
          currentPeriod.id,
          gastosRecurrentesSeleccionados,
        );
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
      // Los gastos son datos opcionales de esta vista (solo alimentan el
      // Autocomplete de categorías del diálogo de gasto ad-hoc, que ni
      // siquiera se renderiza sin `canManageGastos`) — no deben impedir que
      // se muestre el cierre si el usuario no tiene permiso para verlos o si
      // la petición falla por cualquier otro motivo.
      const [data, gastosTienda] = await Promise.all([
        fetchCierreData(localId, currentPeriod.id),
        canManageGastos
          ? getGastosTienda(localId).catch((error) => {
              console.error("Error al cargar categorías de gastos:", error);
              return [];
            })
          : Promise.resolve([]),
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
  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Cierre de Caja" },
  ];

  const canCerrarCaja =
    verificarPermiso("operaciones.cierre.cerrar") &&
    !!currentPeriod &&
    !currentPeriod.fechaFin;
  const showAdHocButton =
    canManageGastos && currentPeriod && !currentPeriod.fechaFin;
  const showInitialFundButton =
    canManageInitialFund && currentPeriod && !currentPeriod.fechaFin;

  // On a phone, this row moves out of the header entirely: "Agregar gasto" and
  // "Fondo inicial" become full-width buttons in the content, and "Cerrar
  // caja" joins the refresh action in a bar fixed to the bottom of the
  // viewport — the thumb-reachable strip the mobile redesign calls for,
  // instead of a row of icon-sized buttons squeezed under the title.
  const headerActions = !isMobile && (
    <Stack direction="row" spacing={1}>
      {showAdHocButton && (
        <Button
          variant="outlined"
          startIcon={<PostAddIcon />}
          onClick={() => setAdHocOpen(true)}
        >
          Agregar gasto
        </Button>
      )}
      {showInitialFundButton && (
        <Button
          variant="outlined"
          startIcon={<SavingsIcon />}
          onClick={() => setInitialFundDialogOpen(true)}
        >
          Fondo inicial
        </Button>
      )}
      <Tooltip title="Actualizar datos">
        <IconButton onClick={getInitData} disabled={isDataLoading}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      {canCerrarCaja && (
        <Button
          variant="contained"
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
          {verificarPermiso("operaciones.cierre.gananciascostos") && (
            <Grid item xs={12} sm={6} md={4}>
              <GananciaCard
                gananciaBruta={totales.totalGanancia}
                gananciaFinal={
                  typeof cierreData.totalGananciaFinal === "number"
                    ? cierreData.totalGananciaFinal
                    : totales.totalGanancia
                }
                deducciones={cierreData.gananciaDeducciones || []}
                onDelete={
                  canManageGastos && !currentPeriod.fechaFin
                    ? handleDeleteGasto
                    : undefined
                }
                deletingId={deletingGastoId}
                isMobile={isMobile}
              />
            </Grid>
          )}

          {/* Propinas — solo aparece si las hubo. No forma parte de ninguna
              cifra de ventas ni de ganancia: es dinero que pasó por la caja
              pero pertenece al personal. */}
          {(cierreData.totalTips || 0) > 0 && (
            <Grid item xs={12} sm={6} md={4}>
              <PropinasCard
                totalTips={cierreData.totalTips || 0}
                tipsPorUsuario={cierreData.tipsPorUsuario}
                resumenMonedas={cierreData.resumenMonedas}
                isMobile={isMobile}
              />
            </Grid>
          )}
        </Grid>

        {/* The five headline totals, on one scale — replaces the two figures
            ("Ventas Propias", "Ventas Consignación") this strip used to share
            with product counts they had nothing to do with. */}
        <CierreTotalsCard
          totalVenta={cierreData.totalVentas}
          totalVentasBrutas={cierreData.totalVentasBrutas}
          totalDescuentos={cierreData.totalDescuentos}
          totalGanancia={
            typeof cierreData.totalGananciaFinal === "number"
              ? cierreData.totalGananciaFinal
              : totales.totalGanancia
          }
          totalTransferencia={cierreData.totalTransferencia}
          transferenciasPorDestino={cierreData.totalTransferenciasByDestination}
          totalVentasPropias={cierreData.totalVentasPropias}
          totalVentasConsignacion={cierreData.totalVentasConsignacion}
          isMobile={isMobile}
        />

        {/* What's left: how much moved and in how many kinds of product. */}
        <StatStrip
          variant="card"
          stats={[
            {
              label: "Total Ventas (Bruto)",
              value: formatCurrency(
                (cierreData.totalVentasBrutas ?? totales.totalMonto) || 0,
              ),
            },
            {
              label: "Productos Vendidos",
              value: formatNumber(totales.totalCantidad),
            },
            {
              label: "Tipos de Productos",
              value: formatNumber(cierreData.productosVendidos.length),
            },
          ]}
        />

        {/* Quién vendió y de qué tipo de mercadería — datos que ya calculaba
            el backend (`totalVentasPorUsuario`) pero que esta pantalla nunca
            mostraba. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: isMobile ? 2 : 3,
          }}
        >
          <VentasSummaryCard
            title="Resumen de Ventas por Usuario"
            rows={cierreData.totalVentasPorUsuario.map((u) => ({
              id: u.id,
              label: u.nombre,
              value: u.total,
              icon: <PersonOutlineIcon fontSize="small" />,
            }))}
          />
          <VentasSummaryCard
            title="Resumen de Ventas por Tipo"
            rows={[
              {
                id: "propia",
                label: "Mercadería propia",
                value: cierreData.totalVentasPropias || 0,
                icon: <StorefrontOutlinedIcon fontSize="small" />,
              },
              {
                id: "consignacion",
                label: "Consignación",
                value: cierreData.totalVentasConsignacion || 0,
                icon: <HandshakeOutlinedIcon fontSize="small" />,
              },
            ]}
          />
        </Box>

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
                    initialFund={rm.initialFund}
                    tipCash={rm.tipCash}
                    tipTransfer={rm.tipTransfer}
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

        {/* Tabla de productos vendidos. `hideResumenes`: la banda de totales
            y los "Resumen de Ventas por..." de este componente ya se
            muestran arriba vía CierreTotalsCard/VentasSummaryCard — sin
            este flag quedaban duplicados. */}
        <TablaProductosCierre
          cierreData={cierreData}
          totales={totales}
          hideResumenes
          showOnlyCants={
            !verificarPermiso("operaciones.cierre.gananciascostos")
          }
          isProcessing={isProcessingCierre}
        />

        {/* En un teléfono, "Agregar gasto" y "Fondo inicial" dejan de ser
            botones de ícono apretados bajo el título y pasan a ocupar el
            ancho cómodo del contenido; "Cerrar caja" se muda a la barra fija
            de abajo, al alcance del pulgar. */}
        {isMobile && (showAdHocButton || showInitialFundButton) && (
          <Stack direction="row" spacing={1.25}>
            {showAdHocButton && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PostAddIcon />}
                onClick={() => setAdHocOpen(true)}
                sx={{ minHeight: 48 }}
              >
                Agregar gasto
              </Button>
            )}
            {showInitialFundButton && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SavingsIcon />}
                onClick={() => setInitialFundDialogOpen(true)}
                sx={{ minHeight: 48 }}
              >
                Fondo inicial
              </Button>
            )}
          </Stack>
        )}

        {/* Reserves the scroll space the fixed bar below occupies, so it
            never covers the last row of content. */}
        {isMobile && canCerrarCaja && (
          <Box sx={{ height: "calc(80px + env(safe-area-inset-bottom))" }} />
        )}

        {isMobile && canCerrarCaja && (
          <Box
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: (theme) => theme.zIndex.appBar,
              display: "flex",
              gap: 1.25,
              bgcolor: "background.paper",
              borderTop: 1,
              borderColor: "divider",
              px: 1.5,
              pt: 1.25,
              pb: "calc(12px + env(safe-area-inset-bottom))",
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={handleCerrarCaja}
              disabled={isProcessingCierre}
              sx={{ flex: 1, minHeight: 56 }}
            >
              {isProcessingCierre ? "Procesando..." : "Cerrar caja"}
            </Button>
            <IconButton
              onClick={getInitData}
              disabled={isDataLoading}
              sx={{
                flex: "0 0 auto",
                width: 56,
                height: 56,
                border: 1,
                borderColor: "divider",
                borderRadius: "12px",
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        )}

        <CerrarCajaConfirmDialog
          open={cerrarCajaDialogOpen}
          tiendaId={user.localActual.id}
          cierreId={currentPeriod.id}
          cierreData={cierreData}
          onClose={() => setCerrarCajaDialogOpen(false)}
          onConfirm={handleConfirmarCierre}
        />

        {canManageInitialFund && (
          <InitialCashFundDialog
            open={initialFundDialogOpen}
            tiendaId={user.localActual.id}
            cierreId={currentPeriod.id}
            monedasActivas={monedasNegocio}
            onClose={() => setInitialFundDialogOpen(false)}
            onSaved={getInitData}
          />
        )}

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
