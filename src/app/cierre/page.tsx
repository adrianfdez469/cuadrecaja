"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
} from "@mui/material";
import { closePeriod, fetchCierreData, openPeriod } from "@/services/cierrePeriodService";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierreData, ICierrePeriodo } from "@/types/ICierre";

interface ITotales {
  totalCantidad: number;
  totalMonto: number;
  totalGanancia: number;
}

const CierreCajaPage = () => {
  const [tab, setTab] = useState(0);
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

  const handleChangeTab = (event, newValue) => {
    setTab(newValue);
  };

  const handleCerrarCaja = async () => {
    // Se debe crear un nuevo cierre

    const tiendaId = user.tiendaActual.id;
    await closePeriod(tiendaId, currentPeriod.id);
    await openPeriod(tiendaId);
    await getInitData();
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
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Cierre de Caja: Corte {new Date(currentPeriod.fechaInicio).toLocaleDateString()}
        </Typography>
  
        <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'row', justifyContent:'space-between'}}>
          <Box>
            <Typography variant="h6">
              Total Venta: ${cierreData.totalVentas.toFixed(2)}
            </Typography>
            <Typography variant="h6">
              Total Ganancia: ${cierreData.totalGanancia.toFixed(2)}
            </Typography>
          </Box>

          <Button variant="contained" onClick={handleCerrarCaja}>Cerrar caja</Button>
        </Paper>
  
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Productos Vendidos" />
        </Tabs>
  
        {tab === 0 && (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Costo</TableCell>
                  <TableCell>Precio</TableCell>
                  <TableCell>Cantidad</TableCell>
                  <TableCell>Venta</TableCell>
                  <TableCell>Ganancia</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cierreData.productosVendidos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell>{producto.nombre}</TableCell>
                    <TableCell>${producto.costo.toFixed(2)}</TableCell>
                    <TableCell>${producto.precio.toFixed(2)}</TableCell>
                    <TableCell>{producto.cantidad}</TableCell>
                    <TableCell>${producto.total?.toFixed(2)}</TableCell>
                    <TableCell>${producto.ganancia.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  <TableCell>Total</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell>{totales.totalCantidad}</TableCell>
                  <TableCell>${totales.totalMonto.toFixed(2)}</TableCell>
                  <TableCell>${totales.totalGanancia.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }
};

export default CierreCajaPage;
