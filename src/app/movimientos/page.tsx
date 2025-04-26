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

  const [skip, setSkip] = useState(0);

  const fetchMovimientos = async (nuevoSkip = skip) => {
    const tiendaId = user.tiendaActual.id;
    const result = await findMovimientos(tiendaId, PAGE_SIZE, nuevoSkip);

    setMovimientos(result); // ajusta si tu API devuelve `.data`
  };

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        setSkip(0);
        const prods = await fetchProducts();
        setProductos(prods);
        setLoadingData(false);
        fetchMovimientos(0);
      }
    })();
  }, [loadingContext]);

  const tableCellHeaderStyle = {
    position: "sticky",
    top: 0,
    backgroundColor: "background.paper",
    zIndex: 1, // para que quede sobre el body
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
    return <CircularProgress />;
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
        {/* Wrapper que controla el alto y scroll interno */}
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
                    <TableCell>{m.productoTienda.producto.nombre}</TableCell>
                    <TableCell>
                      {isMovimientoBaja(m.tipo)
                        ? `-${m.cantidad}`
                        : `+${m.cantidad}`}
                    </TableCell>
                    <TableCell>{m.usuario?.nombre || ""}</TableCell>
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
      </Box>
    </Box>
  );
}
