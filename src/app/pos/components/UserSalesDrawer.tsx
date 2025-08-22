import React, { useMemo, useState } from "react";
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  ButtonGroup,
} from "@mui/material";
import { Close, History, GroupWork } from "@mui/icons-material";
import { useSalesStore } from "@/store/salesStore";
import { useAppContext } from "@/context/AppContext";

interface IProps {
  showUserSales: boolean;
  setShowUserSales: (show: boolean) => void;
}

export const UserSalesDrawer: React.FC<IProps> = ({
  showUserSales,
  setShowUserSales,
}) => {
  const { sales } = useSalesStore();
  const { user } = useAppContext();
  const [viewMode, setViewMode] = useState<'grouped' | 'historical'>('grouped');

  // Filtrar ventas del usuario actual
  const userSales = useMemo(() => {
    return sales.filter(sale => sale.usuarioId === user.id);
  }, [sales, user.id]);

  // Calcular totales y separar productos por consignación
  const salesData = useMemo(() => {
    let totalGeneral = 0;
    let totalConsignacion = 0;
    let totalPropios = 0;
    const productosConsignacion = [];
    const productosPropios = [];

    // Maps para agrupar productos
    const groupedConsignacion = new Map();
    const groupedPropios = new Map();

    userSales.forEach(sale => {
      totalGeneral += sale.total;

      sale.productos.forEach(producto => {
        const totalProducto = producto.price * producto.cantidad;

        const productoData = {
          nombre: producto.name,
          cantidad: producto.cantidad,
          precio: producto.price,
          total: totalProducto,
          fecha: new Date(sale.createdAt).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }),
          estado: sale.syncState === "synced" ? "Sincronizada" : sale.syncState === "syncing" ? "Sincronizando" : "Pendiente",
        };

        const isConsignacion = producto.name.includes(" - ");

        if (viewMode === 'grouped') {
          // Agrupar productos del mismo nombre
          const targetMap = isConsignacion ? groupedConsignacion : groupedPropios;

          if (targetMap.has(producto.name)) {
            const existing = targetMap.get(producto.name);
            existing.cantidad += producto.cantidad;
            existing.total += totalProducto;
            // Mantener precio promedio ponderado
            existing.precio = existing.total / existing.cantidad;
          } else {
            targetMap.set(producto.name, {
              nombre: producto.name,
              cantidad: producto.cantidad,
              precio: producto.price,
              total: totalProducto,
            });
          }
        } else {
          // Vista histórica (comportamiento actual)
          if (isConsignacion) {
            productosConsignacion.push(productoData);
          } else {
            productosPropios.push(productoData);
          }
        }

        if (isConsignacion) {
          totalConsignacion += totalProducto;
        } else {
          totalPropios += totalProducto;
        }
      });
    });

    // Convertir maps a arrays para vista agrupada
    if (viewMode === 'grouped') {
      productosConsignacion.push(...Array.from(groupedConsignacion.values()));
      productosPropios.push(...Array.from(groupedPropios.values()));
    }

    return {
      totalGeneral,
      totalConsignacion,
      totalPropios,
      productosConsignacion,
      productosPropios,
      cantidadVentas: userSales.length,
    };
  }, [userSales, viewMode]);

  return (
    <Drawer
      anchor="bottom"
      open={showUserSales}
      onClose={() => setShowUserSales(false)}
    >
      <Box
        sx={{
          width: "100vw",
          p: 2,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          bgcolor: "background.default",
        }}
      >
        {/* Botón de cerrar fijo */}
        <IconButton 
          onClick={() => setShowUserSales(false)} 
          color="default"
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 1000,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'background.default',
            }
          }}
        >
          <Close />
        </IconButton>

        {/* Header */}
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="flex-start"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5" fontWeight="bold" color="primary">
            Mis Ventas
          </Typography>
        </Box>

        {/* Totales generales */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <Typography variant="body2" color="textSecondary">
                  Total General
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  ${salesData.totalGeneral.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <Typography variant="body2" color="textSecondary">
                  Total Consignación
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="warning.main">
                  ${salesData.totalConsignacion.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <Typography variant="body2" color="textSecondary">
                  Total Propios
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  ${salesData.totalPropios.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Toggle de vista */}
        <Box display="flex" justifyContent="center" mb={3}>
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<GroupWork />}
              variant={viewMode === 'grouped' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grouped')}
            >
              Vista Agrupada
            </Button>
            <Button
              startIcon={<History />}
              variant={viewMode === 'historical' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('historical')}
            >
              Vista Histórica
            </Button>
          </ButtonGroup>
        </Box>

        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Typography variant="body2" color="textSecondary">
            {salesData.cantidadVentas} ventas realizadas
          </Typography>
        </Box>

        {/* Productos en Consignación */}
        {salesData.productosConsignacion.length > 0 && (
          <Box mb={3}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Typography variant="h6" fontWeight="bold">
                Productos en Consignación
              </Typography>
              <Chip 
                label={`${salesData.productosConsignacion.length} productos`} 
                size="small" 
                color="warning" 
                variant="outlined" 
              />
            </Box>
            <TableContainer component={Paper} elevation={1}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "warning.light" }}>
                    <TableCell><strong>Producto</strong></TableCell>
                    <TableCell align="center"><strong>Cantidad</strong></TableCell>
                    <TableCell align="right"><strong>Precio Unit.</strong></TableCell>
                    <TableCell align="right"><strong>Total</strong></TableCell>
                    {viewMode === 'historical' && (
                      <>
                        <TableCell align="center"><strong>Fecha</strong></TableCell>
                        <TableCell align="center"><strong>Estado</strong></TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesData.productosConsignacion.map((producto, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{producto.nombre}</TableCell>
                      <TableCell align="center">{producto.cantidad}</TableCell>
                      <TableCell align="right">${producto.precio.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          ${producto.total.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {viewMode === 'historical' && (
                        <>
                          <TableCell align="center">{producto.fecha}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={producto.estado}
                              size="small"
                              color={
                                producto.estado === "Sincronizada" ? "success" :
                                producto.estado === "Sincronizando" ? "info" : "warning"
                              }
                              variant="outlined"
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "warning.light" }}>
                    <TableCell colSpan={viewMode === 'grouped' ? 3 : 3}>
                      <Typography fontWeight="bold">Subtotal Consignación:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        ${salesData.totalConsignacion.toFixed(2)}
                      </Typography>
                    </TableCell>
                    {viewMode === 'historical' && <TableCell colSpan={2}></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Productos Propios */}
        {salesData.productosPropios.length > 0 && (
          <Box mb={3}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Typography variant="h6" fontWeight="bold">
                Productos Propios
              </Typography>
              <Chip 
                label={`${salesData.productosPropios.length} productos`} 
                size="small" 
                color="success" 
                variant="outlined" 
              />
            </Box>
            <TableContainer component={Paper} elevation={1}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "success.light" }}>
                    <TableCell><strong>Producto</strong></TableCell>
                    <TableCell align="center"><strong>Cantidad</strong></TableCell>
                    <TableCell align="right"><strong>Precio Unit.</strong></TableCell>
                    <TableCell align="right"><strong>Total</strong></TableCell>
                    {viewMode === 'historical' && (
                      <>
                        <TableCell align="center"><strong>Fecha</strong></TableCell>
                        <TableCell align="center"><strong>Estado</strong></TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesData.productosPropios.map((producto, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{producto.nombre}</TableCell>
                      <TableCell align="center">{producto.cantidad}</TableCell>
                      <TableCell align="right">${producto.precio.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          ${producto.total.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {viewMode === 'historical' && (
                        <>
                          <TableCell align="center">{producto.fecha}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={producto.estado}
                              size="small"
                              color={
                                producto.estado === "Sincronizada" ? "success" :
                                producto.estado === "Sincronizando" ? "info" : "warning"
                              }
                              variant="outlined"
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "success.light" }}>
                    <TableCell colSpan={viewMode === 'grouped' ? 3 : 3}>
                      <Typography fontWeight="bold">Subtotal Propios:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        ${salesData.totalPropios.toFixed(2)}
                      </Typography>
                    </TableCell>
                    {viewMode === 'historical' && <TableCell colSpan={2}></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Mensaje cuando no hay ventas */}
        {userSales.length === 0 && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            minHeight="300px"
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No tienes ventas registradas
            </Typography>
            <Typography variant="body2" color="textSecondary" textAlign="center">
              Cuando realices ventas, aparecerán aquí organizadas por tipo de producto.
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};
