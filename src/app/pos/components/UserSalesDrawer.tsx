import React, { useMemo, useState } from "react";
import {
  Box,
  Collapse,
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
  CardActionArea,
  Grid,
  Chip,
  Button,
  ButtonGroup,
  CircularProgress,
} from "@mui/material";
import { Close, History, GroupWork, Delete, ExpandLess, ExpandMore } from "@mui/icons-material";
import { Sale, useSalesStore } from "@/store/salesStore";
import { useAppContext } from "@/context/AppContext";
import { usePermisos } from "@/utils/permisos_front";
import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { removeProductFromSale } from "@/services/sellService";
import { ICierrePeriodo } from "@/schemas/cierre";
import { ITransferDestination } from "@/schemas/transferDestination";
import {formatDateTime} from "@/utils/formatters";

interface IProps {
  showUserSales: boolean;
  setShowUserSales: (show: boolean) => void;
  period?: ICierrePeriodo;
  incrementarCantidades?: (productoTiendaId: string, cantidad: number) => void;
  transferDestinations?: ITransferDestination[];
}

interface ProductoDataHistorial {
  nombre: string;
  cantidad: number;
  precio: number;
  total: number;
  fecha: string;
  estado: string;
  sale: Sale;
  product: Sale["productos"][0];
  productIndex: number;
}

export const UserSalesDrawer: React.FC<IProps> = ({
  showUserSales,
  setShowUserSales,
  period,
  incrementarCantidades,
  transferDestinations,
}) => {
  const { sales, removeProductFromSale: removeProductFromSaleStore } = useSalesStore();
  const { user } = useAppContext();
  const { verificarPermiso } = usePermisos();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const [viewMode, setViewMode] = useState<'grouped' | 'historical'>('grouped');
  const [onlyOwnSales, setOnlyOwnSales] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [transferExpanded, setTransferExpanded] = useState(false);

  const canDeleteProducts =
    viewMode === "historical" &&
    verificarPermiso("operaciones.pos-venta.cancelarventa") &&
    (onlyOwnSales || user?.rol === "SUPER_ADMIN");

  const handleDeleteProduct = (producto: ProductoDataHistorial) => {
    const { sale, product } = producto;
    confirmDialog(
      `¿Eliminar "${product.name}" (${product.cantidad} unidad/es) de la venta?`,
      async () => {
        const key = product.ventaProductoId ?? `${sale.identifier}-${product.productoTiendaId}`;
        setDeletingKey(key);
        try {
          if (sale.synced && sale.dbId && product.ventaProductoId && period && user?.localActual?.id) {
            await removeProductFromSale(
              user.localActual.id,
              period.id,
              sale.dbId,
              product.ventaProductoId
            );
          }
          removeProductFromSaleStore(
            sale.identifier,
            product.productoTiendaId,
            product.productId,
            product.cantidad,
            product.ventaProductoId,
            producto.productIndex
          );
          incrementarCantidades?.(product.productoTiendaId, product.cantidad);
          showMessage("Producto eliminado de la venta", "success");
        } catch (error) {
          console.error(error);
          showMessage("No se pudo eliminar el producto", "error", error);
        } finally {
          setDeletingKey(null);
        }
      }
    );
  };

  // Filtrar ventas del usuario actual
  const userSales = useMemo(() => {
    return onlyOwnSales ? sales.filter(sale => sale.usuarioId === user.id) : sales;
  }, [sales, user.id, onlyOwnSales]);

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

    // Desglose de transferencias por destino
    const transfersByDestination = new Map<string, { nombre: string; total: number }>();

    userSales.forEach(sale => {
      totalGeneral += sale.total;

      if (sale.totaltransfer > 0) {
        const destId = sale.transferDestinationId || "__sin_destino__";
        const nombre = transferDestinations?.find(d => d.id === destId)?.nombre ?? "Sin destino";
        const existing = transfersByDestination.get(destId);
        if (existing) {
          existing.total += sale.totaltransfer;
        } else {
          transfersByDestination.set(destId, { nombre, total: sale.totaltransfer });
        }
      }

      sale.productos.forEach((producto, productIndex) => {
        const totalProducto = producto.price * producto.cantidad;

        const productoDataHistorial: ProductoDataHistorial = {
          nombre: producto.name,
          cantidad: producto.cantidad,
          precio: producto.price,
          total: totalProducto,
          fecha: formatDateTime(sale.createdAt),
          estado: sale.syncState === "synced" ? "Sincronizada" : sale.syncState === "syncing" ? "Sincronizando" : "Pendiente",
          sale,
          product: producto,
          productIndex,
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
          // Vista histórica
          if (isConsignacion) {
            productosConsignacion.push(productoDataHistorial);
          } else {
            productosPropios.push(productoDataHistorial);
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
      transfersByDestination,
    };
  }, [userSales, viewMode, transferDestinations]);

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
          pt: "calc(16px + env(safe-area-inset-top))",
          pb: "calc(16px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          bgcolor: "background.default",
          position: 'relative',
        }}
      >
        {/* Botón de cerrar fijo (Relativo al contenedor principal) */}
        <IconButton
          onClick={() => setShowUserSales(false)}
          color="default"
          sx={{
            position: 'absolute',
            top: "calc(16px + env(safe-area-inset-top))",
            right: 16,
            zIndex: 10,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'background.default',
            }
          }}
        >
          <Close />
        </IconButton>

        {/* Barra Superior Fija */}
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="flex-start"
          alignItems="center"
          sx={{
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 2
          }}
        >
          <Typography variant="h5" fontWeight="bold" color="primary">
            Mis Ventas
          </Typography>
        </Box>

        {/* Contenido Scrollable */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5 }}>
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

          {/* Tarjeta de transferencias (colapsable por destino) */}
          {salesData.transfersByDestination.size > 0 && (() => {
            const totalTransferencias = Array.from(salesData.transfersByDestination.values())
              .reduce((sum, d) => sum + d.total, 0);
            return (
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={4}>
                  <Card elevation={2}>
                    <CardActionArea onClick={() => setTransferExpanded(prev => !prev)}>
                      <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                        <Box display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                          <Typography variant="body2" color="textSecondary">
                            Total Transferencias
                          </Typography>
                          {transferExpanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="info.main">
                          ${totalTransferencias.toFixed(2)}
                        </Typography>
                        <Collapse in={transferExpanded}>
                          <Box mt={1} textAlign="left">
                            {Array.from(salesData.transfersByDestination.values()).map(dest => (
                              <Box key={dest.nombre} display="flex" justifyContent="space-between" px={1} py={0.25}>
                                <Typography variant="caption" color="textSecondary">{dest.nombre}</Typography>
                                <Typography variant="caption" fontWeight="bold">${dest.total.toFixed(2)}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Collapse>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              </Grid>
            );
          })()}

          {/* Toggle de vista y filtro de usuario */}
          <Box display="flex" justifyContent="center" alignItems="center" mb={3} gap={2} flexWrap="wrap">
            {/* Toggle para filtrar ventas del usuario o todas */}
            <ButtonGroup variant="outlined" size="small">
              <Button
                variant={onlyOwnSales ? 'contained' : 'outlined'}
                color="primary"
                onClick={() => setOnlyOwnSales(true)}
              >
                Mis ventas
              </Button>
              <Button
                variant={!onlyOwnSales ? 'contained' : 'outlined'}
                color="primary"
                onClick={() => setOnlyOwnSales(false)}
              >
                Todas
              </Button>
            </ButtonGroup>
            {/* Toggle de vista */}
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
                          {canDeleteProducts && <TableCell align="center"><strong>Acciones</strong></TableCell>}
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesData.productosConsignacion.map((producto, index) => {
                      const prodHist = producto as ProductoDataHistorial;
                      const deleteKey = 'sale' in prodHist ? (prodHist.product.ventaProductoId ?? `${prodHist.sale.identifier}-${index}`) : null;
                      return (
                      <TableRow key={index} hover>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell align="center">{producto.cantidad}</TableCell>
                        <TableCell align="right">${producto?.precio?.toFixed(2)}</TableCell>
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
                            {canDeleteProducts && 'sale' in prodHist && (
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={deletingKey === deleteKey || prodHist.sale.productos.length <= 1}
                                  onClick={() => handleDeleteProduct(prodHist)}
                                  aria-label="Eliminar producto"
                                >
                                  {deletingKey === deleteKey ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <Delete fontSize="small" />
                                  )}
                                </IconButton>
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    );})}
                    <TableRow sx={{ bgcolor: "warning.light" }}>
                      <TableCell colSpan={viewMode === 'grouped' ? 3 : canDeleteProducts ? 6 : 5}>
                        <Typography fontWeight="bold">Subtotal Consignación:</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          ${salesData.totalConsignacion.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {viewMode === 'historical' && canDeleteProducts && <TableCell />}
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
                          {canDeleteProducts && <TableCell align="center"><strong>Acciones</strong></TableCell>}
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesData.productosPropios.map((producto, index) => {
                      const prodHist = producto as ProductoDataHistorial;
                      const deleteKey = 'sale' in prodHist ? (prodHist.product.ventaProductoId ?? `${prodHist.sale.identifier}-${index}`) : null;
                      return (
                      <TableRow key={index} hover>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell align="center">{producto.cantidad}</TableCell>
                        <TableCell align="right">${producto.precio?.toFixed(2)}</TableCell>
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
                            {canDeleteProducts && 'sale' in prodHist && (
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={deletingKey === deleteKey || prodHist.sale.productos.length <= 1}
                                  onClick={() => handleDeleteProduct(prodHist)}
                                  aria-label="Eliminar producto"
                                >
                                  {deletingKey === deleteKey ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <Delete fontSize="small" />
                                  )}
                                </IconButton>
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    );})}
                    <TableRow sx={{ bgcolor: "success.light" }}>
                      <TableCell colSpan={viewMode === 'grouped' ? 3 : canDeleteProducts ? 6 : 5}>
                        <Typography fontWeight="bold">Subtotal Propios:</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          ${salesData.totalPropios.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {viewMode === 'historical' && canDeleteProducts && <TableCell />}
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
      </Box>
      {ConfirmDialogComponent}
    </Drawer>
  );
};

export default UserSalesDrawer;
