import React, { useMemo } from "react";
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
} from "@mui/material";
import { Close } from "@mui/icons-material";
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

    userSales.forEach(sale => {
      totalGeneral += sale.total;

      sale.productos.forEach(producto => {
        const productoData = {
          nombre: producto.name,
          cantidad: producto.cantidad,
          precio: sale.total / sale.productos.reduce((sum, p) => sum + p.cantidad, 0), // Precio promedio
          total: (sale.total / sale.productos.reduce((sum, p) => sum + p.cantidad, 0)) * producto.cantidad,
          fecha: new Date(sale.createdAt).toLocaleDateString(),
          estado: sale.syncState === "synced" ? "Sincronizada" : sale.syncState === "syncing" ? "Sincronizando" : "Pendiente",
        };

        // Aquí necesitarías lógica para determinar si es consignación o propio
        // Por simplicidad, asumo que productos con proveedorId son consignación
        // Esto debería ajustarse según tu lógica de negocio
        if (producto.name.includes(" - ")) { // Productos con proveedor (consignación)
          productosConsignacion.push(productoData);
          totalConsignacion += productoData.total;
        } else { // Productos propios
          productosPropios.push(productoData);
          totalPropios += productoData.total;
        }
      });
    });

    return {
      totalGeneral,
      totalConsignacion,
      totalPropios,
      productosConsignacion,
      productosPropios,
      cantidadVentas: userSales.length,
    };
  }, [userSales]);

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
        {/* Header */}
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5" fontWeight="bold" color="primary">
            Mis Ventas
          </Typography>
          <IconButton onClick={() => setShowUserSales(false)} color="default">
            <Close />
          </IconButton>
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
                    <TableCell align="center"><strong>Fecha</strong></TableCell>
                    <TableCell align="center"><strong>Estado</strong></TableCell>
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
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "warning.light" }}>
                    <TableCell colSpan={3}>
                      <Typography fontWeight="bold">Subtotal Consignación:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        ${salesData.totalConsignacion.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
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
                    <TableCell align="center"><strong>Fecha</strong></TableCell>
                    <TableCell align="center"><strong>Estado</strong></TableCell>
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
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "success.light" }}>
                    <TableCell colSpan={3}>
                      <Typography fontWeight="bold">Subtotal Propios:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        ${salesData.totalPropios.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
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
