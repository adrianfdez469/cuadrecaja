import { FC } from "react";
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
} from "@mui/material";
import { ICierreData } from "@/types/ICierre";

export interface ITotales {
  totalCantidad: number;
  totalMonto: number;
  totalGanancia: number;
}

interface IProps {
  cierreData: ICierreData;
  totales: ITotales;
  handleCerrarCaja?: () => Promise<void>;
}

export const TablaProductosCierre: FC<IProps> = ({
  cierreData,
  totales,
  handleCerrarCaja,
}) => {
  return (
    <>
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
            Total Venta: ${cierreData.totalVentas.toFixed(2)}
          </Typography>
          <Typography variant="h6">
            Total Ganancia: ${cierreData.totalGanancia.toFixed(2)}
          </Typography>
        </Box>

        {handleCerrarCaja && (
          <Button variant="contained" onClick={handleCerrarCaja}>
            Cerrar caja
          </Button>
        )}
      </Paper>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Venta</TableCell>
              <TableCell>Ganancia</TableCell>
              <TableCell>Costo</TableCell>
              <TableCell>Precio</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cierreData.productosVendidos.map((producto) => (
              <TableRow key={producto.id}>
                <TableCell>{producto.nombre}</TableCell>
                <TableCell>{producto.cantidad}</TableCell>
                <TableCell>${producto.total?.toFixed(2)}</TableCell>
                <TableCell>${producto.ganancia.toFixed(2)}</TableCell>
                <TableCell>${producto.costo.toFixed(2)}</TableCell>
                <TableCell>${producto.precio.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
              <TableCell>Total</TableCell>
              <TableCell>{totales.totalCantidad}</TableCell>
              <TableCell>${totales.totalMonto.toFixed(2)}</TableCell>
              <TableCell>${totales.totalGanancia.toFixed(2)}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
