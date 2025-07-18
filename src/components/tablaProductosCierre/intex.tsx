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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StoreIcon from "@mui/icons-material/Store";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { ICierreData } from "@/types/ICierre";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";

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
  const [disableCierreBtn, setDisableCierreBtn] = useState(false);
  const [expandedPropios, setExpandedPropios] = useState(true);
  const [expandedConsignacion, setExpandedConsignacion] = useState(true);

  const handleCierre = async () => {
    if (handleCerrarCaja) {
      setDisableCierreBtn(true);
      await handleCerrarCaja();
      setDisableCierreBtn(false);
    }
  };

  const isAdminOrSuperAdmin = () => {
    return user?.rol === "ADMIN" || user?.rol === "SUPER_ADMIN";
  };

  const {
    totalVentas,
    totalGanancia,
    totalTransferencia,
    totalVentasPropias,
    totalVentasConsignacion,
    totalGananciasPropias,
    totalGananciasConsignacion,
    productosVendidos,
    totalTransferenciasByDestination
  } = cierreData;

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
                  {isAdminOrSuperAdmin() && <TableCell>Ganancia</TableCell>}
                  {isAdminOrSuperAdmin() && <TableCell>Costo</TableCell>}
                  {isAdminOrSuperAdmin() && <TableCell>Precio</TableCell>}
                  {isConsignacion && <TableCell>Proveedor</TableCell>}
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {gruposOrdenados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isConsignacion ? 7 : 6} align="center">
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
                        {isAdminOrSuperAdmin() && <TableCell>{formatCurrency(producto.ganancia || 0)}</TableCell>}
                        {isAdminOrSuperAdmin() && (
                          <TableCell>
                            <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                              {formatCurrency(producto.costo || 0)}
                            </Typography>
                          </TableCell>
                        )}
                        {isAdminOrSuperAdmin() && (
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
            
            {isAdminOrSuperAdmin && (
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
              minWidth: { sm: 'auto', md: '200px' }
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
        </Paper>
      )}

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
                {isAdminOrSuperAdmin && (
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
                    Productos en Consignación
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Ventas: {formatCurrency(totalVentasConsignacion)}
                </Typography>
                {isAdminOrSuperAdmin && (
                  <Typography variant="body2" color="text.secondary">
                    Ganancia: {formatCurrency(totalGananciasConsignacion)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Acordeones para productos separados con datos reales */}
      <Box sx={{ mb: 2 }}>
        {productosVendidos.filter(p => !p.proveedor).length > 0 && (
          <Accordion expanded={expandedPropios}>
            <AccordionSummary expandIcon={<ExpandMoreIcon /> } onClick={() => setExpandedPropios(!expandedPropios)}>
              <Box display="flex" alignItems="center" gap={1}>
                <StoreIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Productos Propios ({productosVendidos.filter(p => !p.proveedor).length})
                </Typography>
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
            <AccordionSummary expandIcon={<ExpandMoreIcon />} onClick={() => setExpandedConsignacion(!expandedConsignacion)}>
              <Box display="flex" alignItems="center" gap={1}>
                <HandshakeIcon color="secondary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Productos en Consignación ({productosVendidos.filter(p => p.proveedor).length})
                </Typography>
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
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Tabla original (mantenida para compatibilidad) */}
      <Box sx={{ m: 2 }}>

        <Typography variant="h6" gutterBottom>
          📋 Vista Completa de Productos
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>Cantidad</TableCell>
                {!showOnlyCants && (
                  <>
                    <TableCell>Venta</TableCell>
                    {isAdminOrSuperAdmin() && <TableCell>Ganancia</TableCell>}
                    {isAdminOrSuperAdmin() && <TableCell>Costo</TableCell>}
                    {isAdminOrSuperAdmin() && <TableCell>Precio</TableCell>}
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {productosVendidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showOnlyCants ? 2 : 6} align="center">
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
                        
                        {/* Celdas de datos específicos de cada variante */}
                        <TableCell>{formatNumber(producto.cantidad || 0)}</TableCell>
                        {!showOnlyCants && (
                          <>
                            <TableCell>{formatCurrency(producto.total || 0)}</TableCell>
                            {isAdminOrSuperAdmin() && <TableCell>{formatCurrency(producto.ganancia || 0)}</TableCell>}
                            {isAdminOrSuperAdmin() && (
                              <TableCell>
                                <Typography variant="body2" color={grupo.items.length > 1 ? "primary.main" : "inherit"}>
                                  {formatCurrency(producto.costo || 0)}
                                </Typography>
                              </TableCell>
                            )}
                            {isAdminOrSuperAdmin() && (
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
                      {isAdminOrSuperAdmin() && <TableCell>{formatCurrency(totales?.totalGanancia || 0)}</TableCell>}
                      {isAdminOrSuperAdmin() && <TableCell></TableCell>}
                      {isAdminOrSuperAdmin() && <TableCell></TableCell>}
                    </>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </>
  );
};
