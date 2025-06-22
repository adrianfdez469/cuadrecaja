"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import { closePeriod, fetchCierreData, openPeriod } from "@/services/cierrePeriodService";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierreData, ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { ITotales, TablaProductosCierre } from "@/components/tablaProductosCierre/intex";
import { useSalesStore } from "@/store/salesStore";

const CierreCajaPage = () => {
  const { user, loadingContext } = useAppContext();
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
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { clearSales, sales } = useSalesStore();

  const handleCerrarCaja = async () => {
    if(sales.filter(sale => !sale.synced).length > 0) {
      showMessage("Debe sincronizar las ventas en la interfaz del pos de ventas", "warning");
    } else {
      confirmDialog("¿Estás seguro de desea realizar el cierre de caja?", async () => {
        // Se debe crear un nuevo cierre
        const tiendaId = user.tiendaActual.id;
        try {
          await closePeriod(tiendaId, currentPeriod.id);
          clearSales();
          await openPeriod(tiendaId);        
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
      const tiendaId = user.tiendaActual.id;
      await openPeriod(tiendaId);
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
    setNoTiendaActual(false);
    
    try {
      // Validar que el usuario tenga una tienda actual
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
      const data = await fetchCierreData(tiendaId, currentPeriod.id);
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

  if (loadingContext || isDataLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (noTiendaActual) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Cierre de Caja
        </Typography>
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
              href="/configuracion/tiendas"
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  if (noPeriodFound) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Cierre de Caja
        </Typography>
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
      </Box>
    );
  }

  if (cierreData && currentPeriod) {
    return (
      <Box p={0}>
        <Typography variant="h4" gutterBottom>
          Cierre de Caja: Corte {new Date(currentPeriod.fechaInicio).toLocaleDateString()}
        </Typography>
        <TablaProductosCierre
          cierreData={cierreData}
          totales={totales}
          handleCerrarCaja={handleCerrarCaja}
        />
        {ConfirmDialogComponent}
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Alert severity="error">
        Error al cargar los datos de cierre. Por favor, intenta recargar la página.
      </Alert>
    </Box>
  );
};

export default CierreCajaPage;
