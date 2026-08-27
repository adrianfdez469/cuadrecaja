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
      {canManageInitialFund && currentPeriod && !currentPeriod.fechaFin && (
        <Button
          variant="outlined"
          size={isMobile ? "small" : "medium"}
          startIcon={<SavingsIcon />}
          onClick={() => setInitialFundDialogOpen(true)}
        >
          {isMobile ? "Fondo" : "Fondo inicial"}
        </Button>
      )}
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

        {/* One scale for the period's figures. They were seven identical white
            tiles, each with its own tinted icon, so nothing ranked: the amount
            sold read exactly like the count of product types. */}
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
            {
              label: "Ventas Propias (Bruto)",
              value: formatCurrency(cierreData.totalVentasPropias || 0),
            },
            {
              label: "Ventas Consignación",
              value: formatCurrency(cierreData.totalVentasConsignacion || 0),
            },
            ...(typeof cierreData.totalDescuentos === "number" &&
            (cierreData.totalDescuentos || 0) > 0
              ? [
                  {
                    label: "Descuentos del Período",
                    value: formatCurrency(cierreData.totalDescuentos || 0),
                    tone: "negative" as const,
                  },
                ]
              : []),
          ]}
        />

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
