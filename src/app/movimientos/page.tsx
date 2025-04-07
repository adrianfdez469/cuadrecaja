"use client"

import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { AddMovimientoDialog } from './components/addMovimientoDialog';
import { IProducto } from '@/types/IProducto';
import { fetchProducts } from '@/services/productServise';
import { useAppContext } from '@/context/AppContext';
import { findMovimientos } from '@/services/movimientoService';
import { isMovimientoBaja } from '@/utils/tipoMovimiento';

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productos, setProductos] = useState<IProducto[]>([]);
  const {user, loadingContext} = useAppContext();
  const [loadingData, setLoadingData] = useState(true);

  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);


  const fetchMovimientos = async  () => {
    console.log(('cargar movimientos'));

    const tiendaId = user.tiendaActual.id;
    const movs = await findMovimientos(tiendaId, take, skip);

    setMovimientos(movs);

  }

  useEffect(() => {
    (async () => {
      if(!loadingContext) {
        const prods = await fetchProducts();
        setProductos(prods);
        setLoadingData(false);
        fetchMovimientos();
      }

    })();
  }, [loadingContext])

  if(loadingContext || loadingData) {
    return <CircularProgress />
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom>
        Movimientos de Stock
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
        Crear Movimiento
      </Button>

      <AddMovimientoDialog dialogOpen={dialogOpen} productos={productos} closeDialog={() => setDialogOpen(false)} fetchMovimientos={fetchMovimientos}/>

      <Box mt={4}>
        <Typography variant="h6">Movimientos registrados</Typography>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>ID Producto</TableCell>
                <TableCell>Cantidad</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movimientos.map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(m.fecha).toLocaleString()}</TableCell>
                  <TableCell>{m.tipo}</TableCell>
                  <TableCell>{m.productoTienda.producto.nombre}</TableCell>
                  <TableCell>{isMovimientoBaja(m.tipo) ? `-${m.cantidad}` : `+${m.cantidad}` }</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
