"use client";

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
  Drawer,
  IconButton,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { getResumenCierres } from "@/services/resumenCierreService";
import { useAppContext } from "@/context/AppContext";
import { ICierreData, ICierrePeriodo, ISummaryCierre } from "@/types/ICierre";
import { ITotales, TablaProductosCierre } from "@/components/tablaProductosCierre/intex";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { Close } from "@mui/icons-material";
import { fetchCierreData } from "@/services/cierrePeriodService";

export default function ResumenCierrePage() {
  const [data, setData] = useState<ISummaryCierre>();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [totales, setTotales] = useState<{
    inversion: number;
    venta: number;
    ganancia: number;
    transf: number;
  }>({ inversion: 0, venta: 0, ganancia: 0, transf: 0 });
  const { user, loadingContext } = useAppContext();
  const [showProducts, setShowProducts] = useState(false);
  const [cierreProducData, setCierreProductData] = useState<{ciereData: ICierreData, totales: ITotales}>();
  

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        setNoTiendaActual(false);
        
        // Validar que el usuario tenga una tienda actual
        if (!user.tiendaActual || !user.tiendaActual.id) {
          setNoTiendaActual(true);
          setLoading(false);
          return;
        }

        const tiendaId = user.tiendaActual.id;
        let dataResp;
        if (startDate || endDate) {
          const intervalo = {
            ...(startDate && { fechaInicio: startDate.toDate() }),
            ...(endDate && { fechaFin: endDate.toDate() }),
          };
          dataResp = await getResumenCierres(
            tiendaId,
            rowsPerPage,
            page * rowsPerPage,
            intervalo
          );
        } else {
          dataResp = await getResumenCierres(
            tiendaId,
            rowsPerPage,
            page * rowsPerPage
          );
        }
        setData(dataResp);
        setTotales(
          dataResp.cierres.reduce(
            (acc, row) => {
              acc.inversion += row.totalInversion;
              acc.venta += row.totalVentas;
              acc.ganancia += row.totalGanancia;
              acc.transf += row.totalTransferencia
              return acc;
            },
            { inversion: 0, venta: 0, ganancia: 0, transf: 0 }
          )
        );
        setLoading(false);
      }
    })();
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
  };

  const handleViewMore = async (itemCierre: Omit<ICierrePeriodo, "tienda">) => {
    const tiendaId = user.tiendaActual.id;
    const cierreData = await fetchCierreData(tiendaId, itemCierre.id);

    const totales = {
      totalCantidad: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.cantidad,
        0
      ),
      totalGanancia: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.ganancia,
        0
      ),
      totalMonto: cierreData.productosVendidos.reduce(
        (acc, p) => acc + p.total,
        0
      )
    };

    setCierreProductData({
      ciereData: {
        productosVendidos: cierreData.productosVendidos,
        totalGanancia: itemCierre.totalGanancia,
        totalVentas: itemCierre.totalVentas,
        totalTransferencia: itemCierre.totalTransferencia
      },
      totales: totales
    });
    setShowProducts(true);
  };

  if (loadingContext || loading) {
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
          Resumen de Cierres
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver el resumen de cierres, necesitas tener una tienda seleccionada como tienda actual.
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

  if (!data || data.cierres.length === 0) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Resumen de Cierres
        </Typography>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            No hay cierres históricos disponibles
          </Typography>
          <Typography variant="body1" gutterBottom>
            Una vez que realices tu primer cierre de caja, los resúmenes históricos 
            aparecerán aquí para que puedas analizar el desempeño de tu negocio.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Los cierres se realizan desde la sección "Cierre de Caja" cuando terminas 
            tu jornada de ventas.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Resumen de Cierres
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <DatePicker
            label="Fecha inicio"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DatePicker
            label="Fecha fin"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Button
            variant="outlined"
            onClick={handleLimpiarFiltrod}
            sx={{ height: "56px", width: "100%" }}
          >
            Limpiar Filtros
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
              <TableCell>Transf</TableCell>
              <TableCell>Ganancia</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.cierres.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {dayjs(row.fechaInicio).format("DD/MM/YYYY")}
                </TableCell>
                <TableCell>
                  {row.fechaFin ? dayjs(row.fechaFin).format("DD/MM/YYYY") : ""}
                </TableCell>
                <TableCell>${row.totalInversion.toFixed(2)}</TableCell>
                <TableCell>${row.totalVentas.toFixed(2)}</TableCell>
                <TableCell>${row.totalTransferencia.toFixed(2)}</TableCell>
                <TableCell>${row.totalGanancia.toFixed(2)}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleViewMore(row)}
                    color="primary"
                  >
                    <ZoomInIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2}>
                <strong>Totales</strong>
              </TableCell>
              <TableCell>
                <strong>${totales.inversion.toFixed(2)}</strong>
              </TableCell>
              <TableCell>
                <strong>${totales.venta.toFixed(2)}</strong>
              </TableCell>
              <TableCell>
                <strong>${totales.transf.toFixed(2)}</strong>
              </TableCell>
              <TableCell>
                <strong>${totales.ganancia.toFixed(2)}</strong>
              </TableCell>
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

      {cierreProducData && (
        <Drawer
          anchor="bottom"
          open={showProducts}
          onClose={() => setShowProducts(false)}
        >
          <Box
            sx={{
              width: "100vw",
              p: 2,
              display: "flex",
              flexDirection: "column",
              height: "100vh",
            }}
          >
            <Box display={"flex"} flexDirection={"row"} justifyContent={"end"}>
              <IconButton
                onClick={() => setShowProducts(false)}
                color="default"
              >
                <Close />
              </IconButton>
            </Box>
            <TablaProductosCierre
              cierreData={cierreProducData.ciereData}
              totales={cierreProducData.totales}
            />
          </Box>
        </Drawer>
      )}
    </Box>
  );
}
