"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import { closePeriod, fetchCierreData, openPeriod } from "@/services/cierrePeriodService";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierreData, ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { ITotales, TablaProductosCierre } from "@/components/tablaProductosCierre/intex";

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
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();


  const handleCerrarCaja = async () => {

    confirmDialog("¿Estás seguro de desea realizar el cierre de caja?", async () => {
      // Se debe crear un nuevo cierre
      const tiendaId = user.tiendaActual.id;
      try {
        await closePeriod(tiendaId, currentPeriod.id);
        await openPeriod(tiendaId);        
      } catch (error) {
        console.log(error);
        showMessage('Ah ocurrido un error', 'error');
      } finally {
        await getInitData();    
      }
    });
  };

  const getInitData = async () => {
    setIsDataLoading(true);
    try {
      const tiendaId = user.tiendaActual.id;
      const currentPeriod = await fetchLastPeriod(tiendaId);
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
    getInitData();
  }, []);

  if (loadingContext || isDataLoading) {
    return <CircularProgress />;
  }
  if (cierreData) {
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
};

export default CierreCajaPage;
