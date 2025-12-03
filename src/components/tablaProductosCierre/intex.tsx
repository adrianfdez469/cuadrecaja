import React, { FC, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StoreIcon from "@mui/icons-material/Store";
import HandshakeIcon from "@mui/icons-material/Handshake";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { ICierreData } from "@/types/ICierre";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";
import {
  exportProductosVendidosToExcel,
  exportProductosPropiosToExcel,
  exportProductosProveedorToExcel
} from "@/utils/excelExport";
import { useMessageContext } from "@/context/MessageContext";
import theme from "@/theme";

// Tipos específicos para los productos
interface ProductoVendido {
  id: string;
  nombre: string;
  costo: number;
  precio: number;
  cantidad: number;
  total: number;
  ganancia: number;
  productoId: string;
  proveedor?: {
    id: string;
    nombre: string;
  };
}

interface ProductoAgrupado {
  productoId: string;
  items: ProductoVendido[];
  nombre: string;
}

export interface ITotales {
  totalCantidad: number;
  totalMonto: number;
  totalGanancia: number;
  // totalTransferencia: number;
}

interface IProps {
  cierreData: ICierreData;
  totales: ITotales;
  handleCerrarCaja?: () => Promise<void>;
  hideTotales?: boolean;
  showOnlyCants?: boolean;
}

export const TablaProductosCierre: FC<IProps> = ({
  cierreData,
  totales,
  handleCerrarCaja,
  hideTotales,
  showOnlyCants,
}) => {
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const [disableCierreBtn, setDisableCierreBtn] = useState(false);
  const [expandedPropios, setExpandedPropios] = useState(true);
  const [expandedConsignacion, setExpandedConsignacion] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorElPropios, setAnchorElPropios] = useState<null | HTMLElement>(null);
  const [anchorElConsignacion, setAnchorElConsignacion] = useState<null | HTMLElement>(null);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleCierre = async () => {
    if (handleCerrarCaja) {
      setDisableCierreBtn(true);
      await handleCerrarCaja();
      setDisableCierreBtn(false);
    }
  };

  // Funciones de exportación
  const handleExportAll = async () => {
    try {
      setExporting(true);
      await exportProductosVendidosToExcel({
        cierreData,
        tiendaNombre: user.localActual.nombre,
        fechaInicio: new Date(), // Esto debería venir del cierre
        fechaFin: new Date()
      });
      showMessage("Archivo Excel exportado exitosamente", "success");
    } catch (error) {
      console.error("Error al exportar:", error);
      showMessage("Error al exportar el archivo Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPropios = async () => {
    try {
      setExporting(true);
      await exportProductosPropiosToExcel({
        cierreData,
        tiendaNombre: user.localActual.nombre,
        fechaInicio: new Date(),
        fechaFin: new Date()
      });
      showMessage("Productos propios exportados exitosamente", "success");
    } catch (error) {
      console.error("Error al exportar productos propios:", error);
      showMessage("Error al exportar productos propios", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportProveedor = async (proveedorId: string) => {
    try {
      setExporting(true);
      await exportProductosProveedorToExcel({
        cierreData,
        tiendaNombre: user.localActual.nombre,
        fechaInicio: new Date(),
        fechaFin: new Date(),
        proveedorId
      });
      showMessage("Productos del proveedor exportados exitosamente", "success");
    } catch (error) {
      console.error("Error al exportar productos del proveedor:", error);
      showMessage("Error al exportar productos del proveedor", "error");
    } finally {
      setExporting(false);
    }
  };

  // Funciones para manejar menús
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuPropiosOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElPropios(event.currentTarget);
  };

  const handleMenuPropiosClose = () => {
    setAnchorElPropios(null);
  };

  const handleMenuConsignacionOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElConsignacion(event.currentTarget);
  };

  const handleMenuConsignacionClose = () => {
    setAnchorElConsignacion(null);
  };

  const {
    totalVentas,
    totalGanancia,
    totalTransferencia,
    // Totales ampliados desde el backend
    totalVentasBrutas,
    totalDescuentos,
    totalVentasPropias,
    totalVentasConsignacion,
    totalGananciasPropias,
    totalGananciasConsignacion,
    productosVendidos,
    totalTransferenciasByDestination,
    totalVentasPorUsuario
  } = cierreData;
  // Obtener proveedores únicos para el menú de consignación
  const proveedoresUnicos = Array.from(
    new Map(
      productosVendidos
        .filter(p => p.proveedor)
        .map(p => [p.proveedor!.id, { id: p.proveedor!.id, nombre: p.proveedor!.nombre }])
    ).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totalVentasPorProveedor = Object.values(
    productosVendidos.reduce((acc, prod) => {
      if (prod.proveedor) {
        if (acc[prod.proveedor.id]) {
          acc[prod.proveedor.id] = {
            ...acc[prod.proveedor.id],
            total: acc[prod.proveedor.id].total + prod.total,
            ganancia: acc[prod.proveedor.id].ganancia + prod.ganancia
          }
        } else {
          acc[prod.proveedor.id] = {
            id: prod.proveedor.id,
            nombre: prod.proveedor.nombre,
            total: prod.total,
            ganancia: prod.ganancia
          }
        }
      }
      return acc;
    }, {})
  )
  console.log('totalVentasPorProveedor', totalVentasPorProveedor);
  

  // Función para renderizar tabla con agrupamiento
  const ProductTable = ({ productos, title, isConsignacion = false }: {
    productos: ProductoVendido[];
    title: string;
    isConsignacion?: boolean;
  }) => {
    if (!productos || productos.length === 0) {
      return (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay productos {isConsignacion ? 'en consignación' : 'propios'} vendidos
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
          </Table>
        </TableContainer>
      );
    }

    // Agrupar productos por productoId
    const productosAgrupados = productos.reduce((acc, producto) => {
      const key = producto.productoId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(producto);
      return acc;
    }, {} as Record<string, ProductoVendido[]>);

    // Convertir a array y ordenar por nombre
    const gruposOrdenados: ProductoAgrupado[] = Object.entries(productosAgrupados)
      .map(([productoId, items]) => ({
        productoId,
        items: items.sort((a, b) => (a.costo || 0) - (b.costo || 0)), // Ordenar por costo dentro del grupo
        nombre: items[0].nombre
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Calcular proporción de descuentos para este conjunto cuando sea "Propios"
    const brutoGlobal = (typeof totalVentasBrutas === 'number' ? totalVentasBrutas : productosVendidos.reduce((a, p) => a + (p.total || 0), 0)) || 0;
    const descuentosGlobal = (typeof totalDescuentos === 'number' ? totalDescuentos : 0) || 0;
    const brutoTabla = productos.reduce((acc, p) => acc + (p.total || 0), 0);
    // Solo prorrateamos para tabla de Propios; para Consignación mantenemos como estaba (pedido del usuario)
    const descuentosTabla = !isConsignacion && brutoGlobal > 0 ? (descuentosGlobal * (brutoTabla / brutoGlobal)) : 0;

    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  {isConsignacion ? <HandshakeIcon fontSize="small" /> : <StoreIcon fontSize="small" />}
                  {title}
                </Box>
              </TableCell>
              <TableCell>Cantidad</TableCell>
              {!showOnlyCants && (
                <>
                  <TableCell>Venta</TableCell>
                  {/* Nueva columna: Descuento (solo para Propios) */}
                  {!isConsignacion && <TableCell>Descuento</TableCell>}
                  {/* Ganancia debe ser neta (descontando su parte de descuento) */}
                  {!showOnlyCants && <TableCell>Ganancia</TableCell>}
                  {!showOnlyCants && <TableCell>Costo</TableCell>}
                  {!showOnlyCants && <TableCell>Precio</TableCell>}
                  {isConsignacion && <TableCell>Proveedor</TableCell>}
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {gruposOrdenados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isConsignacion ? 7 : 7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No hay productos {isConsignacion ? 'en consignación' : 'propios'} vendidos
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              gruposOrdenados.map((grupo) =>
                grupo.items.map((producto, index) => (
                  <TableRow key={`${grupo.productoId}-${index}`}>
                    {/* Celda del nombre del producto con rowSpan */}
                    {index === 0 && (
                      <TableCell rowSpan={grupo.items.length} sx={{ verticalAlign: 'top', borderRight: '1px solid #e0e0e0' }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="medium">
                            {producto.nombre || 'Producto sin nombre'}
                          </Typography>
                          {isConsignacion && (
                            <Chip
                              label="Consignación"
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                          {grupo.items.length > 1 && (
                            <Chip
                              label={`${grupo.items.length} variantes`}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                    )}

                    {/* Celdas de datos específicos de cada variante */}
                    <TableCell>{formatNumber(producto.cantidad || 0)}</TableCell>
                    {!showOnlyCants && (
                      <>
                        <TableCell>{formatCurrency(producto.total || 0)}</TableCell>
                        {/* Descuento prorrateado por fila (solo Propios) */}
                        {!isConsignacion && (
                          <TableCell>
                            -{formatCurrency(
                              brutoTabla > 0 ? ((producto.total || 0) / brutoTabla) * descuentosTabla : 0
                            )}
                          </TableCell>
                        )}
                        {/* Ganancia neta = ganancia - descuento asignado (solo afecta a Propios en esta tabla) */}
                        {!showOnlyCants && (
                          <TableCell>
                            {formatCurrency(
                              (producto.ganancia || 0) - (
                                !isConsignacion && brutoTabla > 0
                                  ? ((producto.total || 0) / brutoTabla) * descuentosTabla
                                  : 0
                              )
                            )}
                          </TableCell>
                        )}
                        {!showOnlyCants && (
                          <TableCell>
                            <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                              {formatCurrency(producto.costo || 0)}
                            </Typography>
                          </TableCell>
                        )}
                        {!showOnlyCants && (
                          <TableCell>
                            <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                              {formatCurrency(producto.precio || 0)}
                            </Typography>
                          </TableCell>
                        )}
                        {isConsignacion && (
                          <TableCell>
                            <Chip
                              label={producto.proveedor?.nombre || 'Sin proveedor'}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                ))
              )
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <>
      {!hideTotales && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            gap: 2,
          }}
        >
          <Grid container spacing={2} sx={{ flex: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Venta
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  {formatCurrency(totalVentas)}
                </Typography>
              </Box>
            </Grid>

            {!showOnlyCants && (
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Ganancia
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {formatCurrency(totalGanancia)}
                  </Typography>
                </Box>
              </Grid>
            )}

            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Transferencia
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="info.main">
                  {formatCurrency(totalTransferencia)}
                </Typography>
              </Box>
            </Grid>

            {totalTransferenciasByDestination.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom textAlign="center">
                    Transferencias por Destino
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {totalTransferenciasByDestination.map((transfer) => (
                      <Box key={transfer.id} display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {transfer.nombre}:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium" color="warning.main" sx={{ ml: 1 }}>
                          {formatCurrency(transfer.total)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>

          {handleCerrarCaja && (
            <Box sx={{
              display: 'flex',
              justifyContent: { xs: 'center', sm: 'flex-end' },
              minWidth: { sm: 'auto', md: '200px' },
              gap: 1
            }}>
              <Button
                variant="contained"
                onClick={handleCierre}
                disabled={disableCierreBtn}
                size="large"
                sx={{
                  minWidth: '140px',
                  height: '48px'
                }}
              >
                Cerrar caja
              </Button>
            </Box>
          )}

          {/* Menú de exportación general */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleExportAll} disabled={exporting}>
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Exportar todos los productos</ListItemText>
            </MenuItem>
          </Menu>
        </Paper>
      )}

      {/* Resumen de Ventas por Usuario */}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          📊 Resumen de Ventas por Usuario
        </Typography>
        <Grid container spacing={2}>
          {totalVentasPorUsuario.map((usuario) => (
            <Grid item xs={12} md={6} key={usuario.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <StoreIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">{usuario.nombre}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Ventas: {formatCurrency(usuario.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Resumen de Consignación con datos reales */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          📊 Resumen de Ventas por Tipo
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <StoreIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Productos Propios
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Ventas: {formatCurrency(totalVentasPropias)}
                </Typography>
                {!showOnlyCants && (
                  <Typography variant="body2" color="text.secondary">
                    Ganancia: {formatCurrency(totalGananciasPropias)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <HandshakeIcon color="secondary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Productos Consginación
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Ventas: {formatCurrency(totalVentasConsignacion)}
                </Typography>
                {!showOnlyCants && (
                  <Typography variant="body2" color="text.secondary">
                    Ganancia: {formatCurrency(totalGananciasConsignacion)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
            {totalVentasPorProveedor.map((item: { id: string, nombre: string, total: number, ganancia: number }) => {
              return (
                <Grid item xs={6} md={3} key={item.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <HandshakeIcon color="secondary" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          {item.nombre}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Ventas: {formatCurrency(item.total)}
                      </Typography>
                      {!showOnlyCants && (
                        <Typography variant="body2" color="text.secondary">
                          Ganancia: {formatCurrency(item.ganancia)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        
      </Paper>

      {/* Acordeones para productos separados con datos reales */}
      <Box sx={{ mb: 2 }}>
        {productosVendidos.filter(p => !p.proveedor).length > 0 && (
          <Accordion expanded={expandedPropios}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              onClick={() => setExpandedPropios(!expandedPropios)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pr: 1
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <StoreIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  {isMobile ? "Propios" : "Productos Propios"} ({productosVendidos.filter(p => !p.proveedor).length})
                </Typography>
              </Box>
              <Box onClick={(e) => e.stopPropagation()} flex={1} display={'flex'} justifyContent={'flex-end'}>
                <Tooltip title="Exportar productos propios">
                  <IconButton
                    onClick={handleMenuPropiosOpen}
                    disabled={exporting}
                    size="small"
                    color="primary"
                  >
                    {exporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ProductTable
                productos={productosVendidos.filter(p => !p.proveedor)}
                title="Productos Propios"
                isConsignacion={false}
              />
            </AccordionDetails>
          </Accordion>
        )}
        {productosVendidos.filter(p => p.proveedor).length > 0 && (
          <Accordion expanded={expandedConsignacion}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              onClick={() => setExpandedConsignacion(!expandedConsignacion)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pr: 1
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <HandshakeIcon color="secondary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  {isMobile ? "Consignación" : "Productos Consignación"} ({productosVendidos.filter(p => p.proveedor).length})
                </Typography>
              </Box>
              <Box onClick={(e) => e.stopPropagation()} flex={1} display={'flex'} justifyContent={'flex-end'}>
                <Tooltip title="Exportar productos en consignación">
                  <IconButton
                    onClick={handleMenuConsignacionOpen}
                    disabled={exporting}
                    size="small"
                    color="secondary"
                  >
                    {exporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ProductTable
                productos={productosVendidos.filter(p => p.proveedor)}
                title="Productos en Consignación"
                isConsignacion={true}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* Menú de exportación para productos propios */}
        <Menu
          anchorEl={anchorElPropios}
          open={Boolean(anchorElPropios)}
          onClose={handleMenuPropiosClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleExportPropios} disabled={exporting}>
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Exportar productos propios</ListItemText>
          </MenuItem>
        </Menu>

        {/* Menú de exportación para productos en consignación */}
        <Menu
          anchorEl={anchorElConsignacion}
          open={Boolean(anchorElConsignacion)}
          onClose={handleMenuConsignacionClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {proveedoresUnicos.map((proveedor) => (
            <MenuItem
              key={proveedor.id}
              onClick={() => {
                handleExportProveedor(proveedor.id);
                handleMenuConsignacionClose();
              }}
              disabled={exporting}
            >
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Exportar productos de {proveedor.nombre}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Tabla original (mantenida para compatibilidad) */}
      <Box sx={{ m: 2 }}>

        <Box display={'flex'} flexDirection={'row'} gap={2}>

          <Typography variant="h6" gutterBottom>
            {isMobile ? "📋 Todos" : "📋 Todos los Productos"}
          </Typography>

          <Box onClick={(e) => e.stopPropagation()} flex={1} display={'flex'} justifyContent={'flex-end'}>
            <Tooltip title="Exportar a Excel">
              <IconButton
                onClick={handleMenuOpen}
                disabled={exporting}
                color="primary"
              >
                {exporting ? <CircularProgress size={20} /> : <FileDownloadIcon />}
              </IconButton>
            </Tooltip>
          </Box>

        </Box>



        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>Cantidad</TableCell>
                {!showOnlyCants && (
                  <>
                    <TableCell>Venta</TableCell>
                    {/* Nueva columna: Descuento (global) */}
                    <TableCell>Descuento</TableCell>
                    {/* Ganancia neta considerando descuentos */}
                    {!showOnlyCants && <TableCell>Ganancia</TableCell>}
                    {!showOnlyCants && <TableCell>Costo</TableCell>}
                    {!showOnlyCants && <TableCell>Precio</TableCell>}
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {productosVendidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showOnlyCants ? 2 : 7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No hay productos vendidos en este período
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  // Agrupar productos por productoId
                  const productosAgrupados = productosVendidos.reduce((acc, producto) => {
                    const key = producto.productoId || producto.id;
                    if (!acc[key]) {
                      acc[key] = [];
                    }
                    acc[key].push(producto);
                    return acc;
                  }, {} as Record<string, ProductoVendido[]>);

                  // Convertir a array y ordenar por nombre
                  const gruposOrdenados = Object.entries(productosAgrupados)
                    .map(([productoId, items]) => ({
                      productoId,
                      items: Array.isArray(items) ? items.sort((a, b) => (a.costo || 0) - (b.costo || 0)) : [],
                      nombre: items[0]?.nombre || 'Producto sin nombre'
                    }))
                    .sort((a, b) => a.nombre.localeCompare(b.nombre));

                  // Definir totales globales para prorrateo de descuentos en la tabla "Todos los Productos"
                  const brutoGlobal = (
                    typeof totalVentasBrutas === 'number'
                      ? totalVentasBrutas
                      : productosVendidos.reduce((acc, p) => acc + (p.total || 0), 0)
                  ) || 0;
                  const descuentosGlobal = (typeof totalDescuentos === 'number' ? totalDescuentos : 0) || 0;

                  return gruposOrdenados.map((grupo) =>
                    grupo.items.map((producto, index) => (
                      <TableRow key={`${grupo.productoId}-${index}`}>
                        {/* Celda del nombre del producto con rowSpan */}
                        {index === 0 && (
                          <TableCell rowSpan={grupo.items.length} sx={{ verticalAlign: 'top', borderRight: '1px solid #e0e0e0' }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {producto.nombre || 'Producto sin nombre'}
                              </Typography>
                              {grupo.items.length > 1 && (
                                <Chip
                                  label={`${grupo.items.length} variantes`}
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                        )}

                        {/* Celdas de datos específicos de cada variante */
                        // Cálculo de descuento por fila en tabla global (Todos los Productos)
                        }
                        <TableCell>{formatNumber(producto.cantidad || 0)}</TableCell>
                        {!showOnlyCants && (
                          <>
                            <TableCell>{formatCurrency(producto.total || 0)}</TableCell>
                            {/* Descuento prorrateado global */}
                            <TableCell>
                              -{formatCurrency(
                                brutoGlobal > 0 ? (((producto.total || 0) / brutoGlobal) * descuentosGlobal) : 0
                              )}
                            </TableCell>
                            {/* Ganancia neta */}
                            {!showOnlyCants && (
                              <TableCell>
                                {formatCurrency(
                                  (producto.ganancia || 0) - (
                                    brutoGlobal > 0 ? ((producto.total || 0) / brutoGlobal) * descuentosGlobal : 0
                                  )
                                )}
                              </TableCell>
                            )}
                            {!showOnlyCants && (
                              <TableCell>
                                <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                                  {formatCurrency(producto.costo || 0)}
                                </Typography>
                              </TableCell>
                            )}
                            {!showOnlyCants && (
                              <TableCell>
                                <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                                  {formatCurrency(producto.precio || 0)}
                                </Typography>
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    ))
                  );
                })()
              )}
              {!hideTotales && productosVendidos.length > 0 && (
                <TableRow sx={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  <TableCell>Total</TableCell>
                  <TableCell>{formatNumber(totales?.totalCantidad || 0)}</TableCell>
                  {!showOnlyCants && (
                    <>
                      <TableCell>{formatCurrency(totales?.totalMonto || 0)}</TableCell>
                      {/* Total descuentos global */}
                      <TableCell>- {formatCurrency(totalDescuentos || 0)}</TableCell>
                      {/* Ganancia total neta (desde backend) */}
                      <TableCell>{formatCurrency(totalGanancia || 0)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Resumen final con descuentos (Bruto -> Descuentos -> Neto) */}
      <Paper sx={{ p: 2, mt: 2 }}>
        {(() => {
          // Usar totales del backend con fallbacks seguros
          const bruto = typeof totalVentasBrutas === 'number' ? totalVentasBrutas : (totales?.totalMonto || 0);
          const descuentos = typeof totalDescuentos === 'number' ? totalDescuentos : 0;
          const neto = typeof totalVentas === 'number' ? totalVentas : Math.max(0, bruto - descuentos);

          return (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">Total Ventas (Bruto)</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {formatCurrency(bruto)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">Descuentos aplicados</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    - {formatCurrency(descuentos)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">Total Ventas (Neto)</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                    {formatCurrency(neto)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          );
        })()}
      </Paper>
    </>
  );
};
