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
} from "@mui/material";
import { closePeriod, fetchCierreData, openPeriod } from "@/services/cierrePeriodService";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierreData, ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { ITotales, TablaProductosCierre } from "@/components/tablaProductosCierre/intex";
import { useSalesStore } from "@/store/salesStore";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import RefreshIcon from "@mui/icons-material/Refresh";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import InventoryIcon from "@mui/icons-material/Inventory";
import StoreIcon from "@mui/icons-material/Store";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { formatDate, formatCurrency, formatNumber } from '@/utils/formatters';

const CierreCajaPage = () => {
  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>()
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [cierreData, setCierreData] = useState<ICierreData>();
  const [totales, setTotales] = useState<ITotales>({
    totalCantidad: 0,
    totalGanancia: 0,
    totalMonto: 0,
  });
  const [noPeriodFound, setNoPeriodFound] = useState(false);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { clearSales, sales } = useSalesStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));


  const isAdminOrSuperAdmin = () => {
    return user.rol === 'ADMIN' || user.rol === 'SUPER_ADMIN';
  }

  const handleCerrarCaja = async () => {
    if(sales.filter(sale => !sale.synced).length > 0) {
      showMessage("Debe sincronizar las ventas en la interfaz del pos de ventas", "warning");
    } else {
      confirmDialog("¿Estás seguro de desea realizar el cierre de caja?", async () => {
        // Se debe crear un nuevo cierre
        const localId = user.localActual.id;
        try {
          await closePeriod(localId, currentPeriod.id);
          clearSales();
          await openPeriod(localId);        
        } catch (error) {
          console.log(error);
          showMessage('Ah ocurrido un error', 'error');
        } finally {
          await getInitData();    
        }
      });
    }
  };

  const handleCreateFirstPeriod = async () => {
    try {
      setIsDataLoading(true);
      const localId = user.localActual.id;
      await openPeriod(localId);
      await getInitData();
      showMessage("Primer período creado exitosamente", "success");
    } catch (error) {
      console.log(error);
      showMessage("Error al crear el primer período", "error");
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
      const data = await fetchCierreData(localId, currentPeriod.id);
      console.log(data);
      setCierreData(data);

      setTotales({
        totalCantidad: data.productosVendidos.reduce(
          (acc, p) => acc + p.cantidad,
          0
        ),
        totalGanancia: data.productosVendidos.reduce(
          (acc, p) => acc + p.ganancia,
          0
        ),
        totalMonto: data.productosVendidos.reduce(
          (acc, p) => acc + p.total,
          0
        ),
      });
    } catch (error) {
      console.log(error);
      showMessage(
        "Error: los datos de cierre no puediron ser cargados",
        "error"
      );
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
  const StatCard = ({ icon, value, label, color }: { 
    icon: React.ReactNode, 
    value: string, 
    label: string, 
    color: string 
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
    { label: 'Cierre de Caja' }
  ];

  const headerActions = (
    <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
      <Tooltip title="Actualizar datos">
        <IconButton onClick={getInitData} disabled={isDataLoading} size={isMobile ? "small" : "medium"}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (loadingContext || isDataLoading) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle="Gestión y control de cierres de período"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
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
            Para realizar cierres de caja, necesitas tener una tienda seleccionada como tienda actual.
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
            No se encontraron períodos de cierre. Para comenzar a usar el sistema de punto de venta 
            y realizar cierres de caja, necesitas crear tu primer período.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Un período de cierre te permite controlar las ventas y realizar cortes de caja organizados por fechas.
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

  if (cierreData && currentPeriod) {
    return (
      <PageContainer
        title="Cierre de Caja"
        subtitle={`Período del ${formatDate(currentPeriod.fechaInicio)}`}
        breadcrumbs={breadcrumbs}
        headerActions={headerActions}
        maxWidth="xl"
      >
        {/* Estadísticas del cierre */}
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
          
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
              value={formatCurrency(totales.totalMonto)}
              label="Total Ventas"
              color="success.light"
            />
          </Grid>

          {isAdminOrSuperAdmin() && (
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                icon={<TrendingUpIcon fontSize={"medium"} />}
                value={formatCurrency(totales.totalGanancia)}
                label="Ganancia Total"
                color="info.light"
              />
            </Grid>
          )}

          {/* NUEVAS ESTADÍSTICAS DE CONSIGNACIÓN */}
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<StoreIcon fontSize={"medium"} />}
              value={formatCurrency(cierreData.totalVentasPropias || 0)}
              label="Ventas Propias"
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

        {/* Tabla de productos vendidos */}
        <ContentCard 
          title="Detalle de Productos Vendidos"
          subtitle={!isMobile ? "Resumen completo de las ventas del período actual" : undefined}
          noPadding
          fullHeight
        >
          <TablaProductosCierre
            cierreData={cierreData}
            totales={totales}
            handleCerrarCaja={handleCerrarCaja}
            showOnlyCants={false}
          />
        </ContentCard>
        
        {ConfirmDialogComponent}
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
        Error al cargar los datos de cierre. Por favor, intenta recargar la página.
      </Alert>
    </PageContainer>
  );
};

export default CierreCajaPage;
