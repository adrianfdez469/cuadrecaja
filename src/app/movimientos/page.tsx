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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AddMovimientoDialog } from "./components/addMovimientoDialog";
import { IProducto } from "@/types/IProducto";
import { fetchProducts } from "@/services/productServise";
import { useAppContext } from "@/context/AppContext";
import { findMovimientos } from "@/services/movimientoService";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const { user, loadingContext } = useAppContext();
  const [loadingData, setLoadingData] = useState(true);

  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);

  const fetchMovimientos = async () => {
    console.log("cargar movimientos");

    const tiendaId = user.tiendaActual.id;
    const movs = await findMovimientos(tiendaId, take, skip);

    setMovimientos(movs);
  };

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        setSkip(0);
        setTake(20);

        const prods = await fetchProducts();
        setProductos(prods);
        setLoadingData(false);
        fetchMovimientos();
      }
    })();
  }, [loadingContext]);

  const tableCellHeaderStyle = {
    position: "sticky",
    top: 0,
    backgroundColor: "background.paper",
    zIndex: 1, // para que quede sobre el body
  };

  if (loadingContext || loadingData) {
    return <CircularProgress />;
  }

  return (
    <Box p={0} display="flex" flexDirection="column" height="calc(100vh - 64px)">
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
        <Typography variant="h6">Movimientos registrados</Typography>
        {/* Wrapper que controla el alto y scroll interno */}
        <Box mt={2} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <TableContainer component={Paper} sx={{ mt: 2, flexGrow: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={tableCellHeaderStyle}>Fecha</TableCell>
                  <TableCell sx={tableCellHeaderStyle}>Tipo</TableCell>
                  <TableCell sx={tableCellHeaderStyle}>ID Producto</TableCell>
                  <TableCell sx={tableCellHeaderStyle}>Cantidad</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
}
