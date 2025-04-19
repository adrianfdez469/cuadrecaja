"use client";

import React, { useEffect, useState } from "react";
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
  CircularProgress,
  Button,
  IconButton,
} from "@mui/material";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierrePeriodo } from "@/types/ICierre";
import { IVenta } from "@/types/IVenta";
import { Delete, Edit } from "@mui/icons-material";
import useConfirmDialog from "@/components/confirmDialog";
import { getSells } from "@/services/sellService";
import CartDrawer from "@/components/cartDrawer/CartDrawer";

const Ventas = () => {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ventas, setVentas] = useState<IVenta[]>([]);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const [itemsVenta, setItemVentas] = useState([]);

  const getData = async () => {
    setIsDataLoading(true);
    try {
      const tiendaId = user.tiendaActual.id;
      const currentPeriod = await fetchLastPeriod(tiendaId);
      setCurrentPeriod(currentPeriod);

      const data = await getSells(tiendaId, currentPeriod.id);
      console.log(data);
      
      setVentas(data);
    } catch (error) {
      console.log(error);
      showMessage(
        "Error: los datos de ventas no puediron ser cargados",
        "error"
      );
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleOpenVenta = (venta: IVenta) => {
    
    const productos = venta.productos.map((prod) => {
      return {
        id: prod.id,
        name: prod.name,
        price: prod.price,
        productoTiendaId: prod.productoTiendaId,
        quantity: prod.cantidad
      }
    });
    console.log(productos);
    
    setItemVentas(productos);
  };

  const handleCancelVenta = async (venta: IVenta) => {
    confirmDialog(
      "Está seguro que desea eliminar completamente esta venta?",
      () => {
        console.log("Cancelar venta");
      }
    );
  };

  useEffect(() => {
    getData();
  }, []);

  if (loadingContext || isDataLoading) {
    return <CircularProgress />;
  } else {
    return (
      <Box p={0}>
        <Typography variant="h4" gutterBottom>
          Ventas: Corte{" "}
          {new Date(currentPeriod.fechaInicio).toLocaleDateString()}
        </Typography>

        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Efectivo ($)</TableCell>
                <TableCell>Transferencia ($)</TableCell>
                <TableCell>Venta ($)</TableCell>

                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ventas.map((venta) => (
                <TableRow key={venta.id}>
                  <TableCell>
                    {new Date(venta.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{venta.usuario.nombre}</TableCell>
                  <TableCell>${venta.totalcash?.toFixed(2)}</TableCell>
                  <TableCell>${venta.totaltransfer.toFixed(2)}</TableCell>
                  <TableCell>${venta.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleOpenVenta(venta)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      onClick={() => handleCancelVenta(venta)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <CartDrawer
          cartItems={itemsVenta}
          onClose={() => setItemVentas([])}
          open={itemsVenta.length > 0}
          sell={() => {}}
        />

        {ConfirmDialogComponent}
      </Box>
    );
  }
};

export default Ventas;
