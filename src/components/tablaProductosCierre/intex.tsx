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
} from "@mui/material";
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
