"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useAppContext } from "@/context/AppContext";
import axios from "axios";
import { IProductoTienda } from "@/types/IProducto";

export default function InventarioPage() {
  const [productos, setProductos] = useState<IProductoTienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loadingContext } = useAppContext();

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const response = await axios.get<IProductoTienda[]>(
        `/api/productos_tienda/${user.tiendaActual.id}/productos_venta`
      );
      setProductos(response.data);
    } catch (error) {
      console.error("Error al obtener productos", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      fetchProductos();
    }
  }, [loadingContext]);

  const filteredProductos = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tableCellHeaderStyle = {
    position: "sticky",
    top: 0,
    backgroundColor: "background.paper",
    zIndex: 1,
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Inventario de Productos
      </Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={tableCellHeaderStyle}>Producto</TableCell>
              {/* <TableCell sx={tableCellHeaderStyle}>Categoría</TableCell> */}
              <TableCell sx={tableCellHeaderStyle} align="right">
                Existencia
              </TableCell>
              <TableCell sx={tableCellHeaderStyle} align="right">
                Precio
              </TableCell>
              <TableCell sx={tableCellHeaderStyle} align="right">
                Costo
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell align="center" sx={{ width: '100%' }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : (
              filteredProductos.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>
                    {producto.nombre}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={producto.existencia <= 0 ? "error" : "inherit"}
                    >
                      {producto.existencia}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">${producto.precio}</TableCell>
                  <TableCell align="right">${producto.costo}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
} 