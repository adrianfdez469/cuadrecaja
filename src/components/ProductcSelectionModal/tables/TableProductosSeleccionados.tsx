import { formatCurrency } from "@/utils/formatters";
import { Delete } from "@mui/icons-material";
import { Alert, Box, TableHead, Table, Paper, TableContainer, TableRow, TableCell, TableBody, Typography, IconButton, Tooltip, Card, CardContent, Grid, TextField } from "@mui/material";
import React from "react";
import { OperacionTipo, IProductoSeleccionado } from "../ProductSelectionModal";
import { ITipoMovimiento } from "@/types/IMovimiento";

interface IProps {
  operacion: OperacionTipo;
  productosSeleccionados: IProductoSeleccionado[];
  isMobile: boolean;
  actualizarCantidad: (productoId: string, nuevaCantidad: number, proveedorId?: string) => void;
  actualizarCosto: (productoId: string, nuevoCosto: number) => void;
  eliminarProducto: (productoId: string) => void;
  limpiarSeleccion: () => void;
  show: boolean,
  tipoMovimiento: ITipoMovimiento
}

const TableProductosSeleccionados: React.FC<IProps> = ({ 
  operacion, 
  productosSeleccionados, 
  isMobile, 
  actualizarCantidad, 
  actualizarCosto, 
  eliminarProducto, 
  limpiarSeleccion,
  show,
  tipoMovimiento
}) => {

  // Totales
  const totalProductos = productosSeleccionados.length;
  const totalCantidad = productosSeleccionados.reduce((sum, p) => sum + p.cantidad, 0);
  const totalCosto = productosSeleccionados.reduce((sum, p) => sum + p.costoTotal, 0);

  // Validaciones
  const hayErrores = productosSeleccionados.some(p => {
    if (operacion === 'SALIDA' || tipoMovimiento === 'TRASPASO_ENTRADA') {
      return p.cantidad > p.existencia;
    }
    return p.cantidad <= 0;
  });

  if (productosSeleccionados.length === 0 && show) {
    return (
      <Alert severity="info">
        {`No hay productos seleccionados. Ve a la pestaña \"Productos Disponibles\" para agregar productos.`}
      </Alert>
    );
  }

  return (
    <div style={{ display: show ? 'block' : 'none' }}>
      {/* Resumen */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="primary">
                  {totalProductos}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Productos
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="success.main">
                  {totalCantidad}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cantidad Total
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(totalCosto)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Costo Total
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Tooltip title="Limpiar selección">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={limpiarSeleccion}
                  >
                    <Delete />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de productos seleccionados */}
      <TableContainer component={Paper} variant="outlined">
        <Table size={isMobile ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              <TableCell align="center"></TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="center">Cantidad</TableCell>
              <TableCell align="center">Costo Unit.</TableCell>
              <TableCell align="right">Costo Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productosSeleccionados.map((producto, index) => {
              const esSalida = operacion === 'SALIDA';
              const cantidadExcede = esSalida && producto.cantidad > producto.existencia;
              
              return (
                <TableRow key={producto.productoId+index}>
                  <TableCell align="center">
                    <Tooltip title="Eliminar producto">
                      <IconButton
                          color="error"
                          onClick={() => eliminarProducto(producto.productoId)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                      {producto.proveedor ? `${producto.nombre} - ${producto.proveedor.nombre}` : producto.nombre}
                      </Typography>
                      {producto.proveedor && (
                        <Typography variant="caption" color="text.secondary">
                          {producto.proveedor.nombre}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      type="number"
                      size="small"
                      value={producto.cantidad.toString()}
                      onChange={(e) => actualizarCantidad(producto.productoId, Number(e.target.value), producto.proveedorId)}
                      slotProps={{
                        htmlInput: {
                          min: 1,
                          max: esSalida ? producto.existencia : undefined
                        }
                      }}
                      disabled={tipoMovimiento === 'TRASPASO_ENTRADA'}
                      error={cantidadExcede}
                      helperText={cantidadExcede ? `Máx: ${producto.existencia}` : ''}
                      sx={{ width: 60 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    
                    <TextField
                      type="number"
                      size="small"
                      value={producto.costo?.toString()}
                      onChange={(e) => actualizarCosto(producto.productoId, Number(e.target.value))}
                      disabled={esSalida || tipoMovimiento === 'TRASPASO_ENTRADA'}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(producto.costoTotal)}
                    </Typography>
                  </TableCell>

                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Alertas de validación */}
      {hayErrores && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Hay productos con cantidades inválidas. Por favor, revisa los valores ingresados.
          </Typography>
        </Alert>
      )}
    </div>
  );
};

export default React.memo(TableProductosSeleccionados);

