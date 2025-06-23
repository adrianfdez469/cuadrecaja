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
  Button,
  Fab,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import axios from "axios";
import { IProductoTienda } from "@/types/IProducto";
import { exportInventoryToWord } from "@/utils/wordExport";
import { ProductMovementsModal } from "./components/ProductMovementsModal";

export default function InventarioPage() {
  const [productos, setProductos] = useState<IProductoTienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<IProductoTienda | null>(null);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const response = await axios.get<IProductoTienda[]>(
        `/api/productos_tienda/${user.tiendaActual.id}/productos_venta`
      );
      setProductos(response.data);
    } catch (error) {
      console.error("Error al obtener productos", error);
      showMessage("Error al cargar el inventario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      fetchProductos();
    }
  }, [loadingContext]);

  const handleExportToWord = async () => {
    try {
      setExporting(true);
      
      // Filtrar productos que tienen precio > 0 para la exportación
      const productosParaExportar = productos.filter(producto => producto.precio > 0);
      
      if (productosParaExportar.length === 0) {
        showMessage("No hay productos con precio para exportar", "warning");
        return;
      }

      await exportInventoryToWord({
        productos: productosParaExportar,
        tiendaNombre: user.tiendaActual.nombre,
        fecha: new Date()
      });

      showMessage(`Inventario exportado exitosamente (${productosParaExportar.length} productos)`, "success");
    } catch (error) {
      console.error("Error al exportar inventario:", error);
      showMessage("Error al exportar el inventario", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = (producto: IProductoTienda) => {
    setSelectedProduct(producto);
    setMovementsModalOpen(true);
  };

  const handleCloseMovementsModal = () => {
    setMovementsModalOpen(false);
    setSelectedProduct(null);
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Inventario de Productos
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExportToWord}
          disabled={exporting || loading || productos.length === 0}
          size="large"
        >
          {exporting ? "Exportando..." : "Exportar a Word"}
        </Button>
      </Box>

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

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        💡 Haz clic en cualquier producto para ver su historial de movimientos
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={tableCellHeaderStyle}>Producto</TableCell>
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
                <TableCell align="center" colSpan={4}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : (
              filteredProductos.map((producto) => (
                <TableRow 
                  key={producto.id}
                  onClick={() => handleRowClick(producto)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    transition: 'background-color 0.2s ease'
                  }}
                >
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

      {/* Modal de movimientos */}
      <ProductMovementsModal
        open={movementsModalOpen}
        onClose={handleCloseMovementsModal}
        producto={selectedProduct}
      />

      {/* Botón flotante como alternativa */}
      <Fab
        color="primary"
        aria-label="exportar"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={handleExportToWord}
        disabled={exporting || loading || productos.length === 0}
      >
        <DownloadIcon />
      </Fab>
    </Box>
  );
} 