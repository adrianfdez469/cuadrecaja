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
  IconButton,
  Alert,
  Button,
} from "@mui/material";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierrePeriodo } from "@/types/ICierre";
import { IVenta } from "@/types/IVenta";
import { Delete, Edit } from "@mui/icons-material";
import useConfirmDialog from "@/components/confirmDialog";
import { getSells, removeSell } from "@/services/sellService";
import CartDrawer from "@/components/cartDrawer/CartDrawer";

const Ventas = () => {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ventas, setVentas] = useState<IVenta[]>([]);
  const [noPeriodFound, setNoPeriodFound] = useState(false);
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const [openCart, setOpenCart] = useState(false)
  const [selectedVenta, setSelectedVenta] = useState<IVenta>();

  const handleCreateFirstPeriod = async () => {
    try {
      setIsDataLoading(true);
      const tiendaId = user.tiendaActual.id;
      await openPeriod(tiendaId);
      await loadData();
      showMessage("Primer período creado exitosamente", "success");
    } catch (error) {
      console.log(error);
      showMessage("Error al crear el primer período", "error");
    }
  };

  const loadData = async () => {
    setIsDataLoading(true);
    setNoPeriodFound(false);
    setNoTiendaActual(false);
    
    try {
      // Validar que el usuario tenga una tienda actual
      if (!user.tiendaActual || !user.tiendaActual.id) {
        setNoTiendaActual(true);
        return;
      }

      const tiendaId = user.tiendaActual.id;
      const currentPeriod = await fetchLastPeriod(tiendaId);
      
      if (!currentPeriod) {
        setNoPeriodFound(true);
        return;
      }
      
      setCurrentPeriod(currentPeriod);

      const data = await getSells(tiendaId, currentPeriod.id);
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
    
    setSelectedVenta(venta);
    setOpenCart(true);
  };

  const handleCancelVenta = async (venta: IVenta) => {
    confirmDialog(
      "Está seguro que desea eliminar completamente esta venta?",
      async () => {
        try {
          const tiendaId = user.tiendaActual.id;
          await removeSell(tiendaId, currentPeriod.id, venta.id, user.id);
          showMessage("La venta fur eliminada satisfactoriamente", 'success');
        } catch (error) {
          console.log(error);
          showMessage("La venta no puso ser eliminada", 'error');
        } finally {
          loadData();
          setOpenCart(false);
          setSelectedVenta(undefined);
        }
      }
    );
  };

  useEffect(() => {
    if (!loadingContext) {
      loadData();
    }
  }, [loadingContext]);

  if (loadingContext || isDataLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (noTiendaActual) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Ventas
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar las ventas, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              href="/configuracion/tiendas"
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  if (noPeriodFound) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Ventas
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ¡Bienvenido a tu nuevo negocio!
          </Typography>
          <Typography variant="body1" gutterBottom>
            No se encontraron períodos de cierre. Para comenzar a registrar ventas 
            necesitas crear tu primer período de cierre.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Una vez creado el período, podrás realizar ventas desde el POS y revisarlas aquí.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCreateFirstPeriod}
          disabled={isDataLoading}
        >
          Crear Primer Período
        </Button>
      </Box>
    );
  }

  if (currentPeriod) {
    return (
      <Box p={0}>
        <Typography variant="h4" gutterBottom>
          Ventas: Corte{" "}
          {new Date(currentPeriod.fechaInicio).toLocaleDateString()}
        </Typography>

        {ventas.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body1">
              No hay ventas registradas en este período.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Las ventas realizadas desde el POS aparecerán aquí automáticamente.
            </Typography>
          </Alert>
        ) : (
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
        )}

        {selectedVenta && 
          <CartDrawer
            cart={selectedVenta.productos.map((prod) => {
              return {
                id: prod.id,
                name: prod.name,
                price: prod.price,
                productoTiendaId: prod.productoTiendaId,
                quantity: prod.cantidad
              }
            })}
            onClose={() => setOpenCart(false)}
            open={openCart}
            clear={() => handleCancelVenta(selectedVenta)}
            total={selectedVenta.total}
          />
        }

        {ConfirmDialogComponent}
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Alert severity="error">
        Error al cargar los datos de ventas. Por favor, intenta recargar la página.
      </Alert>
    </Box>
  );
};

export default Ventas;
