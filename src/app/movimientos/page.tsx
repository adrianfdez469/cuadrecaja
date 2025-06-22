"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Stack,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AddMovimientoDialog } from "./components/addMovimientoDialog";
import { IProducto } from "@/types/IProducto";
import { fetchProducts } from "@/services/productServise";
import { useAppContext } from "@/context/AppContext";
import { findMovimientos } from "@/services/movimientoService";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";

const PAGE_SIZE = 20;

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const { user, loadingContext } = useAppContext();
  const [loadingData, setLoadingData] = useState(true);
  const [noTiendaActual, setNoTiendaActual] = useState(false);

  const [skip, setSkip] = useState(0);

  const fetchMovimientos = async (nuevoSkip = skip) => {
    try {
      const tiendaId = user.tiendaActual.id;
      const result = await findMovimientos(tiendaId, PAGE_SIZE, nuevoSkip);
      setMovimientos(result || []); // Asegurar que siempre sea un array
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      setMovimientos([]);
    }
  };

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        try {
          setNoTiendaActual(false);
          
          // Validar que el usuario tenga una tienda actual
          if (!user.tiendaActual || !user.tiendaActual.id) {
            setNoTiendaActual(true);
            setLoadingData(false);
            return;
          }

          setSkip(0);
          const prods = await fetchProducts();
          setProductos(prods || []);
          await fetchMovimientos(0);
        } catch (error) {
          console.error("Error al cargar datos:", error);
        } finally {
          setLoadingData(false);
        }
      }
    })();
  }, [loadingContext]);

  const tableCellHeaderStyle = {
    position: "sticky",
    top: 0,
    backgroundColor: "background.paper",
    zIndex: 1,
  };

  const handleInicio = () => {
    setSkip(0);
    fetchMovimientos(0);
  };

  const handleAnterior = () => {
    const nuevoSkip = Math.max(skip - PAGE_SIZE, 0);
    setSkip(nuevoSkip);
    fetchMovimientos(nuevoSkip);
  };

  const handleSiguiente = () => {
    const nuevoSkip = skip + PAGE_SIZE;
    setSkip(nuevoSkip);
    fetchMovimientos(nuevoSkip);
  };

  if (loadingContext || loadingData) {
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
          Movimientos de Stock
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar los movimientos de stock, necesitas tener una tienda seleccionada como tienda actual.
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

  return (
    <Box
      p={0}
      display="flex"
      flexDirection="column"
      height="calc(100vh - 64px)"
    >
      <Typography variant="h4" gutterBottom>
        Movimientos de Stock
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setDialogOpen(true)}
      >
        Crear Movimiento
      </Button>

      <AddMovimientoDialog
        dialogOpen={dialogOpen}
        productos={productos}
        closeDialog={() => setDialogOpen(false)}
        fetchMovimientos={fetchMovimientos}
      />

      <Box mt={4} display="flex" flexDirection="column" flex={1} minHeight={0}>
        {movimientos.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              No hay movimientos de stock registrados
            </Typography>
            <Typography variant="body1" gutterBottom>
              Los movimientos de stock se crean automáticamente cuando:
            </Typography>
            <Typography variant="body2" component="div">
              • Se realizan ventas desde el POS<br/>
              • Se agregan productos al inventario<br/>
              • Se realizan ajustes manuales<br/>
              • Se hacen traspasos entre tiendas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              También puedes crear movimientos manuales usando el botón "Crear Movimiento".
            </Typography>
          </Alert>
        ) : (
          <Box mt={2} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <TableContainer component={Paper} sx={{ mt: 2, flexGrow: 1 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableCellHeaderStyle}>Fecha</TableCell>
                    <TableCell sx={tableCellHeaderStyle}>Tipo</TableCell>
                    <TableCell sx={tableCellHeaderStyle}>Producto</TableCell>
                    <TableCell sx={tableCellHeaderStyle}>Cantidad</TableCell>
                    <TableCell sx={tableCellHeaderStyle}>Usuario</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movimientos.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(m.fecha).toLocaleString()}</TableCell>
                      <TableCell>{m.tipo}</TableCell>
                      <TableCell>{m.productoTienda?.producto?.nombre || 'Producto no disponible'}</TableCell>
                      <TableCell>
                        {isMovimientoBaja(m.tipo)
                          ? `-${m.cantidad}`
                          : `+${m.cantidad}`}
                      </TableCell>
                      <TableCell>{m.usuario?.nombre || "Sistema"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Controles de paginación */}
            <Box mt={2} display="flex" justifyContent="center">
              <Stack direction="row" spacing={2}>
                {skip > 0 && (
                  <Button onClick={handleInicio} variant="outlined">
                    Inicio
                  </Button>
                )}
                {skip > 0 && (
                  <Button onClick={handleAnterior} variant="outlined">
                    Anterior
                  </Button>
                )}
                {movimientos.length === PAGE_SIZE && (
                  <Button onClick={handleSiguiente} variant="outlined">
                    Siguiente
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
