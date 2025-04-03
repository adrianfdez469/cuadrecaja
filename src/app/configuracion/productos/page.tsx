"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
} from "@mui/material";
import { ProductoForm } from "./components/product.form";
import { Delete, Edit } from "@mui/icons-material";
import { createProduct, deleteProduct, editProduct, fetchProducts } from "@/services/productServise";
import { IProducto } from "@/types/IProducto";

export default function ProductList() {
  const [products, setProducts] = useState<IProducto[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    (async () => {
      const prods = await fetchProducts();
      setProducts(prods);
    })();
  }, []);

  const handleOpen = (id = null) => {
    setEditingId(id);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleSave = async (nombre, descripcion, categoriaId) => {
  

    if(editingId) {
      await editProduct(editingId, nombre, descripcion, categoriaId);
    } else {
      await createProduct(nombre, descripcion, categoriaId);
    }
    await fetchProducts();
    handleClose();
  };

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
    await fetchProducts();
  };

  return (
    <Box>
      <Box
        display={"flex"}
        flexDirection={"row"}
        justifyContent={"space-between"}
      >
        <Typography variant="h4">Gestión de Productos</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpen()}
        >
          Añadir Producto
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.descripcion}</TableCell>
                <TableCell>
                  <Box
                    display="flex"
                    flexDirection={"row"}
                    justifyContent={"flex-start"}
                  >
                    <Box style={{}} />
                    <span
                      style={{
                        backgroundColor: p.categoria?.color,
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        marginRight: 10,
                      }}
                    />
                    {p.categoria?.nombre || "Sin categoría"}
                  </Box>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(p.id)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(p.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ProductoForm
        open={open}
        handleClose={handleClose}
        handleSave={handleSave}
      />
    </Box>
  );
}
