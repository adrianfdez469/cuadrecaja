"use client"

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
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { getResumenCierres } from "@/services/resumenCierreService";
import { useAppContext } from "@/context/AppContext";
import { ISummaryCierre } from "@/types/ICierre";

export default function ResumenCierrePage() {
  const [data, setData] = useState<ISummaryCierre>();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [totales, setTotales] = useState<{ inversion: number, venta: number, ganancia: number }>({ inversion: 0, venta: 0, ganancia: 0 });
  const { user, loadingContext } = useAppContext();

  useEffect(() => {
    
    (async () => {

      console.log('useEffect resumen cierre');
      
      if(!loadingContext){

        const tiendaId = user.tiendaActual.id;
        let dataResp;
        if(startDate || endDate) {
          const intervalo = {
            ...(startDate && {fechaInicio: startDate.toDate()}),
            ...(endDate && {fechaFin: endDate.toDate()})
          }
          dataResp = await getResumenCierres( tiendaId, rowsPerPage, page*rowsPerPage, intervalo );
        } else {
          dataResp = await getResumenCierres( tiendaId, rowsPerPage, page*rowsPerPage );

        }
        setData(dataResp);
        setTotales(dataResp.cierres.reduce(
          (acc, row) => {
            acc.inversion += row.totalInversion;
            acc.venta += row.totalVentas;
            acc.ganancia += row.totalGanancia;
            return acc;
          },
          { inversion: 0, venta: 0, ganancia: 0 }
        ));
        setLoading(false);
      }
    })()

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
  }

  if (loadingContext || loading) {
    return <CircularProgress />;
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Resumen de Cierres
      </Typography>

      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} sm={6} md={3}>
          <DatePicker
            label="Desde"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DatePicker
            label="Hasta"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            formatDensity="dense"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} alignSelf="center">
          <Button variant="contained" size="large" onClick={() => handleLimpiarFiltrod()}>
            Limpiar filtros
          </Button>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Inicio</TableCell>
              <TableCell>Fin</TableCell>
              <TableCell>Inversión</TableCell>
              <TableCell>Venta</TableCell>
              <TableCell>Ganancia</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.cierres.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{dayjs(row.fechaInicio).format("DD/MM/YYYY")}</TableCell>
                <TableCell>{row.fechaFin ? dayjs(row.fechaFin).format("DD/MM/YYYY") : ''}</TableCell>
                <TableCell>${row.totalInversion.toFixed(2)}</TableCell>
                <TableCell>${row.totalVentas.toFixed(2)}</TableCell>
                <TableCell>${row.totalGanancia.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2}><strong>Totales</strong></TableCell>
              <TableCell><strong>${totales.inversion.toFixed(2)}</strong></TableCell>
              <TableCell><strong>${totales.venta.toFixed(2)}</strong></TableCell>
              <TableCell><strong>${totales.ganancia.toFixed(2)}</strong></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data.totalItems}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>
    </Box>
  );
} 
