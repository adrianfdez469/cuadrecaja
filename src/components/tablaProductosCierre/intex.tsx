import { FC, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StoreIcon from '@mui/icons-material/Store';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { ICierreData } from "@/types/ICierre";
import { formatCurrency, formatNumber } from "@/utils/formatters";

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
  const [disableCierreBtn, setDisableCierreBtn] = useState(false);
  console.log('cierreData', cierreData);
  
  const handleCierre = async () => {
    setDisableCierreBtn(true);
    await handleCerrarCaja();
    setDisableCierreBtn(false);
  };

  // Validaciones para evitar errores
  if (!cierreData) {
    return (
      <Alert severity="error">
        No se pudieron cargar los datos del cierre.
      </Alert>
    );
  }

  const productosVendidos = cierreData.productosVendidos || [];
  const totalVentas = cierreData.totalVentas || 0;
  const totalGanancia = cierreData.totalGanancia || 0;
  const totalTransferencia = cierreData.totalTransferencia || 0;

  // Separar productos por tipo usando datos reales
  const productosConsignacion = productosVendidos.filter(p => p.enConsignacion);
  const productosPropios = productosVendidos.filter(p => !p.enConsignacion);

  // Calcular totales por tipo usando datos reales
  const totalVentasConsignacion = cierreData.totalVentasConsignacion || 0;
  const totalGananciasConsignacion = cierreData.totalGananciasConsignacion || 0;
  const totalVentasPropios = cierreData.totalVentasPropias || 0;
  const totalGananciasPropios = cierreData.totalGananciasPropias || 0;

  const ProductTable = ({ productos, title, isConsignacion = false }) => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
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
                <TableCell>Ganancia</TableCell>
                <TableCell>Costo</TableCell>
                <TableCell>Precio</TableCell>
                {isConsignacion && <TableCell>Proveedor</TableCell>}
              </>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {productos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isConsignacion ? 7 : 6} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No hay productos {isConsignacion ? 'en consignación' : 'propios'} vendidos
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            productos
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {producto.nombre || 'Producto sin nombre'}
                      {isConsignacion && (
                        <Chip 
                          label="Consignación" 
                          size="small" 
                          color="secondary" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{formatNumber(producto.cantidad || 0)}</TableCell>
                  {!showOnlyCants && (
                    <>
                      <TableCell>{formatCurrency(producto.total || 0)}</TableCell>
                      <TableCell>{formatCurrency(producto.ganancia || 0)}</TableCell>
                      <TableCell>{formatCurrency(producto.costo || 0)}</TableCell>
                      <TableCell>{formatCurrency(producto.precio || 0)}</TableCell>
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
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      {!hideTotales && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6">
              Total Venta: {formatCurrency(totalVentas)}
            </Typography>
            <Typography variant="h6">
              Total Ganancia: {formatCurrency(totalGanancia)}
            </Typography>
            <Typography variant="h6">
              Total Transferencia: {formatCurrency(totalTransferencia)}
            </Typography>
          </Box>

          {handleCerrarCaja && (
            <Button
              variant="contained"
              onClick={handleCierre}
              disabled={disableCierreBtn}
            >
              Cerrar caja
            </Button>
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
                  Ventas: {formatCurrency(totalVentasPropios)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ganancia: {formatCurrency(totalGananciasPropios)}
                </Typography>
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
                <Typography variant="body2" color="text.secondary">
                  Ganancia: {formatCurrency(totalGananciasConsignacion)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Acordeones para productos separados con datos reales */}
      <Box sx={{ mb: 2 }}>
        <Accordion expanded={productosPropios.length > 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <StoreIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                Productos Propios ({productosPropios.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <ProductTable 
              productos={productosPropios} 
              title="Productos Propios"
              isConsignacion={false}
            />
          </AccordionDetails>
        </Accordion>

        <Accordion expanded={productosConsignacion.length > 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <HandshakeIcon color="secondary" />
              <Typography variant="subtitle1" fontWeight="bold">
                Productos en Consignación ({productosConsignacion.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <ProductTable 
              productos={productosConsignacion} 
              title="Productos en Consignación"
              isConsignacion={true}
            />
          </AccordionDetails>
        </Accordion>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Tabla original (mantenida para compatibilidad) */}
      <Typography variant="h6" gutterBottom>
        📋 Vista Completa de Productos
      </Typography>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Cantidad</TableCell>
              {!showOnlyCants && (
                <>
                  <TableCell>Venta</TableCell>
                  <TableCell>Ganancia</TableCell>
                  <TableCell>Costo</TableCell>
                  <TableCell>Precio</TableCell>
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
              productosVendidos
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell>{producto.nombre || 'Producto sin nombre'}</TableCell>
                    <TableCell>{formatNumber(producto.cantidad || 0)}</TableCell>
                    {!showOnlyCants && (
                      <>
                        <TableCell>{formatCurrency(producto.total || 0)}</TableCell>
                        <TableCell>{formatCurrency(producto.ganancia || 0)}</TableCell>
                        <TableCell>{formatCurrency(producto.costo || 0)}</TableCell>
                        <TableCell>{formatCurrency(producto.precio || 0)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
            )}
            {!hideTotales && productosVendidos.length > 0 && (
              <TableRow sx={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                <TableCell>Total</TableCell>
                <TableCell>{formatNumber(totales?.totalCantidad || 0)}</TableCell>
                {!showOnlyCants && (
                  <>
                    <TableCell>{formatCurrency(totales?.totalMonto || 0)}</TableCell>
                    <TableCell>{formatCurrency(totales?.totalGanancia || 0)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
